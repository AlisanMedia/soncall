import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';

export const dynamic = 'force-dynamic';

// Use Service Role to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const forceAll = searchParams.get('force') === 'true'; // ?force=true to test on EVERYONE
        const today = new Date().toISOString().split('T')[0];

        let query = supabaseAdmin
            .from('agent_progress')
            .select(`
                agent_id,
                last_activity_date,
                last_motivation_sent,
                profiles:agent_id (
                    phone_number,
                    full_name,
                    nickname
                )
            `);

        // If NOT force mode, apply filtering for inactivity
        if (!forceAll) {
            // Logic: last_activity_date < today AND (last_motivation_sent < today OR null)
            query = query.lt('last_activity_date', today);
        }

        const { data: agents, error } = await query;

        if (error) throw error;

        const results = [];

        for (const agent of agents || []) {
            const profile = Array.isArray(agent.profiles) ? agent.profiles[0] : agent.profiles;

            // In normal mode, skip if already sent today
            if (!forceAll && agent.last_motivation_sent) {
                const sentDate = new Date(agent.last_motivation_sent).toISOString().split('T')[0];
                if (sentDate === today) continue;
            }

            if (!profile?.phone_number) {
                results.push({ agent: 'Unknown', status: 'skipped_no_phone' });
                continue;
            }

            // Personalization: Prioritize First Name from Full Name
            const listName = profile.full_name?.trim().split(' ')[0];
            const displayName = listName || profile.nickname || 'Şampiyon';

            // Select Random Strategy & Quote
            const styles = ['wolf', 'beast', 'hunter'] as const;
            const randomStyle = styles[Math.floor(Math.random() * styles.length)];
            const quotes = QUOTES[randomStyle];
            const rawQuote = quotes[Math.floor(Math.random() * quotes.length)];

            // Inject Name
            const personalizedQuote = rawQuote.replace('{name}', displayName);

            // Send SMS
            const success = await sendSMS(profile.phone_number, personalizedQuote);

            if (success) {
                // Update timestamp
                await supabaseAdmin
                    .from('agent_progress')
                    .update({ last_motivation_sent: new Date().toISOString() })
                    .eq('agent_id', agent.agent_id);

                results.push({ agent: profile.full_name, status: 'sent', quote: personalizedQuote });
            } else {
                results.push({ agent: profile.full_name, status: 'failed' });
            }
        }

        return NextResponse.json({
            success: true,
            mode: forceAll ? 'TEST_BROADCAST_ALL' : 'INACTIVITY_CHECK',
            processed: results.length,
            details: results
        });

    } catch (error: any) {
        console.error('Motivation Cron Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
