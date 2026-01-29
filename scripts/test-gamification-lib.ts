
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mock the backend client since we are in a script
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Copy of awardXP to avoid module resolution issues in simple script
async function awardXP(agentId: string, amount: number, reason: string) {
    console.log(`[Test] Awarding ${amount} XP to ${agentId} for: ${reason}`);

    try {
        const { data: progress, error: fetchError } = await supabaseAdmin
            .from('agent_progress')
            .select('*')
            .eq('agent_id', agentId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching:', fetchError);
            return;
        }

        let newTotalXP = (progress?.total_xp || 0) + amount;
        let newLevel = Math.max(1, Math.floor(newTotalXP / 1000) + 1);

        console.log(`Current XP: ${progress?.total_xp} -> New XP: ${newTotalXP}`);
        console.log(`Current Level: ${progress?.current_level} -> New Level: ${newLevel}`);

        const { error: upsertError } = await supabaseAdmin
            .from('agent_progress')
            .upsert({
                agent_id: agentId,
                total_xp: newTotalXP,
                current_level: newLevel,
                updated_at: new Date().toISOString()
            });

        if (upsertError) console.error('Upsert Error:', upsertError);
        else console.log('✅ XP Awarded Successfully!');

    } catch (err) {
        console.error(err);
    }
}

async function runTest() {
    // 1. Find Efe
    const { data: users } = await supabaseAdmin.from('profiles').select('id').ilike('full_name', '%efe şanlıbaba%').single();
    if (!users) {
        console.log('User not found');
        return;
    }

    // 2. Award Test XP
    await awardXP(users.id, 10, 'Test Call Trigger');
}

runTest();
