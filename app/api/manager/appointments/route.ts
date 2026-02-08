import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const agentFilter = searchParams.get('agent');

        // Parse filters
        const statusFilter = searchParams.get('status'); // 'confirmed', 'attempted', 'missed', 'pending'
        const potentialFilter = searchParams.get('potential'); // 'high', 'medium', 'low'
        const dateStart = searchParams.get('start');
        const dateEnd = searchParams.get('end');

        // Verify manager authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        let query = supabase
            .from('leads')
            .select(`
                id,
                business_name,
                phone_number,
                potential_level,
                appointment_date,
                assigned_to,
                processed_at,
                status,
                profiles!leads_assigned_to_fkey(
                    id,
                    full_name,
                    avatar_url,
                    theme_color
                )
            `)
            .or('appointment_date.not.is.null,status.eq.appointment')
            .order('appointment_date', { ascending: true });

        // Apply filters
        if (agentFilter && agentFilter !== 'all') {
            query = query.eq('assigned_to', agentFilter);
        }

        if (potentialFilter && potentialFilter !== 'all') {
            query = query.eq('potential_level', potentialFilter);
        }

        // Date Range Filter
        if (dateStart) {
            query = query.gte('appointment_date', dateStart);
        }
        if (dateEnd) {
            query = query.lte('appointment_date', dateEnd);
        }

        const { data: leads, error } = await query;

        if (error) throw error;

        // Fetch notes for these leads
        const leadIds = leads?.map(l => l.id) || [];
        const { data: notes } = await supabase
            .from('lead_notes')
            .select('lead_id, note, created_at')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false });

        // [NEW] Fetch activity logs for call verification
        const { data: activities } = await supabase
            .from('lead_activity_log')
            .select('lead_id, action, created_at, metadata')
            .in('lead_id', leadIds)
            .in('action', ['call_recording', 'completed']) // We care about calls and completion
            .order('created_at', { ascending: false });

        // Transform data to match frontend interface
        const appointments = leads?.map(lead => {
            const agent = lead.profiles as any; // Due to join alias behavior

            // Find latest note
            const leadNote = notes?.find(n => n.lead_id === lead.id);
            const noteText = leadNote?.note || '';

            // Helper to parse Turkish date from note
            const parseTurkishDate = (text: string) => {
                try {
                    const match = text.match(/📅 Randevu: (.*)/);
                    if (!match) return null;

                    const dateStr = match[1].trim();
                    // Format: "26 Ocak 2026 Pazartesi 13:19"
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
                } catch (e) {
                    return null;
                }
            };

            // Fallback to parsed note date or processed_at
            const parsedDate = parseTurkishDate(noteText);
            const dateStr = lead.appointment_date || parsedDate || lead.processed_at || new Date().toISOString();

            const appDate = new Date(dateStr);
            const today = new Date();
            const isToday = appDate.toDateString() === today.toDateString();

            // Calculate time until
            const diffMs = appDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            let timeUntil = '';

            if (diffMs < 0) {
                timeUntil = 'Geçmiş';
            } else if (isToday) {
                timeUntil = 'Bugün';
            } else if (diffDays === 1) {
                timeUntil = 'Yarın';
            } else {
                timeUntil = `${diffDays} gün kaldı`;
            }

            // [NEW] Logic for Call Status
            // Filter activities for this lead that happened ON or AFTER the appointment creation (roughly)
            // Actually better: Check if there is ANY call log on the Appointment Day?
            // Or just check if there is a call log created AFTER the appointment date?
            // "Randevu Takibi" usually means "Did we call them at the appointment time?"

            // Let's look for calls happening on the same day as the appointment
            const leadCalls = activities?.filter(a => {
                const actDate = new Date(a.created_at);
                return a.lead_id === lead.id &&
                    actDate.toDateString() === appDate.toDateString();
            }) || [];

            const callCount = leadCalls.length;
            const hasCall = callCount > 0;
            const lastCall = leadCalls[0]; // Most recent since ordered desc

            let callStatus: 'confirmed' | 'attempted' | 'missed' | 'pending' = 'pending';

            if (hasCall) {
                // If we have activities, we assume it was attempted at least
                // Check duration if available in metadata (future proofing)
                const duration = lastCall.metadata?.duration || 0;
                if (duration > 60 || lastCall.action === 'completed') {
                    callStatus = 'confirmed';
                } else {
                    callStatus = 'attempted';
                }
            } else {
                // No calls found
                if (diffMs < -30 * 60 * 1000) { // If 30 mins passed since appointment time
                    callStatus = 'missed';
                } else {
                    callStatus = 'pending';
                }
            }

            // Theme colors map
            const colors: Record<string, { from: string, to: string }> = {
                purple: { from: '#9333ea', to: '#4f46e5' },
                blue: { from: '#2563eb', to: '#0891b2' },
                emerald: { from: '#059669', to: '#0d9488' },
                amber: { from: '#d97706', to: '#ea580c' },
                rose: { from: '#e11d48', to: '#db2777' },
                default: { from: '#9333ea', to: '#4f46e5' }
            };

            const agentColor = colors[(agent?.theme_color) || 'purple'] || colors.default;

            return {
                id: lead.id,
                appointment_date: dateStr,
                business_name: lead.business_name || 'İsimsiz İşletme',
                phone_number: lead.phone_number,
                potential_level: lead.potential_level || 'medium',
                agent_id: agent?.id,
                agent_name: agent?.full_name || 'Bilinmeyen Agent',
                agent_avatar: agent?.avatar_url,
                agent_color: agentColor,
                is_urgent: lead.potential_level === 'high',
                is_today: isToday,
                time_until: timeUntil,
                notes: noteText,
                status: lead.status, // Original lead status
                call_status: callStatus, // Calculated call status
                call_count: callCount,
                last_call_at: lastCall?.created_at || null
            };
        }) || [];

        // Apply Status Filter (Post-processing because status is calculated)
        // statusFilter maps to 'callStatus'
        let filteredAppointments = appointments;
        if (statusFilter && statusFilter !== 'all') {
            filteredAppointments = appointments.filter(apt => apt.call_status === statusFilter);
        }

        return NextResponse.json({
            success: true,
            appointments: filteredAppointments
        });

    } catch (error: any) {
        console.error('Appointments fetch error:', error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
