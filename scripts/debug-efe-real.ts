
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkEfe() {
    console.log('Searching for "Efe Şanlıbaba"...');

    const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%efe şanlıbaba%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found users:', users);
}

checkEfe();
