
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLogs() {
    console.log('Checking last 10 SMS Logs...');
    const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No logs found.');
        return;
    }

    data.forEach((msg: any) => {
        console.log(`[${msg.direction}] To/From: ${msg.sent_to} | Body: ${msg.message_body} | Time: ${msg.created_at}`);
    });
}

checkLogs();
