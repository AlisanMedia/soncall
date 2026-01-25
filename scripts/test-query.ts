
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

async function testQuery() {
    console.log('Testing specific API query...');

    // Exact query from route.ts
    const { data, error } = await supabase
        .from('leads')
        .select(`
            id,
            business_name,
            appointment_date,
            status,
            processed_at,
            assigned_to
        `)
        .or('appointment_date.not.is.null,status.eq.appointment');

    if (error) {
        console.error('Query Error:', error);
        return;
    }

    console.log(`Query returned ${data?.length} records.`);

    if (data && data.length > 0) {
        // Check date logic
        const appointments = data.map(lead => {
            const dateStr = lead.appointment_date || lead.processed_at || new Date().toISOString();
            return {
                id: lead.id,
                name: lead.business_name,
                original_date: lead.appointment_date,
                processed_at: lead.processed_at,
                final_date: dateStr,
                status: lead.status
            };
        });

        console.table(appointments.slice(0, 10)); // Show first 10
    }
}

testQuery();
