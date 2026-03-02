
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log('--- DATABASE SCHEMA AUDIT ---');

    const checks = [
        { table: 'leads', columns: ['lead_number', 'reminder_5h_sent', 'reminder_1h_sent'] },
        { table: 'profiles', columns: ['tc_number', 'avatar_url', 'commission_rate'] },
        { table: 'sms_logs', columns: ['direction', 'contact_id', 'is_read'] },
        { table: 'lead_activity_log', columns: ['ai_summary', 'ai_score'] }
    ];

    for (const check of checks) {
        console.log(`Checking ${check.table}...`);
        const { data, error } = await supabase.from(check.table).select('*').limit(1);

        if (error) {
            console.error(`  [ERROR] ${check.table}: ${error.message}`);
        } else if (data && data.length > 0) {
            const keys = Object.keys(data[0]);
            check.columns.forEach(col => {
                if (keys.includes(col)) {
                    console.log(`  [OK] ${check.table}.${col} exists.`);
                } else {
                    console.log(`  [MISSING] ${check.table}.${col} NOT FOUND.`);
                }
            });
        } else {
            console.log(`  [EMPTY] ${check.table} is empty, cannot verify columns easily via select *`);
        }
    }
}

checkColumns();
