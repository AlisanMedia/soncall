
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
    try {
        const envPaths = ['.env.local', '.env'];
        for (const envFile of envPaths) {
            const envPath = path.resolve(process.cwd(), envFile);
            if (fs.existsSync(envPath)) {
                console.log(`Loading env from ${envFile}`);
                const envConfig = fs.readFileSync(envPath, 'utf-8');
                envConfig.split('\n').forEach(line => {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        const trimmedKey = key.trim();
                        const trimmedValue = value.trim().replace(/^["'](.*)["']$/, '$1'); // Remove quotes
                        process.env[trimmedKey] = trimmedValue;
                    }
                });
                return; // Stop after first successful load
            }
        }
        console.log('No .env file found');
    } catch (e) {
        console.error('Error loading env', e);
    }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    console.log('Available keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAppointments() {
    console.log('Checking appointments...');

    // Check 1: Leads with status 'appointment'
    const { data: statusAppointments, error: error1 } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'appointment')
        .limit(1);

    if (error1) console.error('Error 1:', error1);
    else if (statusAppointments.length > 0) {
        const lead = statusAppointments[0];
        console.log(`Checking Activity Log for Lead: ${lead.id}`);

        const { data: logs, error: logError } = await supabase
            .from('lead_activity_log')
            .select('*')
            .eq('lead_id', lead.id)
            .limit(1);

        if (logError) console.error('Log Error:', logError);
        else if (logs.length > 0) {
            console.log('Activity Log Keys:', Object.keys(logs[0]));
            console.log('Sample Log:', logs[0]);
        }

        console.log(`Checking Lead Notes for Lead: ${lead.id}`);

        const { data: notes, error: noteError } = await supabase
            .from('lead_notes')
            .select('*')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false });

        if (noteError) console.error('Note Error:', noteError);
        else if (notes && notes.length > 0) {
            console.log(`Found ${notes.length} notes.`);
            notes.forEach(n => {
                console.log(`[${n.created_at}] Action: ${n.action_taken}`);
                console.log(`Note: "${n.note}"`);
                console.log('---');
            });
        } else {
            console.log('No notes found for this lead.');
        }
    } else {
        console.log('No leads found.');
    }
}

checkAppointments();
