import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveRequestedMarketId } from '@/lib/market-access';

export async function GET(request: NextRequest) {
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
            .select('id, role, market_id')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        const effectiveMarketId = resolveRequestedMarketId(profile, request.nextUrl.searchParams.get('marketId'));

        // Get today's start
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Total leads in system
        let totalLeadsQuery = supabase
            .from('leads')
            .select('*', { count: 'exact', head: true });
        if (effectiveMarketId) {
            totalLeadsQuery = totalLeadsQuery.eq('market_id', effectiveMarketId);
        }
        const { count: totalLeads } = await totalLeadsQuery;

        // Pending leads
        let pendingLeadsQuery = supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        if (effectiveMarketId) {
            pendingLeadsQuery = pendingLeadsQuery.eq('market_id', effectiveMarketId);
        }
        const { count: pendingLeads } = await pendingLeadsQuery;

        // Today's completed activity stream powers both global and role-specific metrics.
        const { data: todayActivities, error: todayActivitiesError } = await supabase
            .from('lead_activity_log')
            .select('agent_id, metadata')
            .eq('action', 'completed')
            .gte('created_at', today.toISOString());

        if (todayActivitiesError) throw todayActivitiesError;

        const roleTargetsToday: Record<string, number> = {};
        let appointmentsToday = 0;

        todayActivities?.forEach((activity) => {
            const metadata = activity.metadata as {
                action_taken?: string;
                meeting_outcome?: string | null;
            } | null;

            if (metadata?.action_taken === 'appointment_scheduled') {
                appointmentsToday++;
                roleTargetsToday[activity.agent_id] = (roleTargetsToday[activity.agent_id] || 0) + 1;
            }

            if (metadata?.meeting_outcome) {
                roleTargetsToday[activity.agent_id] = (roleTargetsToday[activity.agent_id] || 0) + 1;
            }
        });

        // Get all agents with their stats
        let agentsQuery = supabase
            .from('profiles')
            .select('id, full_name, avatar_url, sales_role, market_id')
            .eq('role', 'agent');
        if (effectiveMarketId) {
            agentsQuery = agentsQuery.eq('market_id', effectiveMarketId);
        }
        const { data: agents, error: agentsError } = await agentsQuery;

        if (agentsError) throw agentsError;

        const agentStats = await Promise.all(
            (agents || []).map(async (agent) => {
                const isCloser = agent.sales_role === 'closer';

                // Get agent progress data (level, rank, last activity)
                const { data: progressData } = await supabase
                    .from('agent_progress')
                    .select('total_xp, current_level, last_activity_timestamp')
                    .eq('agent_id', agent.id)
                    .single();

                // Total assigned
                let assignedQuery = supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true });
                if (effectiveMarketId) {
                    assignedQuery = assignedQuery.eq('market_id', effectiveMarketId);
                }

                assignedQuery = isCloser
                    ? assignedQuery.eq('closer_id', agent.id)
                    : assignedQuery.eq('assigned_to', agent.id);

                const { count: assigned } = await assignedQuery;

                // Pending
                let pendingQuery = supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true });
                if (effectiveMarketId) {
                    pendingQuery = pendingQuery.eq('market_id', effectiveMarketId);
                }

                pendingQuery = isCloser
                    ? pendingQuery
                        .eq('closer_id', agent.id)
                        .eq('meeting_status', 'scheduled')
                    : pendingQuery
                        .eq('assigned_to', agent.id)
                        .eq('status', 'pending');

                const { count: pending } = await pendingQuery;

                // Total completed ever (Lifetime) - Used for XP/Level
                const { count: totalCompleted } = await supabase
                    .from('lead_activity_log')
                    .select('*', { count: 'exact', head: true })
                    .eq('agent_id', agent.id)
                    .eq('action', 'completed');

                // Appointments / meetings owned by this function
                let appointmentsQuery = supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true });
                if (effectiveMarketId) {
                    appointmentsQuery = appointmentsQuery.eq('market_id', effectiveMarketId);
                }

                appointmentsQuery = isCloser
                    ? appointmentsQuery.eq('closer_id', agent.id)
                    : appointmentsQuery
                        .eq('status', 'appointment')
                        .or(`assigned_to.eq.${agent.id},sdr_id.eq.${agent.id}`);

                const { count: appointments } = await appointmentsQuery;

                // Use level from agent_progress if available, otherwise calculate
                const level = progressData?.current_level || Math.floor((totalCompleted || 0) / 50) + 1;

                let rank = 'Çaylak'; // Junior
                if (level >= 5) rank = 'Uzman';
                if (level >= 10) rank = 'Usta';
                if (level >= 20) rank = 'Efsane';
                if (level >= 50) rank = 'Godlike';

                return {
                    agent_id: agent.id,
                    agent_name: agent.full_name,
                    avatar_url: agent.avatar_url,
                    sales_role: agent.sales_role || 'sdr',
                    metric_label: isCloser ? 'Toplantı Sonucu' : 'Toplantı Organizasyonu',
                    level,
                    rank,
                    total_assigned: assigned || 0,
                    completed_today: roleTargetsToday[agent.id] || 0,
                    total_completed: totalCompleted || 0,
                    pending: pending || 0,
                    appointments: appointments || 0,
                    completion_rate: assigned ? Math.round(((totalCompleted || 0) / assigned) * 100) : 0,
                    last_activity_timestamp: progressData?.last_activity_timestamp || null,
                };
            })
        );

        return NextResponse.json({
            overview: {
                total_leads: totalLeads || 0,
                pending_leads: pendingLeads || 0,
                completed_today: todayActivities?.length || 0,
                appointments_today: appointmentsToday,
            },
            agent_stats: agentStats,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch overview';
        console.error('Manager overview error:', error);
        return NextResponse.json(
            { message },
            { status: 500 }
        );
    }
}
