import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const agentFilter = searchParams.get('agent');

        // Verify manager authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Build query
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
                profiles!leads_assigned_to_fkey(
                    id,
                    full_name,
                    avatar_url,
                    theme_color
                )
            `)
            .or('appointment_date.not.is.null,status.eq.appointment')
            .order('appointment_date', { ascending: true });

        // Apply filter if selected
        if (agentFilter && agentFilter !== 'all') {
            query = query.eq('assigned_to', agentFilter);
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
                    // Split by space
                    const parts = dateStr.split(' ');
                    if (parts.length < 5) return null;

                    const day = parseInt(parts[0]);
                    const monthName = parts[1].toLowerCase();
                    const year = parseInt(parts[2]);
                    const time = parts[4]; // Skip day name (parts[3])
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

            // Fallback to parsed note date or processed_at if appointment_date is missing
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

            // Theme colors map (matching frontend)
            const colors: Record<string, { from: string, to: string }> = {
                purple: { from: '#9333ea', to: '#4f46e5' },
                blue: { from: '#2563eb', to: '#0891b2' },
                emerald: { from: '#059669', to: '#0d9488' },
                amber: { from: '#d97706', to: '#ea580c' },
                rose: { from: '#e11d48', to: '#db2777' },
                default: { from: '#9333ea', to: '#4f46e5' }
            };

            const agentColor = colors[agent?.theme_color || 'purple'] || colors.default;

            return {
                id: lead.id,
                appointment_date: dateStr, // Use the effective date
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
                notes: noteText // Use the fetched note
            };
        }) || [];

        return NextResponse.json({
            success: true,
            appointments
        });

    } catch (error: any) {
        console.error('Appointments fetch error:', error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
