
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkActivityCount() {
    try {
        const { count, error } = await supabase
            .from('lead_activity_log')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Error counting activities:', error);
            return;
        }

        console.log(`Total activities in 'lead_activity_log': ${count}`);

        // Also fetch the last 5 to see if they look correct
        const { data: last5, error: fetchError } = await supabase
            .from('lead_activity_log')
            .select('id, action, created_at, agent_id, lead_id')
            .order('created_at', { ascending: false })
            .limit(5);

        if (fetchError) {
            console.error('Error fetching last 5:', fetchError);
        } else {
            console.log('Last 5 activities:', last5);
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkActivityCount();
