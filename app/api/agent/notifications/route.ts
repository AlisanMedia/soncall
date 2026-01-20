import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
    checkMilestones,
    checkStreak,
    generateEncouragement,
    checkSpeedRecord,
    AgentNotification
} from '@/lib/insights';

export async function GET() {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Get today's stats for the agent
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count: todayCount, error } = await supabase
            .from('lead_activity_log')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .eq('action', 'completed')
            .gte('created_at', todayStart.toISOString());

        if (error) throw error;

        // Simulate getting previous streak/stats from cache or DB properties
        // For now, we calculate streak from logs
        const { data: recentLogs } = await supabase
            .from('lead_activity_log')
            .select('created_at')
            .eq('agent_id', user.id)
            .eq('action', 'completed')
            .order('created_at', { ascending: false })
            .limit(20);

        // Calculate streak (leads processed within 5 mins of each other)
        let streak = 0;
        if (recentLogs && recentLogs.length > 0) {
            streak = 1;
            for (let i = 0; i < recentLogs.length - 1; i++) {
                const curr = new Date(recentLogs[i].created_at).getTime();
                const next = new Date(recentLogs[i + 1].created_at).getTime();
                if ((curr - next) < 5 * 60 * 1000) { // 5 minutes threshold
                    streak++;
                } else {
                    break;
                }
            }
        }

        // Checking for notifications
        const notifications: AgentNotification[] = [];

        // 1. Milestone Check
        const milestoneNotif = checkMilestones(todayCount || 0, (todayCount || 0) - 1);
        if (milestoneNotif) notifications.push(milestoneNotif);

        // 2. Streak Check
        const streakNotif = checkStreak(streak);
        if (streakNotif) notifications.push(streakNotif);

        // 3. Random Encouragement
        const encouragement = generateEncouragement(todayCount || 0);
        if (encouragement) notifications.push(encouragement);

        // Calculate speed (last 5 mins)
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const { count: speedCount } = await supabase
            .from('lead_activity_log')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .eq('action', 'completed')
            .gte('created_at', fiveMinsAgo.toISOString());

        // 4. Speed Record Check (simplified - just checks if high speed)
        if ((speedCount || 0) >= 5) { // 5 leads in 5 mins = 1 lead/min (very fast)
            const speedNotif = checkSpeedRecord(speedCount || 0, 4); // assume previous best was 4
            if (speedNotif) notifications.push(speedNotif);
        }

        return NextResponse.json({
            notifications,
            stats: {
                todayCount: todayCount || 0,
                streak,
                currentSpeed: speedCount || 0
            }
        });

    } catch (error: any) {
        console.error('Notification error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to check notifications' },
            { status: 500 }
        );
    }
}
