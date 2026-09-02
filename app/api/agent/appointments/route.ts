import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();

        // Verify agent authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('sales_role, market_id')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) throw profileError;
        const isCloser = profile?.sales_role === 'closer';

        // Fetch leads assigned to this agent with appointment dates
        let query = supabase
            .from('leads')
            .select(`
                id,
                market_id,
                business_name,
                phone_number,
                potential_level,
                appointment_date,
                callback_at,
                callback_reason,
                sdr_id,
                closer_id,
                meeting_url,
                meeting_status,
                processed_at,
                status,
                notes:lead_notes(note, created_at)
            `)
            .or('appointment_date.not.is.null,status.eq.appointment,status.eq.callback')
            .order('appointment_date', { ascending: true }); // Get earliest first

        if (profile?.market_id) {
            query = query.eq('market_id', profile.market_id);
        }

        query = isCloser
            ? query.eq('closer_id', user.id)
            : query.or(`assigned_to.eq.${user.id},sdr_id.eq.${user.id}`);

        const { data: leads, error } = await query;

        if (error) throw error;

        // Fetch activity logs for these leads to determine call status
        const leadIds = leads?.map(l => l.id) || [];
        const { data: activities } = await supabase
            .from('lead_activity_log')
            .select('lead_id, action, created_at, metadata')
            .in('lead_id', leadIds)
            .in('action', ['call_recording', 'completed'])
            .order('created_at', { ascending: false });

        // Transform and Sort
        const appointments = leads?.map(lead => {
            // Helper to parse Turkish date if appointment_date is missing (Fallback)
            const parseTurkishDate = (text: string) => {
                try {
                    const match = text.match(/📅 Randevu: (.*)/);
                    if (!match) return null;
                    const dateStr = match[1].trim();
                    const parts = dateStr.split(' ');
                    if (parts.length < 5) return null;
                    const day = parseInt(parts[0]);
                    const monthName = parts[1].toLowerCase();
                    const year = parseInt(parts[2]);
                    const time = parts[4];
                    const [hour, minute] = time.split(':').map(Number);
                    const months: Record<string, number> = {
                        'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
                        'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
                    };
                    const month = months[monthName];
                    if (month === undefined) return null;
                    const date = new Date(year, month, day, hour, minute);
                    return date.toISOString();
                } catch { return null; }
            };

            // Determine effective date because sometimes it's in notes
            const latestNote = lead.notes?.[0]?.note || '';
            const parsedDate = parseTurkishDate(latestNote);
            const taskType = lead.status === 'callback' ? 'callback' : 'appointment';
            const dateStr = lead.callback_at || lead.appointment_date || parsedDate || lead.processed_at || new Date().toISOString();
            const appDate = new Date(dateStr);
            const today = new Date();

            // Calculate Status
            const leadCalls = activities?.filter(a => {
                // Check if call was made on the same day or generally after appointment creation
                return a.lead_id === lead.id;
            }) || [];

            const lastCall = leadCalls[0];

            let status: 'won' | 'lost' | 'no_show' | 'completed' | 'interviewed' | 'attempted' | 'missed' | 'pending' = 'pending';
            const diffMs = appDate.getTime() - today.getTime();

            // Check for actual sale/win
            // We need to fetch lead status from the lead object itself, assuming it's selected
            // But wait, we selected 'id, business_name...' in the query above.
            // Let's assume we need to add 'status' to the select query first if not present.
            // Actually, leads query selects processed_at which is good.
            // Let's use lead.status if available (need to update query) or check logs.

            // Refined Logic:
            // 1. Won (Sale) -> Needs lead.status check (will update query below)
            // 2. Interviewed -> Duration > 60s
            // 3. Attempted -> Call made but < 60s
            // 4. Missed -> Past time, no call
            // 5. Pending -> Future

            if (taskType === 'callback' && lead.status === 'callback') {
                if (leadCalls.length > 0) {
                    status = 'attempted';
                } else if (diffMs < -15 * 60 * 1000) {
                    status = 'missed';
                } else {
                    status = 'pending';
                }
            } else if (lead.meeting_status === 'won') {
                status = 'won';
            } else if (lead.meeting_status === 'lost') {
                status = 'lost';
            } else if (lead.meeting_status === 'no_show') {
                status = 'no_show';
            } else if (lead.meeting_status === 'completed') {
                status = 'completed';
            } else if (leadCalls.length > 0) {
                const duration = lastCall.metadata?.duration || 0;
                if (duration > 60 || lastCall.action === 'completed') {
                    status = 'interviewed';
                } else {
                    status = 'attempted';
                }
            } else {
                if (diffMs < -15 * 60 * 1000) { // 15 mins past
                    status = 'missed';
                } else {
                    status = 'pending';
                }
            }

            // Calculate Urgency Score (Lower is more urgent)
            // Past pending items are most urgent, then upcoming soon
            let urgencyScore = diffMs;
            if (status === 'missed') urgencyScore = -999999999; // Top priority to clear
            if (status === 'interviewed') urgencyScore = 999999999; // Low priority (already talked)
            if (status === 'completed' || status === 'lost' || status === 'no_show') urgencyScore = 999999999;
            if (status === 'won') urgencyScore = 1000000000; // Complete

            return {
                id: lead.id,
                business_name: lead.business_name,
                phone_number: lead.phone_number,
                appointment_date: dateStr,
                task_type: taskType,
                callback_at: lead.callback_at,
                callback_reason: lead.callback_reason,
                sdr_id: lead.sdr_id,
                closer_id: lead.closer_id,
                meeting_url: lead.meeting_url,
                meeting_status: lead.meeting_status,
                potential_level: lead.potential_level,
                notes: latestNote,
                status,
                urgencyScore,
                last_call_at: lastCall?.created_at,
                call_count: leadCalls.length // [NEW]
            };
        }) || [];

        // Sort by Urgency
        appointments.sort((a, b) => a.urgencyScore - b.urgencyScore);

        return NextResponse.json({
            success: true,
            appointments
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch appointments';
        console.error('Agent appointments error:', error);
        return NextResponse.json(
            { success: false, message },
            { status: 500 }
        );
    }
}
