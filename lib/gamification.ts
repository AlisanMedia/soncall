
import { createClient } from '@supabase/supabase-js';

// Export client-safe utilities
export { getRankInfo, type RankInfo } from './gamification-utils';

// Use Service Role to bypass RLS and ensure we can update agent_progress
// THIS FILE SHOULD ONLY BE IMPORTED IN SERVER-SIDE CODE (API routes, server components)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);


export async function awardXP(agentId: string, amount: number, reason: string) {
    console.log(`[Gamification] Awarding ${amount} XP to ${agentId} for: ${reason}`);

    try {
        // 1. Fetch current progress
        const { data: progress, error: fetchError } = await supabaseAdmin
            .from('agent_progress')
            .select('*')
            .eq('agent_id', agentId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = Not found
            console.error('[Gamification] Error fetching progress:', fetchError);
            return;
        }

        let newTotalXP = amount;
        let currentStreak = 0;
        let lastActivityDate = new Date().toISOString().split('T')[0];

        if (progress) {
            newTotalXP = (progress.total_xp || 0) + amount;

            // Streak Logic
            const dbDate = progress.last_activity_date; // YYYY-MM-DD
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

            if (dbDate === today) {
                currentStreak = progress.current_streak; // Same day, keep streak
            } else if (dbDate === yesterday) {
                currentStreak = progress.current_streak + 1; // Consecutive day!
                // Bonus for keeping streak? Maybe handle separately or include in daily login logic
            } else {
                currentStreak = 1; // Reset
            }
        } else {
            // New entry
            currentStreak = 1;
        }

        // Calculate Level: 1000 XP per level
        // Level 1 = 0-999
        // Level 2 = 1000-1999
        // Level = floor(XP / 1000) + 1
        const newLevel = Math.max(1, Math.floor(newTotalXP / 1000) + 1);

        // 2. Upsert Progress
        const { error: upsertError } = await supabaseAdmin
            .from('agent_progress')
            .upsert({
                agent_id: agentId,
                total_xp: newTotalXP,
                current_level: newLevel,
                current_streak: currentStreak,
                last_activity_date: lastActivityDate,
                updated_at: new Date().toISOString()
            });

        if (upsertError) {
            console.error('[Gamification] Error updating progress:', upsertError);
        } else {
            console.log(`[Gamification] Success! Agent ${agentId} is now Level ${newLevel} (${newTotalXP} XP)`);
        }

    } catch (err) {
        console.error('[Gamification] Unexpected error:', err);
    }
}
