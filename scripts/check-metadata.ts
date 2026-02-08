
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMetadata() {
    try {
        const { data, error } = await supabase
            .from('lead_activity_log')
            .select('*')
            .eq('action', 'call_recording')
            .limit(5);

        if (error) {
            console.error('Error fetching activities:', error);
            return;
        }

        console.log('Call Recording Metadata:');
        if (!data || data.length === 0) {
            console.log('No call recordings found.');
            return;
        }

        data.forEach(log => {
            console.log(`ID: ${log.id}, Metadata:`, JSON.stringify(log.metadata, null, 2));
        });

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkMetadata();
