
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debugLeveling() {
    console.log('--- Leveling Debugger ---');

    // 1. Find Efe
    const { data: users } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%efe şanlıbaba%').single();

    if (!users) {
        console.log('User Efe not found');
        return;
    }

    const agentId = users.id;
    console.log(`Agent: ${users.full_name} (${agentId})`);

    // 2. Get Progress
    const { data: progress, error } = await supabase
        .from('agent_progress')
        .select('*')
        .eq('agent_id', agentId)
        .single();

    if (error) {
        console.error('Error fetching progress:', error);
    } else {
        console.log('Current Progress:', progress);

        // Check if level matches XP
        const calculatedLevel = Math.max(1, Math.floor((progress?.total_xp || 0) / 1000) + 1);
        console.log(`Calculated Level based on XP: ${calculatedLevel}`);
        console.log(`Database Level: ${progress?.current_level}`);

        if (calculatedLevel !== progress?.current_level) {
            console.warn('MISMATCH DETECTED: Level should be updated.');
        } else {
            console.log('Level is correct based on XP.');
        }
    }

    // 3. Check for recent approved sales/calls that SHOULD have given XP
    // This helps us see if events are happening but not triggering XP
    // (Assuming 'sales' table or 'leads' status updates count)
}

debugLeveling();
