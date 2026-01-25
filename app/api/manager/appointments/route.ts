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
                appointment_notes,
                assigned_to,
                profiles!leads_assigned_to_fkey(
                    id,
                    full_name,
                    avatar_url,
                    theme_color
                )
            `)
            .not('appointment_date', 'is', null)
            .order('appointment_date', { ascending: true });

        // Apply filter if selected
        if (agentFilter && agentFilter !== 'all') {
            query = query.eq('assigned_to', agentFilter);
        }

        const { data: leads, error } = await query;

        if (error) throw error;

        // Transform data to match frontend interface
        const appointments = leads?.map(lead => {
            const agent = lead.profiles as any; // Due to join alias behavior
            const appDate = new Date(lead.appointment_date);
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
                appointment_date: lead.appointment_date,
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
                notes: lead.appointment_notes
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
