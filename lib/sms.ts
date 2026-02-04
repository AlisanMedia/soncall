import { normalizePhone } from './utils';

export async function sendSMS(phone: string, message: string) {
    const username = process.env.VERIMOR_USERNAME;
    const password = process.env.VERIMOR_PASSWORD;
    const header = process.env.VERIMOR_HEADER;

    if (!username || !password) {
        console.error('[SMS] VERIMOR_USERNAME or VERIMOR_PASSWORD not set');
        return false;
    }

    // Standardize phone number for Verimor (905xxxxxxxxx)
    // normalizePhone returns +905..., we need 905... (remove +)
    let cleanPhone = normalizePhone(phone);
    if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1);
    }

    // Fallback cleanup if normalizePhone wasn't used/failed
    cleanPhone = cleanPhone.replace(/[^0-9]/g, '');

    try {
        const payload = {
            username,
            password,
            source_addr: header || undefined, // Optional, defaults to first header if empty
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

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SMS] Verimor API Error (${response.status}):`, errorText);
            return false;
        }

        const responseText = await response.text();
        console.log(`[SMS] Sent to ${cleanPhone}. Response:`, responseText);
        return true;

    } catch (e: any) {
        console.error('[SMS] Network/System Error:', e.message);
        return false;
    }
}
