
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
        const { status, potentialLevel, note, actionTaken, appointmentDate } = body;

        if (!status || !potentialLevel || !note) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // Verify this lead is assigned to the current user
        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (lead.assigned_to !== user.id) {
            return NextResponse.json({ message: 'Forbidden - Not your lead' }, { status: 403 });
        }

        // Update lead
        const updateData: any = {
            status,
            potential_level: potentialLevel,
            current_agent_id: null, // Unlock
            locked_at: null,
            processed_at: new Date().toISOString(),
        };

        if (appointmentDate) {
            updateData.appointment_date = appointmentDate;
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
                metadata: { status, potential_level: potentialLevel, action_taken: actionTaken },
            });

            if (logError) {
                console.error('Failed to log activity via admin client:', logError);
            }
        } catch (logErr) {
            console.error('Failed to init admin client for logging:', logErr);
        }

        // GAMIFICATION 2.0: Award XP based on outcome
        const { awardXP } = await import('@/lib/gamification');

        if (status === 'appointment') {
            // Big Reward for Appointment
            await awardXP(user.id, 200, 'appointment_set');
        } else if (status === 'contacted') {
            // Small Reward for Call/Contact
            await awardXP(user.id, 10, 'call_made');
        } else if (status === 'completed' || status === 'sold') {
            // Jackpot for Sale (if applicable in future)
            await awardXP(user.id, 1000, 'sale_closed');
        }

        // Get next lead ID (optional)
        const { data: nextLeads } = await supabase
            .from('leads')
            .select('id')
            .eq('assigned_to', user.id)
            .eq('status', 'pending')
            .order('created_at')
            .limit(1);

        return NextResponse.json({
            success: true,
            nextLeadId: nextLeads && nextLeads.length > 0 ? nextLeads[0].id : null,
            message: 'Lead successfully updated',
        });

    } catch (error: any) {
        console.error('Lead update error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'Update failed' },
            { status: 500 }
        );
    }
}
