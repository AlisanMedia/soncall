import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Verify manager role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Get today's start
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Total leads in system
        const { count: totalLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true });

        // Pending leads
        const { count: pendingLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        // Completed today
        const { count: completedToday } = await supabase
            .from('lead_activity_log')
            .select('*', { count: 'exact', head: true })
            .eq('action', 'completed')
            .gte('created_at', today.toISOString());

        // Appointments today
        const { count: appointmentsToday } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'appointment')
            .gte('processed_at', today.toISOString());

        // Get all agents with their stats
        const { data: agents, error: agentsError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'agent');

        if (agentsError) throw agentsError;

        const agentStats = await Promise.all(
            (agents || []).map(async (agent) => {
                // Total assigned
                const { count: assigned } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_to', agent.id);

                // Completed today
                const { count: completedToday } = await supabase
                    .from('lead_activity_log')
                    .select('*', { count: 'exact', head: true })
                    .eq('agent_id', agent.id)
                    .eq('action', 'completed')
                    .gte('created_at', today.toISOString());

                // Pending
                const { count: pending } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_to', agent.id)
                    .eq('status', 'pending');

                // Total completed ever
                const { count: totalCompleted } = await supabase
                    .from('lead_activity_log')
                    .select('*', { count: 'exact', head: true })
                    .eq('agent_id', agent.id)
                    .eq('action', 'completed');

                // Appointments
                const { count: appointments } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_to', agent.id)
                    .eq('status', 'appointment');


                return {
                    agent_id: agent.id,
                    agent_name: agent.full_name,
                    total_assigned: assigned || 0,
                    completed_today: completedToday || 0,
                    total_completed: totalCompleted || 0,
                    pending: pending || 0,
                    appointments: appointments || 0,
                    completion_rate: assigned ? Math.round(((totalCompleted || 0) / assigned) * 100) : 0,
                };
            })
        );

        return NextResponse.json({
            overview: {
                total_leads: totalLeads || 0,
                pending_leads: pendingLeads || 0,
                completed_today: completedToday || 0,
                appointments_today: appointmentsToday || 0,
            },
            agent_stats: agentStats,
        });

    } catch (error: any) {
        console.error('Manager overview error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to fetch overview' },
            { status: 500 }
        );
    }
}
