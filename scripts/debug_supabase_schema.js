
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeads() {
    console.log("Checking Supabase connection to:", supabaseUrl);
    
    // Try a simple select first
    const { data: simpleData, error: simpleError } = await supabase
        .from('leads')
        .select('id')
        .limit(1);
        
    if (simpleError) {
        console.error("Simple Select Error:", simpleError);
    } else {
        console.log("Simple Select Success. Row count sample:", simpleData?.length);
    }

    // Try the complex select with our new fields
    const { data, error } = await supabase
        .from('leads')
        .select('id, business_name, potential_level, ai_summary')
        .limit(1);

    if (error) {
        console.error("CRM Query Error (Potential Schema Issue):", error);
        if (error.message.includes('ai_summary')) {
            console.log("CONFIRMED: ai_summary column is missing!");
        }
    } else {
        console.log("CRM Query Success:", data);
    }
}

checkLeads();
