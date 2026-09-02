import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const PRIVILEGED_ROLES = new Set(['manager', 'admin', 'founder']);

type LeadAccessRecord = {
    id: string;
    assigned_to?: string | null;
    sdr_id?: string | null;
    closer_id?: string | null;
    current_agent_id?: string | null;
};

type TimestampRecord = {
    created_at?: string | null;
};

function hasLeadAccess(lead: LeadAccessRecord, userId: string, role?: string | null, workedLeadIds: Set<string> = new Set()) {
    if (role && PRIVILEGED_ROLES.has(role)) return true;

    return lead.assigned_to === userId
        || lead.sdr_id === userId
        || lead.closer_id === userId
        || lead.current_agent_id === userId
        || workedLeadIds.has(lead.id);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminSupabase = createAdminClient();
        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id, role, full_name')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) throw profileError;
        if (!profile || !['agent', 'manager', 'admin', 'founder'].includes(profile.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const [
            leadResult,
            activityResult,
            callLogResult,
            smsLogResult,
        ] = await Promise.all([
            adminSupabase
                .from('leads')
                .select(`
                    *,
                    lead_notes (
                        id,
                        note,
                        action_taken,
                        created_at,
                        profiles:agent_id (
                            full_name
                        )
                    ),
                    sdr:profiles!leads_sdr_id_fkey (
                        full_name,
                        phone_number
                    ),
                    closer:profiles!leads_closer_id_fkey (
                        full_name,
                        phone_number
                    )
                `)
                .eq('id', id)
                .maybeSingle(),
            adminSupabase
                .from('lead_activity_log')
                .select(`
                    id,
                    action,
                    metadata,
                    ai_summary,
                    ai_score,
                    created_at,
                    profiles:agent_id (
                        full_name
                    )
                `)
                .eq('lead_id', id)
                .order('created_at', { ascending: false }),
            adminSupabase
                .from('call_logs')
                .select(`
                    id,
                    audio_url,
                    transcription,
                    summary,
                    duration_seconds,
                    created_at,
                    profiles:agent_id (
                        full_name
                    )
                `)
                .eq('lead_id', id)
                .order('created_at', { ascending: false }),
            adminSupabase
                .from('sms_logs')
                .select('id, sent_to, recipient_name, message_body, status, trigger_type, direction, provider_response, created_at')
                .eq('lead_id', id)
                .order('created_at', { ascending: false }),
        ]);

        if (leadResult.error) throw leadResult.error;
        if (activityResult.error) throw activityResult.error;
        if (callLogResult.error) throw callLogResult.error;
        if (smsLogResult.error) throw smsLogResult.error;

        const lead = leadResult.data;
        if (!lead) {
            return NextResponse.json({ error: 'Lead bulunamadı' }, { status: 404 });
        }

        const workedLeadIds = new Set((activityResult.data || []).length > 0 ? [id] : []);
        if (!hasLeadAccess(lead, user.id, profile.role, workedLeadIds)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const notes = ((lead.lead_notes || []) as TimestampRecord[]).sort((a, b) => (
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        ));
        const activities = activityResult.data || [];
        const callLogs = callLogResult.data || [];
        const smsLogs = smsLogResult.data || [];

        return NextResponse.json({
            lead: {
                ...lead,
                lead_notes: notes,
            },
            summary: {
                call_count: callLogs.length,
                note_count: notes.length,
                activity_count: activities.length,
                sms_count: smsLogs.length,
                last_call_at: callLogs[0]?.created_at || null,
                last_activity_at: activities[0]?.created_at || null,
                has_recordings: callLogs.length > 0,
            },
            activities,
            call_logs: callLogs,
            sms_logs: smsLogs,
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Lead detail failed';
        console.error('Agent lead detail error:', error);

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
