
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (data) {
        console.log('--- DETAILED LOGS ---');
        data.forEach(log => {
            console.log(`ID: ${log.id}`);
            console.log(`Original To: "${log.sent_to}" (Length: ${log.sent_to.length})`);
            console.log(`Direction: ${log.direction}`);
            console.log(`Trigger: ${log.trigger_type}`);
            console.log(`Created: ${log.created_at}`);
            console.log('---');
        });
    }
}

checkLogs();
