import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { standardizePhone } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * CRON JOB: Sends SMS reminders for upcoming appointments
 * - 5 Hours Reminder: Sent once between 4.5h and 5.5h before appointment
 * - 1 Hour Reminder: Sent once between 0.5h and 1.5h before appointment
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();

    // Windows for reminders (offset to catch them in cron cycles)
    const fiveHourStart = new Date(now.getTime() + 4.5 * 60 * 60 * 1000);
    const fiveHourEnd = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

    const oneHourStart = new Date(now.getTime() + 0.5 * 60 * 60 * 1000);
    const oneHourEnd = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);

    try {
        const results: any[] = [];

        // 1. Fetch leads for 5h reminder
        const { data: leads5h } = await supabase
            .from('leads')
            .select('id, business_name, appointment_date, current_agent_id, profiles:current_agent_id(full_name, phone_number)')
            .gt('appointment_date', fiveHourStart.toISOString())
            .lt('appointment_date', fiveHourEnd.toISOString())
            .eq('reminder_5h_sent', false);

        // 2. Fetch leads for 1h reminder
        const { data: leads1h } = await supabase
            .from('leads')
            .select('id, business_name, appointment_date, current_agent_id, profiles:current_agent_id(full_name, phone_number)')
            .gt('appointment_date', oneHourStart.toISOString())
            .lt('appointment_date', oneHourEnd.toISOString())
            .eq('reminder_1h_sent', false);

        const processReminders = async (leads: any[], type: '5h' | '1h') => {
            if (!leads) return;
            for (const lead of leads) {
                const agent = lead.profiles as any;
                if (agent && agent.phone_number) {
                    const cleanPhone = standardizePhone(agent.phone_number);
                    const timeStr = new Date(lead.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                    const msg = type === '5h'
                        ? `🔔 5 SAAT KALDI: Bugün saat ${timeStr}'de "${lead.business_name}" ile randevunuz var. Hazırlıklara başlayın!`
                        : `🔔 SON 1 SAAT: "${lead.business_name}" randevunuz ${timeStr}'de başlıyor!`;

                    const ok = await sendSMS(cleanPhone, msg, agent.full_name, 'reminder_' + type);

                    if (ok) {
                        await supabase.from('leads').update({
                            [`reminder_${type}_sent`]: true
                        }).eq('id', lead.id);
                        results.push({ lead: lead.business_name, type, status: 'sent' });
                    }
                }
            }
        };

        await processReminders(leads5h || [], '5h');
        await processReminders(leads1h || [], '1h');

        return NextResponse.json({
            success: true,
            count: results.length,
            details: results
        });

    } catch (error: any) {
        console.error('Cron Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
