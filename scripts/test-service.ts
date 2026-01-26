
import { sendEmail } from '../lib/email/service';
import fs from 'fs';
import path from 'path';

// Mock env loading manually since we are running isolated script
function loadEnv() {
    try {
        const envPaths = ['.env.local', '.env'];
        for (const envFile of envPaths) {
            const envPath = path.resolve(process.cwd(), envFile);
            if (fs.existsSync(envPath)) {
                // console.log(`Loading env from ${envFile}`);
                const envConfig = fs.readFileSync(envPath, 'utf-8');
                envConfig.split('\n').forEach(line => {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        const trimmedKey = key.trim();
                        const trimmedValue = value.trim().replace(/^["'](.*)["']$/, '$1');
                        process.env[trimmedKey] = trimmedValue;
                    }
                });
            }
        }
    } catch (e) {
        console.error('Error loading env', e);
    }
}

loadEnv();

async function run() {
    console.log('Testing sendEmail service...');
    const result = await sendEmail({
        to: ['random@example.com'], // Should fail due to verification
        subject: 'Service Test',
        html: '<p>Test</p>'
    });

    console.log('Result:', JSON.stringify(result, null, 2));
}

run();
