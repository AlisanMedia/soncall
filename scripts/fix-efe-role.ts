
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fixAgentRole() {
    console.log('Fixing role for Efe niyır...');

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'agent' })
        .ilike('full_name', '%efe niyır%')
        .select();

    if (error) {
        console.error('Error updating role:', error);
    } else {
        console.log('Updated user:', data);
    }
}

fixAgentRole();
