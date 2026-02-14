import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoinLess() {
    console.log('=== Testing JOIN-less Query ===');

    // Test 1: Simple query without JOINs
    console.log('\n1. Fetching lead_activity_log without JOINs...');
    const { data: simpleData, error: simpleError } = await supabase
        .from('lead_activity_log')
        .select('id, action, created_at, agent_id, lead_id')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log('Result:', simpleError ? 'ERROR' : 'SUCCESS');
    console.log('Error:', simpleError);
    console.log('Count:', simpleData?.length);
    console.log('Sample:', simpleData?.[0]);

    // Test 2: Query with profiles JOIN only
    console.log('\n2. Testing profiles JOIN...');
    const { data: profileData, error: profileError } = await supabase
        .from('lead_activity_log')
        .select('id, profiles(full_name)')
        .limit(5);

    console.log('Result:', profileError ? 'ERROR' : 'SUCCESS');
    console.log('Error:', profileError);
    console.log('Count:', profileData?.length);
    console.log('Sample:', profileData?.[0]);

    // Test 3: Query with leads JOIN only
    console.log('\n3. Testing leads JOIN...');
    const { data: leadData, error: leadError } = await supabase
        .from('lead_activity_log')
        .select('id, leads(business_name)')
        .limit(5);

    console.log('Result:', leadError ? 'ERROR' : 'SUCCESS');
    console.log('Error:', leadError);
    console.log('Count:', leadData?.length);
    console.log('Sample:', leadData?.[0]);

    // Test 4: Full JOIN (as in API)
    console.log('\n4. Testing FULL JOIN (as in API)...');
    const { data: fullData, error: fullError } = await supabase
        .from('lead_activity_log')
        .select(`
            id,
            action,
            created_at,
            profiles(full_name, avatar_url),
            leads(business_name, phone_number)
        `)
        .limit(5);

    console.log('Result:', fullError ? 'ERROR' : 'SUCCESS');
    console.log('Error:', fullError);
    console.log('Count:', fullData?.length);
    console.log('Sample:', JSON.stringify(fullData?.[0], null, 2));
}

testJoinLess().catch(console.error);
