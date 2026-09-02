import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { standardizePhone } from './utils';

type SmsInsertClient = {
    from: (table: string) => {
        insert: (values: Record<string, unknown>) => Promise<{ error: unknown }>;
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                maybeSingle: () => Promise<{ data: { market_id?: string | null } | null; error: unknown }>;
            };
        };
    };
};

export async function sendSMS(phone: string, message: string, recipientName?: string, triggerType: string = 'manual', leadId?: string | null) {
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

        if (!response.ok) {
            console.error(`[SMS] Verimor API Error (${response.status}):`, responseText);

            // Log failure to Database
            await logSmsToDb(cleanPhone, message, 'failed', responseText, recipientName, triggerType, leadId);
            return false;
        }

        console.log(`[SMS] Sent to ${cleanPhone}. Response:`, responseText);

        // Log to Database (AWAIT to ensure it saves before function terminates)
        await logSmsToDb(cleanPhone, message, 'success', responseText, recipientName, triggerType, leadId);

        return true;

    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown SMS error';
        const errorMsg = `[NETWORK/SYSTEM ERROR]: ${errorMessage}`;
        console.error('[SMS]', errorMsg);

        // Log failure to Database
        await logSmsToDb(cleanPhone, message, 'failed', errorMessage, recipientName, triggerType, leadId);

        return false;
    }
}

let supabaseAdmin: SmsInsertClient | null = null;

function getAdminClient() {
    if (supabaseAdmin) return supabaseAdmin;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase Admin Environment Variables');
    }

    supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseKey) as unknown as SmsInsertClient;
    return supabaseAdmin;
}

export async function logSmsToDb(
    phone: string,
    message: string,
    status: 'success' | 'failed',
    providerResponse: string,
    recipientName?: string,
    triggerType: string = 'manual',
    leadId?: string | null
) {
    try {
        const supabase = getAdminClient();
        let marketId: string | null = null;

        if (leadId) {
            const { data } = await supabase
                .from('leads')
                .select('market_id')
                .eq('id', leadId)
                .maybeSingle();
            marketId = data?.market_id || null;
        }

        const { error } = await supabase.from('sms_logs').insert({
            lead_id: leadId || null,
            market_id: marketId,
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

