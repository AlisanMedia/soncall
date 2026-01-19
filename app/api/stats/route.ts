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

        // Get leaderboard - agents with their processed count today
        const { data: leaderboardData, error: leaderboardError } = await supabase
            .from('lead_activity_log')
            .select(`
        agent_id,
        profiles!lead_activity_log_agent_id_fkey (
          full_name
        )
      `)
            .eq('action', 'completed')
            .gte('created_at', today.toISOString());

        if (leaderboardError) throw leaderboardError;

        // Aggregate counts per agent
        const agentCounts: Record<string, { name: string; count: number }> = {};

        leaderboardData?.forEach((log: any) => {
            const id = log.agent_id;
            if (!agentCounts[id]) {
                agentCounts[id] = {
                    name: log.profiles?.full_name || 'Unknown',
                    count: 0,
                };
            }
            agentCounts[id].count++;
        });

        // Convert to array and sort
        const leaderboard = Object.entries(agentCounts)
            .map(([agent_id, data]) => ({
                agent_id,
                agent_name: data.name,
                processed_count: data.count,
                rank: 0, // Will be assigned below
            }))
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
        };

        if (agentId) {
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
