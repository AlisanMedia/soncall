
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
    console.log('--- DIAGNOSTIC START ---');
    const log = (msg: string) => process.stdout.write(msg + '\n');

    // 1. Check Profiles and Roles
    log('\n1. Checking Users & Profiles:');
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role');

    if (profileError) {
        console.error('Error fetching profiles:', profileError);
    } else {
        log('PROFILES_START');
        log(JSON.stringify(profiles, null, 2));
        log('PROFILES_END');
        const managers = profiles?.filter(p => p.role === 'manager' || p.role === 'admin' || p.role === 'founder');
        log(`Found ${managers?.length} privileged users.`);
    }

    // 2. Check Activity Log Data
    log('\n2. Checking Lead Activity Log:');
    const { count, error: countError } = await supabase
        .from('lead_activity_log')
        .select('*', { count: 'exact', head: true });

    if (countError) console.error('Error counting logs:', countError);
    log(`Total Activity Rows: ${count}`);

    const { data: logs, error: logsError } = await supabase
        .from('lead_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (logsError) {
        console.error('Error fetching logs:', logsError);
    } else {
        log('LOGS_START');
        log(JSON.stringify(logs, null, 2));
        log('LOGS_END');
    }

    // 3. Check Leads (referenced in logs)
    if (logs && logs.length > 0) {
        log('\n3. Checking Referenced Leads (for latest logs):');
        const leadIds = logs.map(l => l.lead_id);
        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('id, business_name, assigned_to')
            .in('id', leadIds);

        if (leadsError) console.error(leadsError);
        else {
            log('LEADS_START');
            log(JSON.stringify(leads, null, 2));
            log('LEADS_END');
        }
    }

    // 4. Test RLS Bypass Simulation (Checking direct fetch vs what user might see)
    // Note: We are using service role here, so we see everything.
    // If we see data here, but user doesn't, it is 100% RLS or Auth.

    console.log('--- DIAGNOSTIC END ---');
}

diagnose().catch(console.error);
