import { normalizePhone, standardizePhone } from './utils';

export async function sendSMS(phone: string, message: string, recipientName?: string, triggerType: string = 'manual') {
    const username = process.env.VERIMOR_USERNAME;
    const password = process.env.VERIMOR_PASSWORD;
    const header = process.env.VERIMOR_HEADER;

    if (!username || !password) {
        console.error('[SMS] VERIMOR_USERNAME or VERIMOR_PASSWORD not set');
        return false;
    }

    // Standardize phone number for Verimor (905xxxxxxxxx)
    let cleanPhone = standardizePhone(phone);

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

        const responseText = await response.text();

        // Log to file immediately for debugging
        const fs = require('fs');
        const logEntry = `\n[${new Date().toISOString()}] To: ${cleanPhone} | Status: ${response.status} | Msg: ${message} | Response: ${responseText}\n`;
        fs.appendFileSync('verimor_debug_log.txt', logEntry);

        if (!response.ok) {
            console.error(`[SMS] Verimor API Error (${response.status}):`, responseText);

            // Log failure to Database
            await logSmsToDb(cleanPhone, message, 'failed', responseText, recipientName, triggerType);
            return false;
        }

        console.log(`[SMS] Sent to ${cleanPhone}. Response:`, responseText);

        // Log to Database (AWAIT to ensure it saves before function terminates)
        await logSmsToDb(cleanPhone, message, 'success', responseText, recipientName, triggerType);

        return true;

    } catch (e: any) {
        const errorMsg = `[NETWORK/SYSTEM ERROR]: ${e.message}`;
        console.error('[SMS]', errorMsg);

        // Log to file even on network error
        try {
            const fs = require('fs');
            const logEntry = `\n[${new Date().toISOString()}] To: ${phone} | ERROR: ${errorMsg}\n`;
            fs.appendFileSync('verimor_debug_log.txt', logEntry);
        } catch (logErr) { }

        // Log failure to Database
        await logSmsToDb(cleanPhone, message, 'failed', e.message, recipientName, triggerType);

        return false;
    }
}

let supabaseAdmin: any = null;

function getAdminClient() {
    if (supabaseAdmin) return supabaseAdmin;

    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase Admin Environment Variables');
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    return supabaseAdmin;
}

export async function logSmsToDb(
    phone: string,
    message: string,
    status: 'success' | 'failed',
    providerResponse: string,
    recipientName?: string,
    triggerType: string = 'manual'
) {
    try {
        const supabase = getAdminClient();

        const { error } = await supabase.from('sms_logs').insert({
            sent_to: phone,
            recipient_name: recipientName || null,
            message_body: message,
            status: status,
            direction: 'outbound',
            provider_response: providerResponse,
            trigger_type: triggerType
        });

        if (error) throw error;

    } catch (e) {
        console.error('[SMS] DB Log Error:', e);
    }
}

