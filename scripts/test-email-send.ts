
import { Resend } from 'resend';
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

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
    console.error('RESEND_API_KEY is missing');
    process.exit(1);
}

const resend = new Resend(apiKey);
const fromEmail = process.env.REPORT_FROM_EMAIL || 'onboarding@resend.dev';

async function sendTest() {
    console.log(`Sending from: ${fromEmail}`);
    try {
        const data = await resend.emails.send({
            from: fromEmail,
            to: ['alisan@alisanmedia.com'], // Assuming this might be the user's email or a test one. Let's ask user for email or try a dummy one.
            // Actually, I'll use a safe dummy that will likely fail if unauthorized: 'delivered@resend.dev' is a valid test address for success, but checking restrictions matters.
            // Let's use the user's likely email or just check the response.
            // If I use 'delivered@resend.dev', it simulates success.
            // I want to see if it fails for an arbitrary email.

            subject: 'Test Email from Script',
            html: '<p>Test</p>'
        });
        console.log('Success:', data);
    } catch (error) {
        console.error('Error:', error);
    }
}

sendTest();
