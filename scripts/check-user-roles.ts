
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

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
    } catch (e) { }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    console.log('Checking user roles...');

    // Check Alisan
    const { data: alisan } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', '%alisangul%')
        .limit(5);

    console.log('--- Founder/Manager User (Alisan) ---');
    console.table(alisan);

    // Check Efe
    const { data: efe } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', '%efebusiness%')
        .limit(5);

    console.log('--- Admin/Agent User (Efe) ---');
    console.table(efe);
}

checkUsers();
