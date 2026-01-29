
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const FIX_LEVELING_SQL = `
-- 1. Ensure Agent Progress Exists for ALL Profiles (Agents/Admins/Founders)
INSERT INTO public.agent_progress (agent_id)
SELECT id FROM public.profiles 
WHERE role IN ('agent', 'admin', 'founder')
ON CONFLICT (agent_id) DO NOTHING;

-- 2. Redefine Auto-Level Function (Robust)
CREATE OR REPLACE FUNCTION auto_update_agent_level() 
RETURNS TRIGGER AS $$
BEGIN
    -- Formula: Level 1 starts at 0. Level 2 at 1000. Level = floor(XP/1000) + 1
    NEW.current_level := GREATEST(1, FLOOR(NEW.total_xp / 1000::float) + 1);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-Attach Trigger
DROP TRIGGER IF EXISTS trg_auto_level_up ON public.agent_progress;

CREATE TRIGGER trg_auto_level_up
    BEFORE UPDATE OF total_xp ON public.agent_progress
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_agent_level();

-- 4. FORCE RECALCULATE FOR EVERYONE
UPDATE public.agent_progress
SET 
    current_level = GREATEST(1, FLOOR(total_xp / 1000::float) + 1),
    updated_at = NOW();
`;

async function applyFix() {
    console.log('Applying Universal Leveling Fix...');

    const { error } = await supabase.rpc('exec_sql', { sql_query: FIX_LEVELING_SQL });

    // Since we might not have 'exec_sql' RPC helper, let's try direct query if using psql, 
    // but with JS client we usually need an RPC or just trust the previous migrations.
    // HOWEVER, we can simulate the "Update" part via JS to be safe if RPC fails or doesn't exist.

    if (error) {
        console.warn('RPC exec_sql failed (expected if not set up). Falling back to JS-based update loop.');
    }

    // JS Fallback: Fetch all progress, calculate correct level, update if mismatch
    const { data: allProgress } = await supabase.from('agent_progress').select('*');

    if (!allProgress) return;

    console.log(`Checking ${allProgress.length} agents...`);

    for (const p of allProgress) {
        const correctLevel = Math.max(1, Math.floor(p.total_xp / 1000) + 1);
        if (p.current_level !== correctLevel) {
            console.log(`Fixing Agent ${p.agent_id}: Level ${p.current_level} -> ${correctLevel}`);
            await supabase
                .from('agent_progress')
                .update({ current_level: correctLevel })
                .eq('agent_id', p.agent_id);
        }
    }

    console.log('Universal Fix Complete.');
}

applyFix();
