
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('profiles').select('id, full_name, role');
    if (data) {
        console.log('--- RAW ROLES ---');
        data.forEach(p => {
            console.log(`Name: ${p.full_name}, Role: [${p.role}], Type: ${typeof p.role}`);
        });
    }
}
check();
