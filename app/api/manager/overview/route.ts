import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveRequestedMarketId } from '@/lib/market-access';
import { getAppDayStart } from '@/lib/timezone';
import { createAdminClient } from '@/lib/supabase/admin';

async function readAllRows<T>(query: {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
}): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await query.range(offset, offset + 999);
        if (error) throw error;
        const page = data || [];
        rows.push(...page);
        if (page.length < 1000) return rows;
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Verify manager role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .single();

        if (profileError) throw profileError;
        const role = (profile?.role || '').toLowerCase();
        if (!['manager', 'admin', 'founder'].includes(role)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        const effectiveMarketId = resolveRequestedMarketId(profile, request.nextUrl.searchParams.get('marketId'));
        // Use the session client for auth only. The admin client avoids nested
        // lead joins being removed by child-table RLS; every aggregate below is
        // explicitly constrained by effectiveMarketId when the manager is scoped.
        const dataClient = createAdminClient();

        // Get today's start
        const today = getAppDayStart();

        // Total leads in system
        let totalLeadsQuery = dataClient
            .from('leads')
            .select('*', { count: 'exact', head: true });
        if (effectiveMarketId) {
            totalLeadsQuery = totalLeadsQuery.eq('market_id', effectiveMarketId);
        }
        const { count: totalLeads } = await totalLeadsQuery;

        // Pending leads
        let pendingLeadsQuery = dataClient
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        if (effectiveMarketId) {
            pendingLeadsQuery = pendingLeadsQuery.eq('market_id', effectiveMarketId);
        }
        const { count: pendingLeads } = await pendingLeadsQuery;

        // Today's completed activity stream powers both global and role-specific metrics.
        let todayActivitiesQuery = dataClient
            .from('lead_activity_log')
            .select('agent_id, lead_id, metadata, leads:lead_id!inner(market_id, status)')
            .eq('action', 'completed')
            .gte('created_at', today.toISOString())
            .order('id');
        if (effectiveMarketId) todayActivitiesQuery = todayActivitiesQuery.eq('leads.market_id', effectiveMarketId);
        const todayActivities = await readAllRows(todayActivitiesQuery);

        const roleTargetsToday: Record<string, number> = {};
        let appointmentsToday = 0;

        const countedAppointmentLeads = new Map<string, Set<string>>();
        todayActivities?.forEach((activity) => {
            const metadata = activity.metadata as {
                action_taken?: string;
                status?: string;
                meeting_outcome?: string | null;
            } | null;

            const lead = Array.isArray(activity.leads) ? activity.leads[0] : activity.leads;
            const isAppointment = metadata?.action_taken === 'appointment_scheduled'
                || metadata?.status === 'appointment'
                || lead?.status === 'appointment';
            if (isAppointment) {
                const seen = countedAppointmentLeads.get(activity.agent_id) || new Set<string>();
                if (!seen.has(activity.lead_id)) {
                    seen.add(activity.lead_id);
                    countedAppointmentLeads.set(activity.agent_id, seen);
                    appointmentsToday++;
                    roleTargetsToday[activity.agent_id] = (roleTargetsToday[activity.agent_id] || 0) + 1;
                }
            }

            if (metadata?.meeting_outcome) {
                roleTargetsToday[activity.agent_id] = (roleTargetsToday[activity.agent_id] || 0) + 1;
            }
        });

        // Get all agents with their stats
        let agentsQuery = dataClient
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
                const { data: progressData } = await dataClient
                    .from('agent_progress')
                    .select('total_xp, current_level, last_activity_timestamp')
                    .eq('agent_id', agent.id)
                    .single();

                // Total assigned
                let assignedQuery = dataClient
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
                let pendingQuery = dataClient
                    .from('leads')
                    .select('*', { count: 'exact', head: true });
                if (effectiveMarketId) {
                    pendingQuery = pendingQuery.eq('market_id', effectiveMarketId);
                }

                pendingQuery = isCloser
                    ? pendingQuery
                        .eq('closer_id', agent.id)
                        .eq('meeting_status', 'scheduled')
                        .not('appointment_date', 'is', null)
                    : pendingQuery
                        .eq('assigned_to', agent.id)
                        .eq('status', 'pending');

                const { count: pending } = await pendingQuery;

                // Total completed ever (Lifetime) - Used for XP/Level
                let totalCompletedQuery = dataClient
                    .from('lead_activity_log')
                    .select('id, leads:lead_id!inner(market_id)', { count: 'exact', head: true })
                    .eq('agent_id', agent.id)
                    .eq('action', 'completed');
                if (effectiveMarketId) totalCompletedQuery = totalCompletedQuery.eq('leads.market_id', effectiveMarketId);
                const { count: totalCompleted } = await totalCompletedQuery;

                // Appointments / meetings owned by this function
                let appointmentsQuery = dataClient
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
