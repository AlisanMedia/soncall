
const { sendSMS } = require('../lib/sms');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function test() {
    console.log('Testing sendSMS directly...');
    const phone = '905051710841';
    const message = 'Test message from server script ' + new Date().toISOString();

    try {
        const result = await sendSMS(phone, message, 'Test User', 'manual');
        console.log('Result:', result);
    } catch (e) {
        console.error('Test failed with error:', e);
    }
}

test();
