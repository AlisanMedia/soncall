import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isGlobalRole } from '@/lib/market-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAppDayStart } from '@/lib/timezone';

async function readAllRows<T>(query: {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
}): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await query.range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) return rows;
    }
}

export async function GET(request: NextRequest) {
    try {
        const sessionClient = await createClient();

        // Verify authentication
        const { data: { user } } = await sessionClient.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agentId');

        const { data: profile, error: profileError } = await sessionClient
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) throw profileError;
        if (!profile || !['agent', 'manager', 'admin', 'founder'].includes(profile.role || '') ||
            (!isGlobalRole(profile.role) && !profile.market_id)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        if (profile.role === 'agent' && agentId && agentId !== user.id) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Team aggregates need teammates' records, which the caller's RLS correctly hides.
        // Authorize first; every aggregate query is scoped to the caller's market below.
        // Raw lead/activity rows are never returned to the browser.
        const supabase = createAdminClient();
        const marketId = isGlobalRole(profile.role) ? null : profile.market_id;

        // Get today's start
        const today = getAppDayStart();

        // Get 5 minutes ago
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        // Get leaderboard - agents with their processed count today
        let activityQuery = supabase
            .from('lead_activity_log')
            .select(`
        agent_id,
        lead_id,
        created_at,
        metadata,
        leads:lead_id!inner (market_id, status)
      `)
            .eq('action', 'completed')
            .gte('created_at', today.toISOString())
            .order('id');
        if (marketId) activityQuery = activityQuery.eq('leads.market_id', marketId);
        const leaderboardData = await readAllRows(activityQuery);

        // Get all agents and their remaining leads
        let hasPipelineColumns = true;
        let agentsQuery = supabase
            .from('profiles')
            .select('id, full_name, avatar_url, sales_role')
            .eq('role', 'agent');
        if (!isGlobalRole(profile?.role) && profile?.market_id) {
            agentsQuery = agentsQuery.eq('market_id', profile.market_id);
        }
        let { data: allAgents, error: agentsError } = await agentsQuery;

        if (agentsError) {
            hasPipelineColumns = false;
            let fallbackAgentQuery = supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('role', 'agent');
            if (!isGlobalRole(profile?.role) && profile?.market_id) {
                fallbackAgentQuery = fallbackAgentQuery.eq('market_id', profile.market_id);
            }
            const fallbackAgents = await fallbackAgentQuery;

            if (fallbackAgents.error) throw fallbackAgents.error;

            allAgents = fallbackAgents.data?.map((agent) => ({
                ...agent,
                sales_role: 'sdr' as const,
            })) || [];
        }

        // Aggregate counts per agent
        const agentStats: Record<string, {
            name: string;
            avatar_url?: string;
            count: number;
            total_lifetime_count: number; // For level calc fallback
            activities: Date[];
            level: number; // New field
            sales_role?: 'sdr' | 'closer' | null;
        }> = {};

        // Initialize all agents
        // Fetch XP levels first
        const { data: progressData } = await supabase
            .from('agent_progress')
            .select('agent_id, current_level')
            .in('agent_id', (allAgents || []).map(agent => agent.id));

        const levelMap = new Map();
        progressData?.forEach((p) => levelMap.set(p.agent_id, p.current_level));

        allAgents?.forEach((agent) => {
            const level = levelMap.get(agent.id) || 1;
            agentStats[agent.id] = {
                name: agent.full_name,
                avatar_url: agent.avatar_url,
                count: 0,
                total_lifetime_count: 0,
                activities: [],
                level,
                sales_role: agent.sales_role || 'sdr',
            };
        });

        const sdrMeetingCounts: Record<string, number> = {};
        const closerMeetingCounts: Record<string, number> = {};
        const countedAppointmentLeads = new Map<string, Set<string>>();

        // Count processed leads (Today)
        leaderboardData?.forEach((log, activityIndex) => {
            const id = log.agent_id;
            if (agentStats[id]) {
                agentStats[id].count++;
                agentStats[id].activities.push(new Date(log.created_at));
            }

            const metadata = log.metadata as {
                action_taken?: string;
                status?: string;
                meeting_outcome?: string | null;
            } | null;

            const lead = (Array.isArray(log.leads) ? log.leads[0] : log.leads) as { status?: string } | null | undefined;
            const leadStatus = lead?.status;
            const isAppointment = metadata?.action_taken === 'appointment_scheduled'
                || metadata?.status === 'appointment'
                || leadStatus === 'appointment';

            if (isAppointment) {
                // A real activity always has a lead id. Keep test/legacy rows
                // without one independent instead of collapsing them into one.
                const leadId = log.lead_id || `activity:${id}:${activityIndex}`;
                const seen = countedAppointmentLeads.get(id) || new Set<string>();
                if (!seen.has(leadId)) {
                    seen.add(leadId);
                    countedAppointmentLeads.set(id, seen);
                    sdrMeetingCounts[id] = (sdrMeetingCounts[id] || 0) + 1;
                }
            }

            if (metadata?.meeting_outcome) {
                closerMeetingCounts[id] = (closerMeetingCounts[id] || 0) + 1;
            }
        });

        // Some legacy appointment rows have no corresponding completed activity.
        // Include them once by lead id so team performance reflects the actual outcome.
        let appointmentLeadQuery = supabase
            .from('leads')
            .select('id, assigned_to, sdr_id, market_id')
            .eq('status', 'appointment')
            .gte('processed_at', today.toISOString())
            .order('id');
        if (marketId) appointmentLeadQuery = appointmentLeadQuery.eq('market_id', marketId);
        const appointmentLeadsToday = await readAllRows(appointmentLeadQuery);
        appointmentLeadsToday.forEach((lead) => {
            const agentId = lead.sdr_id || lead.assigned_to;
            if (!agentId) return;
            const seen = countedAppointmentLeads.get(agentId) || new Set<string>();
            if (!seen.has(lead.id)) {
                seen.add(lead.id);
                countedAppointmentLeads.set(agentId, seen);
                sdrMeetingCounts[agentId] = (sdrMeetingCounts[agentId] || 0) + 1;
            }
        });

        // Get remaining leads for each agent
        let pendingLeadsQuery = supabase
            .from('leads')
            .select('assigned_to, closer_id, status, meeting_status, appointment_date')
            .eq('status', 'pending')
            .order('id');
        let scheduledMeetingsQuery = supabase
            .from('leads')
            .select('assigned_to, closer_id, status, meeting_status, appointment_date')
            .eq('meeting_status', 'scheduled')
            .not('appointment_date', 'is', null)
            .order('id');
        if (!isGlobalRole(profile?.role) && profile?.market_id) {
            pendingLeadsQuery = pendingLeadsQuery.eq('market_id', profile.market_id);
            scheduledMeetingsQuery = scheduledMeetingsQuery.eq('market_id', profile.market_id);
        }

        const [pendingLeads, scheduledMeetings] = await Promise.all([
            readAllRows(pendingLeadsQuery),
            hasPipelineColumns ? readAllRows(scheduledMeetingsQuery) : Promise.resolve([]),
        ]);
        const remainingLeads = [...pendingLeads, ...scheduledMeetings];

        const remainingCounts: Record<string, number> = {};
        remainingLeads?.forEach((lead) => {
            if (lead.assigned_to && lead.status === 'pending') {
                remainingCounts[lead.assigned_to] = (remainingCounts[lead.assigned_to] || 0) + 1;
            }

            const closerId = 'closer_id' in lead && typeof lead.closer_id === 'string' ? lead.closer_id : null;
            const meetingStatus = 'meeting_status' in lead && typeof lead.meeting_status === 'string' ? lead.meeting_status : null;

            if (closerId && meetingStatus === 'scheduled' && 'appointment_date' in lead && lead.appointment_date) {
                remainingCounts[closerId] = (remainingCounts[closerId] || 0) + 1;
            }
        });

        // Convert to array and calculate streaks & speed
        const leaderboard = Object.entries(agentStats)
            .map(([agent_id, data]) => {
                // Calculate streak (consecutive leads in last hour)
                const recentActivities = data.activities
                    .filter(a => a.getTime() > Date.now() - 60 * 60 * 1000)
                    .sort((a, b) => b.getTime() - a.getTime());

                let streak = 0;
                if (recentActivities.length > 0) {
                    streak = 1;
                    for (let i = 0; i < recentActivities.length - 1; i++) {
                        const timeDiff = recentActivities[i].getTime() - recentActivities[i + 1].getTime();
                        if (timeDiff < 15 * 60 * 1000) { // Within 15 minutes
                            streak++;
                        } else {
                            break;
                        }
                    }
                }

                // Calculate speed (leads in last 5 minutes)
                const last5MinActivities = data.activities.filter(
                    a => a.getTime() > fiveMinutesAgo.getTime()
                );

                // GAMIFICATION 2.0 INTEGRATION
                // We need to fetch XP/Level from agent_progress table ideally.
                // For now, let's keep it performant or do a second query.
                // Actually, the best way is to fetch agent_progress at the top level like in analytics.ts
                // BUT, to avoid rewriting the whole file execution flow right now, let's assume we can fetch it or
                // better yet: Re-structure this map to include the data we will fetch below.

                // Wait, let's fetch it at the top level to be clean.
                // (See modified query below)

                const level = data.level || 1;
                // We will populate 'data.level' from the main query updates (see below).

                // Get Standard Rank Info (Import dynamically or duplicate logic to avoid import issues if edge runtime - but this is node)
                // Let's use simple logic here matching getRankInfo if we can't import easily, or just import.
                // Importing is better.

                let rank_title = 'Çaylak';
                if (level >= 10) rank_title = 'Avcı';
                if (level >= 25) rank_title = 'Usta';
                if (level >= 50) rank_title = 'Elit';
                if (level >= 100) rank_title = 'Efsane';

                const metricCount = data.sales_role === 'closer'
                    ? closerMeetingCounts[agent_id] || 0
                    : sdrMeetingCounts[agent_id] || 0;

                return {
                    agent_id,
                    agent_name: data.name,
                    avatar_url: data.avatar_url,
                    processed_count: metricCount,
                    remaining_count: remainingCounts[agent_id] || 0,
                    streak: streak > 1 ? streak : 0,
                    speed_last_5min: last5MinActivities.length,
                    level,
                    sales_role: data.sales_role || 'sdr',
                    metric_label: data.sales_role === 'closer' ? 'toplantı sonucu' : 'toplantı organize',
                    rank_title, // Unified title
                    rank: 0, // Will be assigned below
                };
            })
            .sort((a, b) => b.processed_count - a.processed_count)
            .map((entry, index) => ({
                ...entry,
                rank: index + 1,
            }));

        // Get current user stats
        let currentUserStats = {
            processed_today: 0,
            total_assigned: 0,
            remaining: 0,
            streak: 0,
            speed_last_5min: 0,
            metric_label: 'toplantı organize',
        };

        if (agentId) {
            const userEntry = leaderboard.find(e => e.agent_id === agentId);
            const currentSalesRole = userEntry?.sales_role === 'closer' ? 'closer' : 'sdr';

            // Total assigned
            let totalQuery = supabase
                .from('leads')
                .select('*', { count: 'exact', head: true });
            if (!isGlobalRole(profile?.role) && profile?.market_id) {
                totalQuery = totalQuery.eq('market_id', profile.market_id);
            }

            totalQuery = currentSalesRole === 'closer'
                ? totalQuery.eq('closer_id', agentId)
                : totalQuery.eq('assigned_to', agentId);

            const { count: totalCount } = await totalQuery;

            // Remaining (pending)
            let remainingQuery = supabase
                .from('leads')
                .select('*', { count: 'exact', head: true });
            if (!isGlobalRole(profile?.role) && profile?.market_id) {
                remainingQuery = remainingQuery.eq('market_id', profile.market_id);
            }

            remainingQuery = currentSalesRole === 'closer'
                ? remainingQuery
                    .eq('closer_id', agentId)
                    .eq('meeting_status', 'scheduled')
                : remainingQuery
                    .eq('assigned_to', agentId)
                    .eq('status', 'pending');

            const { count: remainingCount } = await remainingQuery;

            currentUserStats = {
                processed_today: userEntry?.processed_count ?? 0,
                total_assigned: totalCount || 0,
                remaining: remainingCount || 0,
                streak: userEntry?.streak || 0,
                speed_last_5min: userEntry?.speed_last_5min || 0,
                metric_label: userEntry?.metric_label || 'toplantı organize',
            };
        }

        const sdrAppointments = leaderboard
            .filter((entry) => entry.sales_role !== 'closer')
            .reduce((total, entry) => total + entry.processed_count, 0);
        const closerOutcomes = leaderboard
            .filter((entry) => entry.sales_role === 'closer')
            .reduce((total, entry) => total + entry.processed_count, 0);
        console.info(
            `[StatsAPI] Success: agents=${leaderboard.length} sdrAppointments=${sdrAppointments} ` +
            `closerOutcomes=${closerOutcomes} marketScoped=${Boolean(marketId)}`
        );

        return NextResponse.json({
            leaderboard,
            currentUserStats,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch stats';
        console.error('Stats error:', error);
        return NextResponse.json(
            { message },
            { status: 500 }
        );
    }
}
