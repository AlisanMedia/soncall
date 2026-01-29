
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkAgent() {
    console.log('Searching for "Efe"...');

    const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%efe%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found users:', users);

    // Also check all agents count
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'agent');
    console.log('Total users with role="agent":', count);
}

checkAgent();
