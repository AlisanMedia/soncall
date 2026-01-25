
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
    const { data, error } = await supabase
        .from('leads')
        .select('id, business_name, appointment_date, assigned_to')
        .not('appointment_date', 'is', null)
        .order('appointment_date', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} appointments.`);
    if (data.length > 0) {
        data.slice(0, 5).forEach(apt => {
            console.log(`${apt.appointment_date} - ${apt.business_name} (${apt.id})`);
        });
    } else {
        console.log('No appointments found.');
    }
}

checkAppointments();
