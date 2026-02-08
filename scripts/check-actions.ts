
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkActions() {
    try {
        const { data, error } = await supabase
            .from('lead_activity_log')
            .select('action');

        if (error) {
            console.error('Error fetching actions:', error);
            return;
        }

        const distinctActions = [...new Set(data.map(d => d.action))];
        console.log('Distinct actions:', distinctActions);

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkActions();
