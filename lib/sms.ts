import { normalizePhone } from './utils';

export async function sendSMS(phone: string, message: string, recipientName?: string) {
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

        // Log to Database (Async, don't block return)
        logSmsToDb(username, password, cleanPhone, message, 'success', responseText, recipientName).catch(err =>
            console.error('[SMS] Failed to log success to DB:', err)
        );

        return true;

    } catch (e: any) {
        console.error('[SMS] Network/System Error:', e.message);

        // Log failure to Database
        logSmsToDb(username, password, cleanPhone, message, 'failed', e.message, recipientName).catch(err =>
            console.error('[SMS] Failed to log failure to DB:', err)
        );

        return false;
    }
}

async function logSmsToDb(
    username: string,
    pass: string,
    phone: string,
    message: string,
    status: 'success' | 'failed',
    providerResponse: string,
    recipientName?: string
) {
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role to write logs

        if (!supabaseUrl || !supabaseKey) return;

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Try to find if this phone belongs to a known lead (optional, for linking)
        // Or if it's an agent. The schema has lead_id which is optional.
        // For motivation messages, we might not have a lead_id. 
        // We will just insert what we have.

        await supabase.from('sms_logs').insert({
            sent_to: phone,
            recipient_name: recipientName || null,
            message_body: message,
            status: status,
            provider_response: providerResponse,
            trigger_type: 'motivation' // Defaulting to motivation or generic for now, ideally passed in
        });

    } catch (e) {
        console.error('[SMS] DB Log Error:', e);
    }
}

