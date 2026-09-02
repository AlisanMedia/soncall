import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
    } | null;
};

type EvidenceResult = {
    completed: boolean;
    reason: string;
    lastEvidenceAt?: string | null;
};

function createAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}

function authorizeCron(request: Request) {
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

    return null;
}

function formatLeadCode(value?: number | null) {
    return value ? `#${String(value).padStart(4, '0')}` : '#kod-yok';
}

function isMissingAlertsTable(error: { message?: string; code?: string } | null) {
    if (!error) return false;
    const message = error.message?.toLowerCase() || '';
    return error.code === '42P01'
        || message.includes('manager_alerts')
        || message.includes('could not find the table');
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}

async function checkCallbackEvidence(
    supabase: ReturnType<typeof createAdminSupabase>,
    leadId: string,
    callbackAt: string
): Promise<EvidenceResult> {
    const callbackTime = new Date(callbackAt).getTime();
    const windowStart = new Date(callbackTime - 2 * 60 * 1000).toISOString();

    const [{ data: callLogs, error: callError }, { data: activities, error: activityError }] = await Promise.all([
        supabase
            .from('call_logs')
            .select('id, created_at')
            .eq('lead_id', leadId)
            .gte('created_at', windowStart)
            .order('created_at', { ascending: false })
            .limit(1),
        supabase
            .from('lead_activity_log')
            .select('id, action, created_at, metadata')
            .eq('lead_id', leadId)
            .gte('created_at', windowStart)
            .in('action', ['call_recording', 'completed', 'call_analyzed'])
            .order('created_at', { ascending: false })
            .limit(3),
    ]);

    if (callError) throw callError;
    if (activityError) throw activityError;

    if (callLogs && callLogs.length > 0) {
        return {
            completed: true,
            reason: 'call_log_after_callback',
            lastEvidenceAt: callLogs[0].created_at,
        };
    }

    const meaningfulActivity = (activities || []).find(activity => {
        const actionTaken = typeof activity.metadata === 'object' && activity.metadata && 'action_taken' in activity.metadata
            ? String((activity.metadata as Record<string, unknown>).action_taken || '')
            : '';

        return activity.action === 'call_recording'
            || activity.action === 'call_analyzed'
            || actionTaken === 'callback_scheduled'
            || actionTaken === 'appointment_scheduled'
            || actionTaken === 'whatsapp_sent'
            || activity.action === 'completed';
    });

    if (meaningfulActivity) {
        return {
            completed: true,
            reason: `activity_${meaningfulActivity.action}`,
            lastEvidenceAt: meaningfulActivity.created_at,
        };
    }

    return {
        completed: false,
        reason: 'no_call_or_activity_after_callback',
    };
}

export async function GET(request: Request) {
    const unauthorized = authorizeCron(request);
    if (unauthorized) return unauthorized;

    const supabase = createAdminSupabase();
    const now = new Date();
    const complianceCutoff = new Date(now.getTime() - 30 * 60 * 1000);
    const lookbackStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
                    full_name
                )
            `)
            .eq('status', 'callback')
            .not('callback_at', 'is', null)
            .lte('callback_at', complianceCutoff.toISOString())
            .gte('callback_at', lookbackStart.toISOString())
            .order('callback_at', { ascending: true })
            .limit(200);

        if (error) throw error;

        const results = [];

        for (const lead of (leads || []) as CallbackLead[]) {
            const agentId = lead.assigned_to || lead.sdr_id;
            const leadCode = formatLeadCode(lead.lead_number);
            const evidence = await checkCallbackEvidence(supabase, lead.id, lead.callback_at);

            if (evidence.completed) {
                const { data: existingCompletion, error: existingCompletionError } = await supabase
                    .from('lead_activity_log')
                    .select('id')
                    .eq('lead_id', lead.id)
                    .eq('action', 'callback_completed')
                    .gte('created_at', lead.callback_at)
                    .limit(1);

                if (existingCompletionError) throw existingCompletionError;

                if (agentId) {
                    if (!existingCompletion || existingCompletion.length === 0) {
                        await supabase
                            .from('lead_activity_log')
                            .insert({
                                lead_id: lead.id,
                                agent_id: agentId,
                                action: 'callback_completed',
                                metadata: {
                                    callback_at: lead.callback_at,
                                    lead_code: leadCode,
                                    evidence: evidence.reason,
                                    evidence_at: evidence.lastEvidenceAt || null,
                                },
                            });
                    }
                }

                results.push({
                    lead: lead.business_name,
                    lead_code: leadCode,
                    status: 'completed',
                    evidence: evidence.reason,
                });
                continue;
            }

            const { error: alertError } = await supabase
                .from('manager_alerts')
                .insert({
                    type: 'callback_missed',
                    severity: 'critical',
                    status: 'open',
                    lead_id: lead.id,
                    agent_id: agentId,
                    title: 'Callback kaçırıldı',
                    message: `${leadCode} ${lead.business_name || 'İsimsiz lead'} için ${formatDateTime(lead.callback_at)} callback zamanı geçti. 30 dakika içinde yeni görüşme kaydı veya işlem bulunamadı.`,
                    due_at: lead.callback_at,
                    metadata: {
                        lead_code: leadCode,
                        callback_at: lead.callback_at,
                        callback_reason: lead.callback_reason,
                        agent_name: lead.profiles?.full_name || null,
                        checked_at: now.toISOString(),
                    },
                });

            if (alertError && !alertError.message.toLowerCase().includes('duplicate')) {
                if (isMissingAlertsTable(alertError)) {
                    return NextResponse.json({
                        success: false,
                        setupRequired: true,
                        setupFile: 'supabase/migrations/20260902_manager_alerts.sql',
                        error: 'manager_alerts table is not installed.',
                    }, { status: 409 });
                }

                throw alertError;
            }

            results.push({
                lead: lead.business_name,
                lead_code: leadCode,
                status: alertError ? 'already_alerted' : 'missed_alert_created',
            });
        }

        return NextResponse.json({
            success: true,
            checked_at: now.toISOString(),
            cutoff: complianceCutoff.toISOString(),
            count: results.length,
            details: results,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Callback compliance failed';
        console.error('Callback compliance cron error:', error);

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
