import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkReminders() {
    console.log('--- Bugünü Randevuları ve Hatırlatma Kontrolü ---');

    // 1. Get today's range in UTC
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 2. Fetch today's appointments
    const { data: appointments, error: appError } = await supabase
        .from('leads')
        .select(`
            id,
            business_name,
            appointment_date,
            assigned_to,
            agent:assigned_to (full_name)
        `)
        .not('appointment_date', 'is', null)
        .gte('appointment_date', todayStart.toISOString())
        .lte('appointment_date', todayEnd.toISOString());

    if (appError) {
        console.error('Randevular çekilirken hata oluştu:', appError);
        return;
    }

    if (!appointments || appointments.length === 0) {
        console.log('Bugün için herhangi bir randevu kaydı bulunamadı.');
        return;
    }

    console.log(`Toplam ${appointments.length} randevu bulundu.\n`);

    for (const app of appointments) {
        const agentName = (app.agent as any)?.full_name || 'Atanmamış';
        const appTime = new Date(app.appointment_date).toLocaleTimeString('tr-TR');

        console.log(`📍 İşletme: ${app.business_name}`);
        console.log(`   Saat: ${appTime}`);
        console.log(`   Personel: ${agentName}`);

        // 3. Check SMS Logs for this lead
        const { data: logs, error: logError } = await supabase
            .from('sms_logs')
            .select('trigger_type, status, created_at')
            .eq('lead_id', app.id)
            .in('trigger_type', ['1h_reminder', '5h_reminder'])
            .order('created_at', { ascending: false });

        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const statusIcon = log.status === 'success' ? '✅' : '❌';
                const time = new Date(log.created_at).toLocaleTimeString('tr-TR');
                const type = log.trigger_type === '5h_reminder' ? '5 Saat Önce' : '1 Saat Önce';
                console.log(`   ${statusIcon} ${type} Bildirimi: ${log.status.toUpperCase()} (${time})`);
            });
        } else {
            console.log(`   ⚠️ Henüz bir hatırlatma SMS'i gönderilmemiş.`);
        }
        console.log('---');
    }
}

checkReminders();
