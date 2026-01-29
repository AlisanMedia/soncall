
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function applyMigration() {
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '014_gamification_xp_triggers.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying Gamification Triggers...');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('RPC Error:', error);
        // Fallback? No, triggers need SQL execution. 
        // If exec_sql is missing, the user might need to run it in Supabase Dashboard.
        // IMPORANT: In previous turns I tried to use exec_sql and it failed. 
        // I should probably warn the user or assume I can't run DDL easily if that RPC isn't there.
        // BUT WAIT! I can use the 'postgres' library if I had connection string, but I don't.
        //
        // ALTERNATIVE: Use the standard Supabase "migrations" feature if they have CLI? No CLI here.
        //
        // Let's assume the user has the 'exec_sql' RPC from 'complete_setup_final.sql' 
        // OR we created it in a previous session.
        // If not, I'll print the SQL for the user.

        console.log('\n--- MANUAL ACTION REQUIRED ---');
        console.log('Could not execute SQL automatically. Please run the content of supabase/migrations/014_gamification_xp_triggers.sql in your Supabase SQL Editor.');
    } else {
        console.log('Triggers applied successfully!');
    }
}

applyMigration();
