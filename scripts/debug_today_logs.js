
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:/soncall/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkToday() {
    console.log('Checking logs from 2026-03-02...');
    const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .gte('created_at', '2026-03-02T00:00:00Z')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Found ${data.length} logs from today.`);
        data.forEach(log => {
            console.log(`[${log.created_at}] To: ${log.sent_to} | Status: ${log.status} | Msg: ${log.message_body?.substring(0, 50)}...`);
        });
    }
}

checkToday();
