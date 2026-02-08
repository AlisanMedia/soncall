import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error('Missing environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

// Verimor Config
const VERIMOR_USERNAME = process.env.VERIMOR_USERNAME;
const VERIMOR_PASSWORD = process.env.VERIMOR_PASSWORD;
const VERIMOR_HEADER = process.env.VERIMOR_HEADER;

async function sendSMS(phone: string, message: string) {
    if (!VERIMOR_USERNAME || !VERIMOR_PASSWORD) {
        console.error('Verimor credentials missing');
        return false;
    }

    // Clean phone: Remove everything non-numeric, strip leading +
    let cleanPhone = phone.replace(/[^0-9]/g, '');

    // Verimor expects 905xxxxxxxxx
    // If input is 05... -> remove 0, add 90 -> 905...
    // If input is 5... -> add 90 -> 905...
    // If input is 905... -> keep

    if (cleanPhone.startsWith('90')) {
        // already good
    } else if (cleanPhone.startsWith('0')) {
        cleanPhone = '9' + cleanPhone;
    } else {
        cleanPhone = '90' + cleanPhone;
    }

    try {
        const payload = {
            username: VERIMOR_USERNAME,
            password: VERIMOR_PASSWORD,
            source_addr: VERIMOR_HEADER,
            messages: [{ msg: message, dest: cleanPhone }]
        };

        const res = await fetch('https://sms.verimor.com.tr/v2/send.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('Verimor Error:', await res.text());
            return false;
        }
        console.log(`SMS Sent to ${cleanPhone}: ${message}`);
        return true;
    } catch (e) {
        console.error('SMS Network Error:', e);
        return false;
    }
}

async function main() {
    console.log('--- Starting Scheduler Briefing ---');
    console.log('Time:', new Date().toISOString());

    // 1. Calculate Time Window (Next 15-20 mins)
    // We want to target appointments happening roughly 15 mins from NOW.
    // Window: [NOW + 14m, NOW + 20m]

    const now = new Date();
    const startWindow = new Date(now.getTime() + 14 * 60000); // +14 mins
    const endWindow = new Date(now.getTime() + 20 * 60000);   // +20 mins

    console.log(`Checking appointments between ${startWindow.toISOString()} and ${endWindow.toISOString()}`);

    // 2. Fetch Appointments
    const { data: leads, error } = await supabase
        .from('leads')
        .select(`
            id, business_name, phone_number, appointment_date, potential_level,
            assigned_to,
            notes:lead_notes(note),
            agent:profiles!leads_assigned_to_fkey(full_name, phone_number)
        `)
        .eq('status', 'appointment')
        .gte('appointment_date', startWindow.toISOString())
        .lte('appointment_date', endWindow.toISOString());

    if (error) {
        console.error('Supabase Error:', error);
        return;
    }

    console.log(`Found ${leads?.length || 0} potential appointments.`);

    if (!leads || leads.length === 0) return;

    for (const lead of leads) {
        const agent = lead.agent as any; // Type assertion since join returns array or object

        if (!agent || !agent.phone_number) {
            console.warn(`Skipping lead ${lead.id}: Agent has no phone number.`);
            continue;
        }

        // 3. Check if we already sent a briefing for this lead recently (approx 1 hour check)
        // This prevents double sending if script runs every minute
        const { data: existingLogs } = await supabase
            .from('sms_logs')
            .select('id')
            .eq('sent_to', agent.phone_number)
            .ilike('message_body', '%Kısa Özet:%') // Identify briefing by content pattern
            .gt('created_at', new Date(now.getTime() - 60 * 60000).toISOString()); // Last 1 hour

        if (existingLogs && existingLogs.length > 0) {
            console.log(`Skipping lead ${lead.id}: Briefing already sent.`);
            continue;
        }

        // 4. Generate AI Briefing
        const notesText = lead.notes?.map((n: any) => n.note).join('\n') || 'Not yok.';
        const prompt = `
            Sen bir yönetici asistanısın. Ajanın (${agent.full_name}) 15 dakika sonra "${lead.business_name}" ile görüşecek.
            
            Müşteri Bilgisi:
            - İsim: ${lead.business_name}
            - Potansiyel: ${lead.potential_level}
            - Notlar: ${notesText.substring(0, 500)}...

            Lütfen ajana kısa (max 160 karakter) bir motivasyon ve hatırlatma SMS'i yaz.
            Format: "📅 [Firma Adı] ile 15dk sonra randevun var! Kısa Özet: [Özet]. Başarılar! 🚀"
        `;

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 100,
            });

            const message = completion.choices[0].message.content?.trim();

            if (message) {
                // 5. Send SMS
                const sent = await sendSMS(agent.phone_number, message);

                if (sent) {
                    // 6. Log to DB
                    await supabase.from('sms_logs').insert({
                        sent_to: agent.phone_number,
                        recipient_name: agent.full_name,
                        message_body: message,
                        status: 'success',
                        provider_response: 'Sent via script',
                        trigger_type: 'briefing'
                    });
                }
            }

        } catch (aiError) {
            console.error('AI Gen Error:', aiError);
        }
    }
}

main();
