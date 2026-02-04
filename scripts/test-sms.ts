import fs from 'fs';
import path from 'path';
import https from 'https'; // Using native https or fetch if available (Node 18+)

// 1. Env Loading
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

// 2. Utils Mock
function normalizePhone(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('90') && clean.length === 12) return '+' + clean;
    if (clean.startsWith('0') && clean.length === 11) return '+90' + clean.substring(1);
    if (clean.length === 10) return '+90' + clean;
    return phone.startsWith('+') ? phone : '+' + clean;
}

// 3. sendSMS logic (Copy of lib/sms.ts to test logic + credentials)
async function sendSMS(phone: string, message: string) {
    const username = process.env.VERIMOR_USERNAME;
    const password = process.env.VERIMOR_PASSWORD;
    const header = process.env.VERIMOR_HEADER;

    console.log(`Debug - Creds: User=${username ? '***' : 'MISSING'}, Pass=${password ? '***' : 'MISSING'}, Header=${header || 'NONE'}`);

    if (!username || !password) {
        console.error('[SMS] VERIMOR_USERNAME or VERIMOR_PASSWORD not set');
        return false;
    }

    let cleanPhone = normalizePhone(phone);
    if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1);
    }
    cleanPhone = cleanPhone.replace(/[^0-9]/g, '');

    console.log(`Sending to Verimor API... Dest: ${cleanPhone}`);

    try {
        const payload = {
            username,
            password,
            source_addr: header || undefined,
            messages: [
                {
                    msg: message,
                    dest: cleanPhone
                }
            ]
        };

        const response = await fetch('https://sms.verimor.com.tr/v2/send.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log(`[SMS] Response Status: ${response.status}`);
        console.log(`[SMS] Response Body: ${responseText}`);

        return response.ok;

    } catch (e: any) {
        console.error('[SMS] Network/System Error:', e.message);
        return false;
    }
}

// 4. Run
async function run() {
    const testPhone = '905555555555'; // Invalid but good format
    console.log(`Sending test SMS to ${testPhone}...`);
    await sendSMS(testPhone, 'Verimor API Test Mesajıdır.');
}

run();
