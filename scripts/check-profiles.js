
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    console.log('Checking all profiles and their roles...');
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log('--- PROFILES ---');
    data.forEach(p => {
        console.log(`- ${p.full_name} (${p.email}) | Role: ${p.role} | ID: ${p.id}`);
    });
    console.log('----------------');
}

checkProfiles();
