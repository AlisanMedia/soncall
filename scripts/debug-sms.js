
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Environment variables missing!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    console.log('Checking last 20 sms_logs...');
    const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log('--- LAST 20 LOGS ---');
    data.forEach(log => {
        console.log(`[${log.created_at}] To: ${log.sent_to} | Status: ${log.status} | Dir: ${log.direction} | Body: ${log.message_body.substring(0, 30)}...`);
    });
    console.log('--------------------');
}

checkLogs();
