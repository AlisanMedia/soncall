
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AgentMotivation {
    last_motivation_sent: string | null;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
}

async function check() {
    const { data } = await supabase
        .from('agent_progress')
        .select(`
            last_motivation_sent,
            profiles:agent_id (full_name)
        `);

    const agents = data as unknown as AgentMotivation[] | null;

    console.log('--- SMS Gönderim Raporu (Bugün) ---');
    const today = new Date().toISOString().split('T')[0];

    let count = 0;
    agents?.forEach(a => {
        let name = "Bilinmiyor";
        if (a.profiles) {
            if (Array.isArray(a.profiles)) {
                name = a.profiles[0]?.full_name || name;
            } else {
                name = a.profiles.full_name || name;
            }
        }

        const sentTime = a.last_motivation_sent;

        if (sentTime && sentTime.startsWith(today)) {
            console.log(`✅ ${name}: Gönderildi (${new Date(sentTime).toLocaleTimeString('tr-TR')})`);
            count++;
        } else {
            // console.log(`❌ ${name}: Bugün gönderilmedi`);
        }
    });

    if (count === 0) console.log("Bugün henüz kimseye kaydedilmedi.");
}

check();
