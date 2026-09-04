
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
    console.log("Checking distinct categories in leads table...");
    
    // Fetch all categories (limited to 10000 for safety, but we want to see variety)
    const { data, error } = await supabase
        .from('leads')
        .select('category');

    if (error) {
        console.error("Error fetching leads:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No leads found in the database.");
        return;
    }

    const uniqueCategories = new Set(data.map(l => l.category || 'Belirsiz'));
    console.log("Unique Categories found:", Array.from(uniqueCategories));
    console.log("Total leads checked:", data.length);
}

checkCategories();
