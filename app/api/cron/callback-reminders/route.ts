import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';

export const dynamic = 'force-dynamic';

type CallbackLead = {
    id: string;
    lead_number: number | null;
    business_name: string | null;
    callback_at: string;
    callback_reason: string | null;
    assigned_to: string | null;
    sdr_id: string | null;
    profiles?: {
        full_name?: string | null;
        phone_number?: string | null;
    } | null;
};

function formatLeadCode(value?: number | null) {
    return value ? `#${String(value).padStart(4, '0')}` : '#kod-yok';
}

function formatTime(value: string) {
    return new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isLocal = process.env.NODE_ENV !== 'production';

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!cronSecret && !isLocal) {
        return NextResponse.json(
            { success: false, error: 'CRON_SECRET is required in production.' },
            { status: 500 }
        );
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );

    const now = new Date();
    const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000);

    try {
        const { data: leads, error } = await supabase
            .from('leads')
            .select(`
                id,
                lead_number,
                business_name,
                callback_at,
                callback_reason,
                assigned_to,
                sdr_id,
                profiles:assigned_to (
                    full_name,
                    phone_number
                )
            `)
            .eq('status', 'callback')
            .eq('callback_reminder_10m_sent', false)
            .not('callback_at', 'is', null)
            .gt('callback_at', now.toISOString())
            .lte('callback_at', tenMinutesLater.toISOString())
            .order('callback_at', { ascending: true })
            .limit(100);

        if (error) throw error;

        const results = [];

        for (const lead of (leads || []) as CallbackLead[]) {
            const agent = lead.profiles;
            const phone = agent?.phone_number;

            if (!phone) {
                results.push({
                    lead: lead.business_name,
                    status: 'skipped',
                    reason: 'agent_phone_missing',
                });
                continue;
            }

            const leadCode = formatLeadCode(lead.lead_number);
            const businessName = lead.business_name || 'İsimsiz lead';
            const agentName = agent.full_name || 'Agent';
            const message = `${agentName}, ${businessName} ${formatTime(lead.callback_at)} saatinde tekrar aranmalı. 10 dk kaldı. Detay: SonCall paneli. Lead: ${leadCode}`;

            const sent = await sendSMS(phone, message, agentName, 'callback_10m', lead.id);

            if (sent) {
                const agentId = lead.assigned_to || lead.sdr_id;

                await supabase
                    .from('leads')
                    .update({ callback_reminder_10m_sent: true })
                    .eq('id', lead.id);

                if (agentId) {
                    await supabase
                        .from('lead_activity_log')
                        .insert({
                            lead_id: lead.id,
                            agent_id: agentId,
                            action: 'callback_sms_sent',
                            metadata: {
                                callback_at: lead.callback_at,
                                callback_reason: lead.callback_reason,
                                lead_code: leadCode,
                                recipient_phone: phone,
                            },
                        });
                }

                results.push({
                    lead: businessName,
                    lead_code: leadCode,
                    status: 'sent',
                });
            } else {
                results.push({
                    lead: businessName,
                    lead_code: leadCode,
                    status: 'failed',
                });
            }
        }

        return NextResponse.json({
            success: true,
            checked_window: {
                from: now.toISOString(),
                to: tenMinutesLater.toISOString(),
            },
            count: results.length,
            details: results,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Callback reminder failed';
        console.error('Callback reminder cron error:', error);

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
