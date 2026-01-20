import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agentId');

        // Get today's start
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get 5 minutes ago
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        // Get leaderboard - agents with their processed count today
        const { data: leaderboardData, error: leaderboardError } = await supabase
            .from('lead_activity_log')
            .select(`
        agent_id,
        created_at,
        profiles!lead_activity_log_agent_id_fkey (
          full_name
        )
      `)
            .eq('action', 'completed')
            .gte('created_at', today.toISOString());

        if (leaderboardError) throw leaderboardError;

        // Get all agents and their remaining leads
        const { data: allAgents, error: agentsError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'agent');

        if (agentsError) throw agentsError;

        // Aggregate counts per agent
        const agentStats: Record<string, {
            name: string;
            count: number;
            activities: Date[];
        }> = {};

        // Initialize all agents
        allAgents?.forEach((agent: any) => {
            agentStats[agent.id] = {
                name: agent.full_name,
                count: 0,
                activities: [],
            };
        });

        // Count processed leads
        leaderboardData?.forEach((log: any) => {
            const id = log.agent_id;
            if (agentStats[id]) {
                agentStats[id].count++;
                agentStats[id].activities.push(new Date(log.created_at));
            }
        });

        // Get remaining leads for each agent
        const { data: remainingLeads, error: remainingError } = await supabase
            .from('leads')
            .select('assigned_to')
            .eq('status', 'pending');

        if (remainingError) throw remainingError;

        const remainingCounts: Record<string, number> = {};
        remainingLeads?.forEach((lead: any) => {
            if (lead.assigned_to) {
                remainingCounts[lead.assigned_to] = (remainingCounts[lead.assigned_to] || 0) + 1;
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

                // Calculate speed (leads in last 5   minutes)
                const last5MinActivities = data.activities.filter(
                    a => a.getTime() > fiveMinutesAgo.getTime()
                );

                return {
                    agent_id,
                    agent_name: data.name,
                    processed_count: data.count,
                    remaining_count: remainingCounts[agent_id] || 0,
                    streak: streak > 1 ? streak : 0,
                    speed_last_5min: last5MinActivities.length,
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
        };

        if (agentId) {
            const userEntry = leaderboard.find(e => e.agent_id === agentId);

            // Processed today
            const { count: processedCount } = await supabase
                .from('lead_activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agentId)
                .eq('action', 'completed')
                .gte('created_at', today.toISOString());

            // Total assigned
            const { count: totalCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', agentId);

            // Remaining (pending)
            const { count: remainingCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', agentId)
                .eq('status', 'pending');

            currentUserStats = {
                processed_today: processedCount || 0,
                total_assigned: totalCount || 0,
                remaining: remainingCount || 0,
                streak: userEntry?.streak || 0,
                speed_last_5min: userEntry?.speed_last_5min || 0,
            };
        }

        return NextResponse.json({
            leaderboard,
            currentUserStats,
        });

    } catch (error: any) {
        console.error('Stats error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
