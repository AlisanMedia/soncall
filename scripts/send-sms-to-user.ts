
import { createClient } from '@supabase/supabase-js';
// import { sendSMS } from '../lib/sms'; // Removed to avoid resolution issues
import fs from 'fs';
import path from 'path';
import https from 'https';

// Manual Env Load
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf-8');
            envConfig.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    process.env[key.trim()] = value.trim().replace(/^["'](.*)["']$/, '$1');
                }
            });
        }
    } catch (e) {
        console.error('Error loading env', e);
    }
}

loadEnv();

// Mock normalizePhone locally to avoid import issues if any (safer for script)
function normalizePhone(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('90') && clean.length === 12) return '+' + clean;
    if (clean.startsWith('0') && clean.length === 11) return '+90' + clean.substring(1);
    if (clean.length === 10) return '+90' + clean;
    return phone.startsWith('+') ? phone : '+' + clean;
}

// Redefine sendSMS to ensure it works in this context without module resolution headaches
async function sendSMSLocal(phone: string, message: string) {
    const username = process.env.VERIMOR_USERNAME;
    const password = process.env.VERIMOR_PASSWORD;
    const header = process.env.VERIMOR_HEADER;

    if (!username || !password) {
        console.error('[SMS] Missing Credentials');
        return false;
    }

    let cleanPhone = normalizePhone(phone);
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
    cleanPhone = cleanPhone.replace(/[^0-9]/g, '');

    console.log(`Sending SMS to: ${cleanPhone}`);

    const payload = {
        username,
        password,
        source_addr: header || undefined,
        messages: [{ msg: message, dest: cleanPhone }]
    };

    try {
        const response = await fetch('https://sms.verimor.com.tr/v2/send.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log(`API Response (${response.status}):`, text);
        return response.ok;
    } catch (e: any) {
        console.error('API Error:', e.message);
        return false;
    }
}

async function run() {
    console.log('Connecting to Supabase...');
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const targetName = 'Alişan Gül';
    console.log(`Searching for user: ${targetName}...`);

    const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${targetName}%`);

    if (error) {
        console.error('Database Error:', error.message);
        return;
    }

    if (!users || users.length === 0) {
        console.error('❌ User not found!');
        return;
    }

    const user = users[0];
    console.log(`Found User: ${user.full_name} (${user.email})`);

    if (!user.phone_number) {
        console.error('❌ User has no phone number defined in profiles!');
        return;
    }

    console.log(`Phone: ${user.phone_number}`);

    await sendSMSLocal(user.phone_number, `Sn. ${user.full_name}, bu bir test mesajıdır. Verimor entegrasyonu başarılı.`);
}

run();
