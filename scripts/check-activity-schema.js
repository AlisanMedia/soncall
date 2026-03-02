
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('Checking lead_activity_log structure...');
    const { data, error } = await supabase
        .from('lead_activity_log')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching from lead_activity_log:', error.message);
        if (error.message.includes('column "ai_summary" does not exist')) {
            console.log('CONFIRMED: ai_summary is missing.');
        }
    } else {
        console.log('Success fetching (maybe columns exist now?):', data);
    }
}

checkTable();
