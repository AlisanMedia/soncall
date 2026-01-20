import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';

export const dynamic = 'force-dynamic';

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
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000);
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);

    try {
        const { data: leads, error } = await supabase
            .from('leads')
            .select(`
                id, 
                business_name, 
                appointment_at, 
                current_agent_id,
                profiles:current_agent_id (
                    full_name,
                    phone_number
                )
            `)
            .gt('appointment_at', tenMinutesFromNow.toISOString())
            .lt('appointment_at', fifteenMinutesFromNow.toISOString())
            // We need to ensure we don't spam. ideally set 'reminder_sent' flag.
            // But for now, simple window check.
            .is('processed_at', null);

        if (error) throw error;

        if (!leads || leads.length === 0) {
            return NextResponse.json({ message: 'No upcoming appointments found' });
        }

        const results = [];

        for (const lead of leads) {
            const agent = lead.profiles as any;

            if (agent && agent.phone_number) {
                const timeStr = new Date(lead.appointment_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                const msg = `🔔 HATIRLATMA: ${timeStr} için "${lead.business_name}" ile randevunuz var! Hazır olun.`;

                await sendSMS(agent.phone_number, msg);
                results.push({ lead: lead.business_name, agent: agent.full_name, status: 'sent' });
            } else {
                results.push({ lead: lead.business_name, agent: agent?.full_name, status: 'no_phone' });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, details: results });

    } catch (error: any) {
        console.error('Cron Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
