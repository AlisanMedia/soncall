
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('Checking if sms_logs table exists...');
    const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error checking sms_logs:', error.message);
    } else {
        console.log('Success! sms_logs table is accessible.');
        console.log('Row count check (limit 1):', data.length);
    }
}

checkTable();
