import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, standardizePhone } from '@/lib/utils';

export async function POST(request: NextRequest) {
    try {
        // Verimor sends JSON or Form Data. Let's try JSON first, fall back to FormData if needed.
        // Documentation usually specifies. We will be robust.
        let body: any = {};
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            body = await request.json();
        } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            formData.forEach((value, key) => {
                body[key] = value.toString();
            });
        }

        console.log('[Webhook] Received Verimor payload:', body);

        // Verimor Payload fields (example, may vary based on exact setup, usually 'source_addr', 'dest_addr', 'msg')
        // We will look for common variations
        const sender = body.source_addr || body.sender || body.from;
        const receiver = body.dest_addr || body.receiver || body.to; // This is us
        const message = body.msg || body.message || body.text;
        const timestamp = body.received_at || new Date().toISOString();

        if (!sender || !message) {
            console.warn('[Webhook] Missing sender or message fields', body);
            // Return 200 anyway to prevent retries if it's junk
            return NextResponse.json({ status: 'ignored', reason: 'missing_fields' });
        }

        // Initialize Supabase with Service Role to bypass RLS (since this is server-to-server)
        // We can't use createClient() from '@/lib/supabase/server' because it uses cookies for auth
        // We need a direct client with service key
        const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('[Webhook] Missing Supabase Config');
            return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
        }

        const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey);

        // Normalize Sender Phone
        const normalizedSender = standardizePhone(sender);

        // 1. Try to find the Contact
        let contactId = null;
        let contactName = null;

        const { data: contact } = await supabase
            .from('contacts')
            .select('id, full_name')
            .eq('phone_number', normalizedSender)
            .single();

        if (contact) {
            contactId = contact.id;
            contactName = contact.full_name;
        }

        // 2. Insert into SMS Logs
        // IMPORTANT: We store the SENDER in 'sent_to' column for now to maintain compatibility 
        // with the 'Chat View' which queries by '.eq("sent_to", contact_phone)'.
        // This effectively treats 'sent_to' as 'remote_party' in our schema context.
        const { error } = await supabase
            .from('sms_logs')
            .insert({
                sent_to: normalizedSender, // deliberately storing sender here for compatibility
                recipient_name: contactName || 'Bilinmeyen Numara', // or 'Unknown'
                message_body: message,
                direction: 'inbound',
                status: 'success', // Received successfully
                provider_response: 'Webhook Received',
                contact_id: contactId,
                trigger_type: 'inbound',
                created_at: timestamp // Use provider timestamp if available
            });

        if (error) {
            console.error('[Webhook] DB Insert Error:', error);
            return NextResponse.json({ error: 'DB Error' }, { status: 500 });
        }

        return NextResponse.json({ status: 'success' });

    } catch (error: any) {
        console.error('[Webhook] Processing Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
