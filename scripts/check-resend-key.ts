
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

console.log('RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);
if (process.env.RESEND_API_KEY) {
    console.log('Key starts with:', process.env.RESEND_API_KEY.substring(0, 5) + '...');
}
console.log('REPORT_FROM_EMAIL:', process.env.REPORT_FROM_EMAIL);
