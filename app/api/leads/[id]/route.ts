
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { status, potentialLevel, note, actionTaken, appointmentDate, closerId, meetingUrl, meetingOutcome, callbackAt, callbackReason } = body;

        if (!status || !potentialLevel || !note) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const allowedMeetingOutcomes = ['won', 'lost', 'no_show', 'completed'];
        if (meetingOutcome && !allowedMeetingOutcomes.includes(meetingOutcome)) {
            return NextResponse.json({ message: 'Invalid meeting outcome' }, { status: 400 });
        }

        if (appointmentDate) {
            if (Number.isNaN(new Date(appointmentDate).getTime())) {
                return NextResponse.json({ message: 'Invalid appointment date' }, { status: 400 });
            }

            if (!closerId) {
                return NextResponse.json({ message: 'Closer is required for appointments' }, { status: 400 });
            }

            if (!meetingUrl || !/^https:\/\/meet\.google\.com\//i.test(String(meetingUrl).trim())) {
                return NextResponse.json({ message: 'Valid Google Meet URL is required' }, { status: 400 });
            }
        }

        if (callbackAt) {
            if (Number.isNaN(new Date(callbackAt).getTime())) {
                return NextResponse.json({ message: 'Invalid callback date' }, { status: 400 });
            }

            if (status !== 'callback') {
                return NextResponse.json({ message: 'Callback date requires callback status' }, { status: 400 });
            }
        }

        // Verify this lead is assigned to the current user
        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (lead.assigned_to !== user.id && lead.sdr_id !== user.id && lead.closer_id !== user.id) {
            return NextResponse.json({ message: 'Forbidden - Not your lead' }, { status: 403 });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('sales_role')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        const userSalesRole = profile?.sales_role === 'closer' ? 'closer' : 'sdr';

        if (appointmentDate && userSalesRole === 'closer') {
            return NextResponse.json({ message: 'Closers cannot create SDR appointments' }, { status: 403 });
        }

        if (meetingOutcome && (userSalesRole !== 'closer' || lead.closer_id !== user.id)) {
            return NextResponse.json({ message: 'Only the assigned closer can close meeting outcomes' }, { status: 403 });
        }

        if (closerId) {
            const { data: closer, error: closerError } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', closerId)
                .eq('role', 'agent')
                .eq('sales_role', 'closer')
                .maybeSingle();

            if (closerError) throw closerError;
            if (!closer) {
                return NextResponse.json({ message: 'Invalid closer assignment' }, { status: 400 });
            }
        }

        // Update lead
        const updateData: Record<string, string | boolean | null> = {
            status,
            potential_level: potentialLevel,
            current_agent_id: null, // Unlock
            locked_at: null,
            processed_at: new Date().toISOString(),
        };

        if (appointmentDate) {
            updateData.appointment_date = appointmentDate;
            updateData.sdr_id = user.id;
            updateData.closer_id = closerId || null;
            updateData.meeting_url = String(meetingUrl).trim();
            updateData.meeting_status = 'scheduled';
            updateData.callback_at = null;
            updateData.callback_reason = null;
            updateData.callback_reminder_10m_sent = false;
        }

        if (meetingOutcome) {
            updateData.meeting_status = meetingOutcome;
        }

        if (callbackAt) {
            updateData.callback_at = callbackAt;
            updateData.callback_reason = callbackReason ? String(callbackReason).slice(0, 500) : note.slice(0, 500);
            updateData.callback_reminder_10m_sent = false;
            updateData.assigned_to = user.id;
            updateData.sdr_id = user.id;
            updateData.appointment_date = null;
            updateData.closer_id = null;
            updateData.meeting_url = null;
            updateData.meeting_status = 'scheduled';
        }

        const { error: updateError } = await supabase
            .from('leads')
            .update(updateData)
            .eq('id', id);

        if (updateError) throw updateError;

        // SEND SMS CONFIRMATION
        if (status === 'appointment' && appointmentDate) {
            try {
                const { sendSMS } = await import('@/lib/sms');
                const dateObj = new Date(appointmentDate);
                const formattedDate = new Intl.DateTimeFormat('tr-TR', {
                    dateStyle: 'full',
                    timeStyle: 'short'
                }).format(dateObj);

                const message = `Sayın Yetkili, Randevunuz oluşturulmuştur. Tarih: ${formattedDate}. Görüşmek üzere. - ArtificAgent`;

                // Send async - don't block response
                sendSMS(lead.phone_number, message, lead.business_name).catch(console.error);
            } catch (smsError) {
                console.error("Failed to initiate SMS:", smsError);
            }
        }

        if (updateError) throw updateError;

        // Insert note
        const { error: noteError } = await supabase
            .from('lead_notes')
            .insert({
                lead_id: id,
                agent_id: user.id,
                note,
                action_taken: actionTaken || null, // Make it optional
            });

        if (noteError) throw noteError;

        // Log activity USING ADMIN CLIENT
        try {
            const adminClient = createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                }
            );

            const { error: logError } = await adminClient.from('lead_activity_log').insert({
                lead_id: id,
                agent_id: user.id,
                action: 'completed',
                metadata: {
                    status,
                    potential_level: potentialLevel,
                    action_taken: actionTaken,
                    closer_id: closerId || null,
                    meeting_url: meetingUrl || null,
                    meeting_outcome: meetingOutcome || null,
                    callback_at: callbackAt || null,
                    callback_reason: callbackReason || null,
                },
            });

            if (logError) {
                console.error('Failed to log activity via admin client:', logError);
            }
        } catch (logErr) {
            console.error('Failed to init admin client for logging:', logErr);
        }

        // GAMIFICATION 2.0: Award XP based on outcome
        const { awardXP } = await import('@/lib/gamification');

        if (meetingOutcome === 'won') {
            await awardXP(user.id, 1000, 'sale_closed');
        } else if (meetingOutcome) {
            await awardXP(user.id, 100, 'meeting_completed');
        } else if (status === 'appointment') {
            // Big Reward for Appointment
            await awardXP(user.id, 200, 'appointment_set');
        } else if (status === 'callback') {
            await awardXP(user.id, 25, 'callback_set');
        } else if (status === 'contacted') {
            // Small Reward for Call/Contact
            await awardXP(user.id, 10, 'call_made');
        } else if (status === 'completed' || status === 'sold') {
            // Jackpot for Sale (if applicable in future)
            await awardXP(user.id, 1000, 'sale_closed');
        }

        // Get next lead ID (optional)
        let nextLeadQuery = supabase
            .from('leads')
            .select('id')
            .is('current_agent_id', null)
            .limit(1);

        nextLeadQuery = userSalesRole === 'closer'
            ? nextLeadQuery
                .eq('closer_id', user.id)
                .eq('meeting_status', 'scheduled')
                .not('appointment_date', 'is', null)
                .order('appointment_date')
            : nextLeadQuery
                .eq('assigned_to', user.id)
                .or(`status.eq.pending,and(status.eq.callback,callback_at.lte.${new Date().toISOString()})`)
                .order('callback_at', { ascending: true, nullsFirst: false })
                .order('created_at');

        const { data: nextLeads } = await nextLeadQuery;

        return NextResponse.json({
            success: true,
            nextLeadId: nextLeads && nextLeads.length > 0 ? nextLeads[0].id : null,
            message: 'Lead successfully updated',
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Update failed';
        console.error('Lead update error:', error);
        return NextResponse.json(
            { success: false, message },
            { status: 500 }
        );
    }
}
