
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- ENV LOADING ---
function loadEnv() {
    try {
        const envPaths = ['.env.local', '.env'];
        for (const envFile of envPaths) {
            const envPath = path.resolve(process.cwd(), envFile);
            if (fs.existsSync(envPath)) {
                console.log(`Loading env from ${envFile}`);
                const envConfig = fs.readFileSync(envPath, 'utf-8');
                envConfig.split('\n').forEach(line => {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        const trimmedKey = key.trim();
                        const trimmedValue = value.trim().replace(/^["'](.*)["']$/, '$1');
                        process.env[trimmedKey] = trimmedValue;
                    }
                });
                return;
            }
        }
    } catch (e) {
        console.error('Error loading env', e);
    }
}
loadEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Checking lead_activity_log table...');

    // 1. Count
    const { count, error: countError } = await supabase
        .from('lead_activity_log')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Count Error:', countError);
    } else {
        console.log(`Total rows in lead_activity_log: ${count}`);
    }

    // 2. Last 5 rows
    const { data: logs, error: logsError } = await supabase
        .from('lead_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (logsError) {
        console.error('Logs Error:', logsError);
    } else {
        console.log('--- Last 5 Activity Logs ---');
        console.log(JSON.stringify(logs, null, 2));
    }

    // 3. Last activity timestamp
    if (logs && logs.length > 0) {
        const lastTime = new Date(logs[0].created_at).toLocaleString();
        console.log(`Most recent activity: ${lastTime}`);
    } else {
        console.log('No logs found.');
    }
}

run();
