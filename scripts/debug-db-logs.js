
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLogs() {
    console.log('Checking INBOUND SMS Logs...');
    const { data, error } = await supabase
        .from('sms_logs')
        .select('id, sent_to, message_body, direction, created_at')
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No INBOUND logs found.');
        return;
    }

    console.log(`Found ${data.length} inbound logs:`);
    data.forEach(msg => {
        console.log(`ID: ${msg.id} | To: ${msg.sent_to} | Body: ${msg.message_body}`);
    });
}

checkLogs();
