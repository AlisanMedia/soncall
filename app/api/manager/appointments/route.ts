import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Generate consistent color for agent based on ID
function getAgentColor(agentId: string): { from: string; to: string } {
    const colors = [
        { from: '#8B5CF6', to: '#EC4899' }, // Purple-Pink
        { from: '#3B82F6', to: '#06B6D4' }, // Blue-Cyan
        { from: '#10B981', to: '#34D399' }, // Green-Emerald
        { from: '#F59E0B', to: '#F97316' }, // Amber-Orange
        { from: '#EF4444', to: '#F43F5E' }, // Red-Rose
        { from: '#6366F1', to: '#8B5CF6' }, // Indigo-Purple
    ];

    // Hash agent ID to get consistent color
    const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

// Calculate time until appointment
function getTimeUntil(appointmentDate: string): string {
    const now = new Date();
    const appointment = new Date(appointmentDate);
    const diffMs = appointment.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} dakika sonra`;
    if (diffHours < 24) return `${diffHours} saat sonra`;
    if (diffDays === 1) return 'Yarın';
    if (diffDays < 7) return `${diffDays} gün sonra`;

    return appointment.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export async function GET(request: Request) {
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is manager
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get query params
        const { searchParams } = new URL(request.url);
        const agentFilter = searchParams.get('agent');
        const potentialFilter = searchParams.get('potential');

        // Fetch appointments
        let query = supabase
            .from('leads')
            .select(`
                id,
                appointment_date,
                business_name,
                phone_number,
                potential_level,
                assigned_to,
                profiles!leads_assigned_to_fkey (
                    id,
                    full_name,
                    avatar_url
                )
            `)
            .not('appointment_date', 'is', null)
            .gte('appointment_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .lte('appointment_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
            .order('appointment_date', { ascending: true });

        // Apply filters
        if (agentFilter) {
            query = query.eq('assigned_to', agentFilter);
        }
        if (potentialFilter) {
            query = query.eq('potential_level', potentialFilter);
        }

        const { data: appointments, error } = await query;

        if (error) {
            console.error('Appointments fetch error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Get AI notes for each appointment
        const appointmentIds = appointments?.map(a => a.id) || [];
        const { data: notes } = await supabase
            .from('lead_notes')
            .select('lead_id, note, created_at')
            .in('lead_id', appointmentIds)
            .eq('action_taken', 'AI Analysis')
            .order('created_at', { ascending: false });

        // Group notes by lead_id (get latest)
        const notesByLead = new Map();
        notes?.forEach(note => {
            if (!notesByLead.has(note.lead_id)) {
                notesByLead.set(note.lead_id, note.note);
            }
        });

        // Transform data
        const transformedAppointments = appointments?.map(apt => {
            const agent = Array.isArray(apt.profiles) ? apt.profiles[0] : apt.profiles;
            const agentColor = getAgentColor(agent.id);
            const appointmentTime = new Date(apt.appointment_date);
            const now = new Date();
            const hoursUntil = (appointmentTime.getTime() - now.getTime()) / 3600000;

            return {
                id: apt.id,
                appointment_date: apt.appointment_date,
                business_name: apt.business_name,
                phone_number: apt.phone_number,
                potential_level: apt.potential_level,
                agent_id: agent.id,
                agent_name: agent.full_name,
                agent_avatar: agent.avatar_url,
                agent_color: agentColor,
                is_urgent: hoursUntil < 24 && hoursUntil > 0,
                is_today: appointmentTime.toDateString() === now.toDateString(),
                time_until: getTimeUntil(apt.appointment_date),
                notes: notesByLead.get(apt.id) || null,
            };
        }) || [];

        return NextResponse.json({
            success: true,
            appointments: transformedAppointments,
            count: transformedAppointments.length,
        });

    } catch (error: any) {
        console.error('Appointments API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
