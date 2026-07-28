import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ID_PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 200;
const MAX_RELEVANT_IDS = 5000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const LEAD_HISTORY_SELECT = `
    id,
    business_name,
    phone_number,
    address,
    category,
    status,
    potential_level,
    processed_at,
    created_at,
    lead_notes (
        note,
        action_taken,
        created_at
    )
`;

type LeadHistoryFilters = {
    status: string | null;
    potentialLevel: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    search: string | null;
};

function chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

function sanitizeSearch(value: string | null) {
    return value?.replace(/[(),]/g, ' ').trim().slice(0, 80) || null;
}

function parsePositiveInteger(value: string | null, fallback: number, max?: number) {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return typeof max === 'number' ? Math.min(parsed, max) : parsed;
}

function applyLeadFilters(query: any, filters: LeadHistoryFilters) {
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }

    if (filters.potentialLevel && filters.potentialLevel !== 'all') {
        query = query.eq('potential_level', filters.potentialLevel);
    }

    if (filters.dateFrom) {
        query = query.gte('processed_at', filters.dateFrom);
    }

    if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('processed_at', endDate.toISOString());
    }

    const search = sanitizeSearch(filters.search);
    if (search) {
        query = query.or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    return query;
}

async function fetchAllIds(
    supabase: ReturnType<typeof createAdminClient>,
    table: 'leads' | 'lead_activity_log',
    idColumn: 'id' | 'lead_id',
    filterColumn: 'assigned_to' | 'agent_id',
    userId: string
) {
    const ids: string[] = [];
    let from = 0;

    while (ids.length < MAX_RELEVANT_IDS) {
        const { data, error } = await supabase
            .from(table)
            .select(idColumn)
            .eq(filterColumn, userId)
            .range(from, from + ID_PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        data.forEach((row: any) => {
            const id = row[idColumn];
            if (typeof id === 'string' && id) ids.push(id);
        });

        if (data.length < ID_PAGE_SIZE) break;
        from += ID_PAGE_SIZE;
    }

    return ids;
}

function sortLeadsByRecentActivity(a: any, b: any) {
    const aProcessed = a.processed_at ? new Date(a.processed_at).getTime() : 0;
    const bProcessed = b.processed_at ? new Date(b.processed_at).getTime() : 0;
    if (aProcessed !== bProcessed) return bProcessed - aProcessed;

    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bCreated - aCreated;
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient(); // Auth context

        // 1. Authenticate Agent
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Use Admin Client for data fetching to bypass RLS policies that might be restricted to 'agent' role
        const adminSupabase = createAdminClient();

        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profile || !['agent', 'manager', 'admin', 'founder'].includes(profile.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse Query Parameters
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const potentialLevel = searchParams.get('potential_level');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');
        const search = sanitizeSearch(searchParams.get('search'));
        const limit = parsePositiveInteger(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
        const offset = parsePositiveInteger(searchParams.get('offset'), 0);

        // 3. Get Relevant Lead IDs
        const [assignedIds, workedIds] = await Promise.all([
            fetchAllIds(adminSupabase, 'leads', 'id', 'assigned_to', user.id),
            fetchAllIds(adminSupabase, 'lead_activity_log', 'lead_id', 'agent_id', user.id),
        ]);

        // Combine and deduplicate
        const allRelevantIds = Array.from(new Set([...assignedIds, ...workedIds])).slice(0, MAX_RELEVANT_IDS);

        if (allRelevantIds.length === 0) {
            return NextResponse.json({
                leads: [],
                total: 0,
                meta: {
                    relevant_leads: 0,
                    chunk_size: ID_CHUNK_SIZE,
                    limit,
                    offset,
                    returned: 0,
                    has_more: false,
                },
            });
        }

        const filters: LeadHistoryFilters = {
            status,
            potentialLevel,
            dateFrom,
            dateTo,
            search,
        };

        const chunkedResults = await Promise.all(
            chunkArray(allRelevantIds, ID_CHUNK_SIZE).map(ids => {
                const query = adminSupabase
                    .from('leads')
                    .select(LEAD_HISTORY_SELECT)
                    .in('id', ids);

                return applyLeadFilters(query, filters);
            })
        );

        const failedResult = chunkedResults.find(result => result.error);
        if (failedResult?.error) throw failedResult.error;

        const leads = chunkedResults
            .flatMap(result => result.data || [])
            .sort(sortLeadsByRecentActivity);

        const paginatedLeads = leads.slice(offset, offset + limit);

        return NextResponse.json({
            leads: paginatedLeads,
            total: leads.length,
            meta: {
                relevant_leads: allRelevantIds.length,
                chunk_size: ID_CHUNK_SIZE,
                limit,
                offset,
                returned: paginatedLeads.length,
                has_more: offset + paginatedLeads.length < leads.length,
            },
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error: any) {
        console.error('Agent leads fetch error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch leads' },
            { status: 500 }
        );
    }
}
