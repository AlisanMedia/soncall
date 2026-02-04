
import fs from 'fs';
import path from 'path';
import https from 'https';

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

async function checkBalance() {
    const username = process.env.VERIMOR_USERNAME;
    const password = process.env.VERIMOR_PASSWORD;

    console.log(`Checking Verimor Balance for User: ${username}`);

    if (!username || !password) {
        console.error('❌ Missing credentials in .env.local');
        return;
    }

    const url = `https://sms.verimor.com.tr/v2/balance?username=${username}&password=${password}`;

    try {
        const response = await fetch(url);
        const text = await response.text();

        console.log(`\n--- Balance Check ---`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${text}`);

        if (response.ok) {
            console.log('✅ Balance check successful! Credentials are correct.');
            return true;
        } else {
            console.log('❌ Balance check failed. Credentials might be wrong.');
            return false;
        }

    } catch (e: any) {
        console.error('Error checking balance:', e.message);
        return false;
    }
}

async function checkHeaders() {
    const username = process.env.VERIMOR_USERNAME;
    const password = process.env.VERIMOR_PASSWORD;

    const url = `https://sms.verimor.com.tr/v2/headers?username=${username}&password=${password}`;

    try {
        const response = await fetch(url);
        const text = await response.text();

        console.log(`\n--- Available Headers ---`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${text}`);

        if (response.ok) {
            console.log('✅ Retrieved headers successfully.');
        } else {
            console.log('❌ Failed to retrieve headers.');
        }

    } catch (e: any) {
        console.error('Error checking headers:', e.message);
    }
}

async function run() {
    const balanceOk = await checkBalance();
    if (balanceOk) {
        await checkHeaders();
    }
}

run();
