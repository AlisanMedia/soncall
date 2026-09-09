import { NextRequest, NextResponse } from 'next/server';
import { requireManagerAccess } from '@/lib/api/auth';
import { resolveRequestedMarketId } from '@/lib/market-access';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const LEAD_STATUSES = new Set(['pending', 'in_progress', 'contacted', 'appointment', 'not_interested', 'callback']);
const DATE_FILTERS = new Set(['today', 'yesterday', 'this_week']);
const REMAINING_STATUSES = new Set(['pending', 'in_progress', 'callback']);

function dateBounds(filter: string, now = new Date()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (filter === 'today') return { from: start.toISOString() };
    if (filter === 'yesterday') {
        const yesterday = new Date(start);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: yesterday.toISOString(), to: start.toISOString() };
    }
    if (filter === 'this_week') {
        const weekAgo = new Date(start);
        weekAgo.setDate(weekAgo.getDate() - 6);
        return { from: weekAgo.toISOString() };
    }
    return null;
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireManagerAccess();
        if (!auth.ok) return auth.response;
        const params = request.nextUrl.searchParams;
        const marketId = resolveRequestedMarketId(auth.profile, params.get('marketId'));
        if (!marketId) return NextResponse.json({ error: 'Operasyon seçimi gerekli.' }, { status: 400 });

        const admin = createAdminClient();
        if (params.get('view') === 'summary') {
            const [{ data: agents, error: agentsError }, leadRows] = await Promise.all([
                admin.from('profiles').select('id, full_name, sales_role').eq('market_id', marketId)
                    .eq('role', 'agent').eq('sales_role', 'sdr').order('full_name'),
                fetchAllLeadInventory(admin, marketId),
            ]);
            if (agentsError) throw agentsError;
            const counts = new Map<string, Record<string, number>>();
            for (const lead of leadRows) {
                if (!lead.assigned_to) continue;
                const current = counts.get(lead.assigned_to) || {};
                current[lead.status] = (current[lead.status] || 0) + 1;
                counts.set(lead.assigned_to, current);
            }
            const inventory = (agents || []).map((agent) => {
                const byStatus = counts.get(agent.id) || {};
                return {
                    agentId: agent.id,
                    agentName: agent.full_name || 'İsimsiz agent',
                    remaining: [...REMAINING_STATUSES].reduce((sum, status) => sum + (byStatus[status] || 0), 0),
                    pending: byStatus.pending || 0,
                    inProgress: byStatus.in_progress || 0,
                    callback: byStatus.callback || 0,
                    contacted: byStatus.contacted || 0,
                    appointment: byStatus.appointment || 0,
                    totalAssigned: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
                };
            });
            return NextResponse.json({ inventory, refreshedAt: new Date().toISOString() });
        }

        const status = params.get('status');
        const dateFilter = params.get('dateFilter');
        if (status && !LEAD_STATUSES.has(status)) return NextResponse.json({ error: 'Geçersiz lead durumu.' }, { status: 400 });
        if (dateFilter && !DATE_FILTERS.has(dateFilter)) return NextResponse.json({ error: 'Geçersiz tarih filtresi.' }, { status: 400 });

        const page = Math.max(1, Number(params.get('page')) || 1);
        const pageSize = Math.min(100, Math.max(10, Number(params.get('pageSize')) || 100));
        const from = (page - 1) * pageSize;
        const agentId = params.get('agentId');
        const category = params.get('category');
        let query = admin.from('leads').select(`
            id, business_name, phone_number, address, category, website, rating, raw_data,
            status, potential_level, assigned_to, current_agent_id, locked_at, created_at,
            updated_at, processed_at, batch_id, appointment_date, callback_at, callback_reason,
            sdr_id, closer_id, meeting_url, meeting_status, market_id, country, timezone, language,
            profiles!leads_assigned_to_fkey (full_name)
        `, { count: 'exact' }).eq('market_id', marketId).order('created_at', { ascending: false });

        if (agentId === 'unassigned') query = query.is('assigned_to', null);
        else if (agentId) query = query.eq('assigned_to', agentId);
        if (status) query = query.eq('status', status);
        if (category === 'Belirsiz') query = query.or('category.is.null,category.eq.');
        else if (category) query = query.eq('category', category);
        if (params.get('batchId')) query = query.eq('batch_id', params.get('batchId'));
        const bounds = dateFilter ? dateBounds(dateFilter) : null;
        if (bounds?.from) query = query.gte('created_at', bounds.from);
        if (bounds?.to) query = query.lt('created_at', bounds.to);

        const { data, error, count } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        return NextResponse.json({ leads: data || [], total: count || 0, page, pageSize });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Leadler yüklenemedi';
        console.error('Manager leads error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

type InventoryRow = { assigned_to: string | null; status: string };

async function fetchAllLeadInventory(admin: ReturnType<typeof createAdminClient>, marketId: string) {
    const rows: InventoryRow[] = [];
    const chunkSize = 1000;
    for (let from = 0; ; from += chunkSize) {
        const { data, error } = await admin.from('leads').select('assigned_to,status').eq('market_id', marketId)
            .not('assigned_to', 'is', null).range(from, from + chunkSize - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < chunkSize) break;
    }
    return rows;
}
