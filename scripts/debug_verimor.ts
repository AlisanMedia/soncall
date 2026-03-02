import fs from 'fs';
import path from 'path';

function loadEnv() {
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
}

loadEnv();

async function debugVerimor() {
    const username = process.env.VERIMOR_USERNAME;
    const password = process.env.VERIMOR_PASSWORD;
    const header = process.env.VERIMOR_HEADER;

    console.log('--- Verimor Debug ---');
    console.log('User:', username);
    console.log('Pass:', password ? '********' : 'MISSING');
    console.log('Header:', header || '(NONE)');

    const payload = {
        username,
        password,
        source_addr: header || undefined,
        messages: [
            {
                msg: 'Debug Test',
                dest: '905555555555'
            }
        ]
    };

    try {
        const response = await fetch('https://sms.verimor.com.tr/v2/send.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Status:', response.status, response.statusText);
        const text = await response.text();
        console.log('Response Body:', text);

        try {
            const json = JSON.parse(text);
            console.log('Parsed JSON:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Not a JSON response');
        }

    } catch (e: any) {
        console.error('Fetch Error:', e.message);
    }
}

debugVerimor();
