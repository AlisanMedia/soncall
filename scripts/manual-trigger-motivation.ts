
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Manually import sendSMS logic since we can't easily import from @/lib/sms in standalone script without alias setup
// or we just rely on the implementation here.
// I will copy sendSMS logic for simplicity to avoid tsconfig path alias issues in standalone execution.

async function sendSMS(phone: string, message: string) {
    const username = process.env.VERIMOR_USERNAME;
    const password = process.env.VERIMOR_PASSWORD;
    const header = process.env.VERIMOR_HEADER;

    if (!username || !password) {
        console.error('[SMS] VERIMOR_USERNAME or VERIMOR_PASSWORD not set');
        return false;
    }

    // Standardize phone number for Verimor (905xxxxxxxxx)
    // normalizePhone logic: remove spaces, remove +90, ensure 90 prefix?
    // Verimor usually expects 905xxxxxxxxx or 5xxxxxxxxx? The previous code used a specific normalization.
    // Logic from lib/sms.ts:
    // let cleanPhone = normalizePhone(phone); // returns +90....
    // if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);

    // Simple normalization for this script:
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('90')) {
        // ok
    } else if (cleanPhone.startsWith('0')) {
        cleanPhone = '9' + cleanPhone.substring(1); // 05 -> 95? No, 905.
        // If starts with 05xx -> 905xx
        cleanPhone = '9' + cleanPhone;
    } else if (cleanPhone.length === 10) {
        cleanPhone = '90' + cleanPhone;
    }

    // Actually, let's stick to what the original code likely did or just safe normalize.
    // If it is +90.., remove +.
    // Verimor Docs say: 90532xxxxxxx
    if (phone.includes('+90')) cleanPhone = phone.replace('+90', '90').replace(/[^0-9]/g, '');

    console.log(`[SMS] Sending to ${cleanPhone}: ${message}`);

    try {
        const payload = {
            username,
            password,
            source_addr: header || undefined,
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
        console.log(`[SMS] Success Response:`, responseText);
        return true;

    } catch (e: any) {
        console.error('[SMS] Network/System Error:', e.message);
        return false;
    }
}

// Logic from route.ts
const QUOTES = {
    wolf: [
        "{name}, telefon bir silah. Onu sen kullanmazsan, rakibin kullanır. Sisteme gir ve payını al.",
        "Hayallerini satma, yeteneklerini sat {name}. Ama önce telefonu eline alman lazım. Hadi!",
        "{name}, mazeretler banka hesabını doldurmaz. Şu an birileri satış kapatıyor. Sen neredesin?"
    ],
    beast: [
        "{name}, başarı bir seçenek değil, zorunluluktur. Bugün kendi potansiyeline ihanet etme.",
        "%2 şansın var {name}. Ama aramazsan %0. O telefonu kaldır ve istatistiği bük.",
        "Ortalama olmak başarısızlıktır {name}. Bugün efsane olmak için ne yaptın? Panel seni bekliyor."
    ],
    hunter: [
        "{name}, her 'Hayır' cevabı, seni 'Evet'e bir adım daha yaklaştırır. Bugün kaç 'Hayır' topladın?",
        "En iyi lead, henüz aranmamış olandır. {name}, şu an listede bekleyen fırsatlar var. Kaçırma.",
        "Disiplin, canın istemediğinde bile yapmaktır {name}. Şampiyonlar bugün belli olur."
    ]
};

async function run() {
    console.log('Starting Manual Motivation Trigger...');

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch ALL agents
    const { data: agents, error } = await supabaseAdmin
        .from('agent_progress')
        .select(`
            agent_id,
            profiles:agent_id (
                phone_number,
                full_name,
                nickname
            )
        `);

    if (error) {
        console.error('Error fetching agents:', error);
        return;
    }

    console.log(`Found ${agents?.length} agents.`);

    for (const agent of agents || []) {
        const profile = Array.isArray(agent.profiles) ? agent.profiles[0] : agent.profiles;

        if (!profile?.phone_number) {
            console.log(`Skipping agent ${agent.agent_id} (No phone)`);
            continue;
        }

        // Personalization: Prioritize First Name
        const listName = profile.full_name?.trim().split(' ')[0];
        const displayName = listName || profile.nickname || 'Şampiyon';

        // Select Random Strategy & Quote
        const styles = ['wolf', 'beast', 'hunter'] as const;
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        const quotes = QUOTES[randomStyle];
        const rawQuote = quotes[Math.floor(Math.random() * quotes.length)];

        // Inject Name
        const personalizedQuote = rawQuote.replace('{name}', displayName);

        console.log(`Sending to ${profile.full_name} (${randomStyle}): "${personalizedQuote}"`);

        // Send SMS
        const success = await sendSMS(profile.phone_number, personalizedQuote);

        if (success) {
            // Update timestamp
            await supabaseAdmin
                .from('agent_progress')
                .update({ last_motivation_sent: new Date().toISOString() })
                .eq('agent_id', agent.agent_id);
            console.log('Timestamp updated.');
        } else {
            console.log('Failed to send.');
        }
    }

    console.log('Done.');
}

run();
