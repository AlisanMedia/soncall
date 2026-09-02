import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isGlobalRole, resolveRequestedMarketId } from '@/lib/market-access';

export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set(['manager', 'admin', 'founder']);
const ALERT_STATUSES = new Set(['open', 'acknowledged', 'resolved', 'dismissed']);

function isMissingAlertsTable(error: { message?: string; code?: string } | null) {
    if (!error) return false;
    const message = error.message?.toLowerCase() || '';
    return error.code === '42P01'
        || message.includes('manager_alerts')
        || message.includes('could not find the table');
}

async function requireManager() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return {
            error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
            userId: null,
        };
    }

    const adminSupabase = createAdminClient();
    const { data: profile, error } = await adminSupabase
        .from('profiles')
        .select('id, role, market_id')
        .eq('id', user.id)
        .maybeSingle();

    if (error) throw error;

    if (!profile || !MANAGER_ROLES.has(profile.role || '')) {
        return {
            error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
            userId: null,
        };
    }

    return { error: null, userId: user.id, adminSupabase, profile };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireManager();
        if (auth.error) return auth.error;

        const adminSupabase = auth.adminSupabase!;
        const status = request.nextUrl.searchParams.get('status') || 'active';
        const type = request.nextUrl.searchParams.get('type') || 'all';
        const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 100), 200);

        let query = adminSupabase
            .from('manager_alerts')
            .select(`
                id,
                type,
                severity,
                status,
                title,
                message,
                due_at,
                triggered_at,
                resolved_at,
                resolution_note,
                metadata,
                lead_id,
                agent_id,
                leads:lead_id (
                    id,
                    lead_number,
                    business_name,
                    phone_number,
                    status,
                    potential_level,
                    callback_at,
                    appointment_date
                ),
                profiles:agent_id (
                    id,
                    full_name,
                    phone_number,
                    sales_role
                )
            `)
            .order('triggered_at', { ascending: false })
            .limit(limit);
        const effectiveMarketId = resolveRequestedMarketId(auth.profile, request.nextUrl.searchParams.get('marketId'));
        if (effectiveMarketId) {
            query = query.eq('market_id', effectiveMarketId);
        }

        if (status === 'active') {
            query = query.in('status', ['open', 'acknowledged']);
        } else if (ALERT_STATUSES.has(status)) {
            query = query.eq('status', status);
        }

        if (type !== 'all') {
            query = query.eq('type', type);
        }

        const { data, error } = await query;

        if (isMissingAlertsTable(error)) {
            return NextResponse.json({
                alerts: [],
                counts: { active: 0, critical: 0, open: 0 },
                setupRequired: true,
                setupFile: 'supabase/migrations/20260902_manager_alerts.sql',
            });
        }

        if (error) throw error;

        const alerts = data || [];
        const counts = {
            active: alerts.filter(alert => ['open', 'acknowledged'].includes(alert.status)).length,
            critical: alerts.filter(alert => alert.severity === 'critical' && ['open', 'acknowledged'].includes(alert.status)).length,
            open: alerts.filter(alert => alert.status === 'open').length,
        };

        return NextResponse.json({ alerts, counts, setupRequired: false });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Manager alerts failed';
        console.error('Manager alerts GET error:', error);

        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const auth = await requireManager();
        if (auth.error) return auth.error;

        const body = await request.json();
        const alertId = typeof body?.id === 'string' ? body.id : null;
        const nextStatus = typeof body?.status === 'string' ? body.status : null;
        const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : null;

        if (!alertId || !nextStatus || !ALERT_STATUSES.has(nextStatus)) {
            return NextResponse.json({ error: 'Invalid alert update' }, { status: 400 });
        }

        const updateData: Record<string, string | null> = {
            status: nextStatus,
            resolution_note: note,
        };

        if (nextStatus === 'resolved' || nextStatus === 'dismissed') {
            updateData.resolved_at = new Date().toISOString();
            updateData.resolved_by = auth.userId;
        } else {
            updateData.resolved_at = null;
            updateData.resolved_by = null;
        }

        let updateQuery = auth.adminSupabase!
            .from('manager_alerts')
            .update(updateData)
            .eq('id', alertId);

        if (!isGlobalRole(auth.profile?.role) && auth.profile?.market_id) {
            updateQuery = updateQuery.eq('market_id', auth.profile.market_id);
        }

        const { data, error } = await updateQuery
            .select('id, status, resolved_at')
            .single();

        if (isMissingAlertsTable(error)) {
            return NextResponse.json({
                error: 'Manager alerts table is not installed.',
                setupRequired: true,
                setupFile: 'supabase/migrations/20260902_manager_alerts.sql',
            }, { status: 409 });
        }

        if (error) throw error;

        return NextResponse.json({ success: true, alert: data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Manager alert update failed';
        console.error('Manager alerts PATCH error:', error);

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
