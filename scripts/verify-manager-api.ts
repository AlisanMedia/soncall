
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// Environment variables loader
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf-8');
            envConfig.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
                }
            });
        }
    } catch (e) { console.error('Env load error', e); }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminClient = createClient(supabaseUrl, supabaseKey);

async function testActivityFetch() {
    console.log('--- TESTING MANAGER ACTIVITY API LOGIC ---');

    // 1. Fetch IDs (Simulating pagination)
    console.log('Fetching latest 10 activity IDs...');
    const { data: activityIds, error: idsError } = await adminClient
        .from('lead_activity_log')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .range(0, 9); // Limit 10 for test

    if (idsError) {
        console.error('❌ ID Fetch Error:', idsError);
        return;
    }

    if (!activityIds || activityIds.length === 0) {
        console.log('⚠️ No activity logs found at all.');
        return;
    }

    console.log(`✅ Found ${activityIds.length} activity IDs.`);
    const uniqueIds = [...new Set(activityIds.map(a => a.id))];

    // 2. Fetch Details (Simulating JOINs)
    console.log('Fetching details for these IDs...');
    const { data: activities, error: detailsError } = await adminClient
        .from('lead_activity_log')
        .select(`
            id,
            action,
            created_at,
            metadata,
            agent_id,
            lead_id,
            profiles (full_name),
            leads (business_name, status)
        `)
        .in('id', uniqueIds)
        .order('created_at', { ascending: false });

    if (detailsError) {
        console.error('❌ Details Fetch Error:', detailsError);
        return;
    }

    console.log(`✅ Successfully fetched ${activities?.length} detailed activities.`);

    // Display result sample
    activities?.forEach((a, i) => {
        const agent = Array.isArray(a.profiles) ? a.profiles[0]?.full_name : a.profiles?.full_name;
        const lead = Array.isArray(a.leads) ? a.leads[0]?.business_name : a.leads?.business_name;
        console.log(`${i + 1}. [${a.action}] Agent: ${agent} -> Lead: ${lead} (${a.created_at})`);
    });

    console.log('--- TEST FINISHED ---');
}

testActivityFetch();
