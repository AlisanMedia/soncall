
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const username = process.env.VERIMOR_USERNAME;
        const password = process.env.VERIMOR_PASSWORD;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!username || !password || !supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ success: false, error: 'Configuration Error' }, { status: 500 });
        }

        // Correct endpoint for polling inbound messages
        const endpoint = 'https://sms.verimor.com.tr/v2/inbound_messages';

        // Use Service Role Client to bypass RLS and ensure we can write logs
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const url = new URL(endpoint);
        url.searchParams.append('username', username);
        url.searchParams.append('password', password);
        // Ensure we fetch recent messages. We can remove filters to test defaults, or set a wide range.
        // Let's rely on default (usually last messages) or provide a wide range just in case.
        // Some APIs default to "unread" or "new". Verimor GET defaults to last 100 or specific time?
        // Let's stick to NO time filters as it seemed to fetch data in my debug curl.

        console.log('[Sync] Fetching from:', url.toString().replace(password, '***'));

        const res = await fetch(url.toString());

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[Sync] API Error:', errorText);
            return NextResponse.json({ success: false, error: 'Verimor API Error: ' + res.status });
        }

        const data = await res.json();
        const messages = Array.isArray(data) ? data : (data.messages || []);

        console.log(`[Sync] Found ${messages.length} messages.`);

        let addedCount = 0;

        for (const msg of messages) {
            // Expected fields from Verimor v2/inbound_messages:
            // source_addr, content, received_at, etc.
            const sender = msg.source_addr || msg.sender;
            const body = msg.content || msg.msg || msg.message;
            const receivedAt = msg.received_at || msg.date;

            console.log('Processing:', sender, body);

            if (!sender || !body) continue;

            // Normalize sender for DB lookup
            let normalizedSender = sender.replace(/[^0-9]/g, '');
            if (normalizedSender.length === 10) normalizedSender = '90' + normalizedSender;
            if (normalizedSender.length === 11 && normalizedSender.startsWith('0')) normalizedSender = '90' + normalizedSender.substring(1);

            // Check if exists
            const { data: existing } = await supabase
                .from('sms_logs')
                .select('id')
                .eq('sent_to', normalizedSender)
                .eq('message_body', body)
                .eq('direction', 'inbound')
                .single();

            if (!existing) {
                // Find contact
                const { data: contact } = await supabase
                    .from('contacts')
                    .select('id, full_name')
                    .eq('phone_number', normalizedSender)
                    .single();

                const { error: insertError } = await supabase.from('sms_logs').insert({
                    sent_to: normalizedSender,
                    recipient_name: contact?.full_name || 'Bilinmeyen Numara',
                    message_body: body,
                    direction: 'inbound',
                    status: 'success',
                    provider_response: 'Synced from API',
                    contact_id: contact?.id,
                    created_at: receivedAt || new Date().toISOString(),
                    trigger_type: 'inbound'
                });

                if (!insertError) {
                    addedCount++;
                    console.log('[Sync] Added message from', normalizedSender);
                } else {
                    console.error('[Sync] Insert Error:', insertError);
                }
            }
        }

        return NextResponse.json({ success: true, count: addedCount, message: 'Sync complete' });

    } catch (error: any) {
        console.error('[Sync] System Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
