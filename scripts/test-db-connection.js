
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing with URL:', supabaseUrl);
console.log('Testing with Key prefix:', supabaseKey?.substring(0, 10));

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    try {
        console.log('Attempting to insert test log...');
        const { data, error } = await supabase.from('sms_logs').insert({
            sent_to: '905051710841',
            message_body: 'DEBUG TEST LOG ' + new Date().toISOString(),
            status: 'success',
            direction: 'outbound',
            trigger_type: 'manual'
        }).select();

        if (error) {
            console.error('Insert Error:', error);
        } else {
            console.log('Insert Success! Data:', data);
        }
    } catch (e) {
        console.error('System Error:', e);
    }
}

test();
