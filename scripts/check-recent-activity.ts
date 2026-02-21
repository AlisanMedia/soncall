
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Manual env loading
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
                        let trimmedValue = value.trim();
                        if ((trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
                            (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))) {
                            trimmedValue = trimmedValue.slice(1, -1);
                        }
                        process.env[trimmedKey] = trimmedValue;
                    }
                });
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
    console.log('Checking recent activity logs...');

    const { data: logs, error } = await supabase
        .from('lead_activity_log')
        .select(`
            id,
            action,
            created_at,
            metadata,
            agent_id,
            profiles (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching logs:', error);
    } else {
        console.log(`Found ${logs.length} recent logs:`);
        (logs as any[]).forEach(log => {
            const profiles = log.profiles;
            const agentName = profiles ? (Array.isArray(profiles) ? profiles[0]?.full_name : (profiles as any).full_name) : 'Unknown';
            console.log(`[${new Date(log.created_at).toLocaleString()}] ${agentName} - ${log.action}`);
            console.log(`   Metadata:`, JSON.stringify(log.metadata || {}));
        });
    }
}

run();
