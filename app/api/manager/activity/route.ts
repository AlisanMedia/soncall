import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { resolveRequestedMarketId } from '@/lib/market-access';

export const dynamic = 'force-dynamic';

type ActivityNote = {
    lead_id: string;
    note: string | null;
    action_taken: string | null;
    created_at: string;
    agent_id: string;
};

type RawActivity = {
    id: string;
    action: string;
    created_at: string;
    metadata?: Record<string, unknown> | null;
    agent_id: string;
    lead_id: string;
    ai_summary?: string | null;
    ai_score?: number | null;
    profiles?: unknown;
    leads?: unknown;
};

export async function GET(request: Request) {
    console.log('[ActivityAPI] ========== REQUEST START ==========');
    try {
        const supabase = await createClient();

        // 1. Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('[ActivityAPI] Unauthorized: No user');
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // 2. Verify manager role (Use regular client - if overview works, this should too)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .single();

        if (profileError) throw profileError;
        const role = (profile?.role || '').toLowerCase();
        if (!['manager', 'admin', 'founder'].includes(role)) {
            console.log('[ActivityAPI] Forbidden: Invalid role', profile?.role);
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // 3. Parse query params
        const { searchParams } = new URL(request.url);
        const limit = Number(searchParams.get('limit') || '50');
        const offset = Number(searchParams.get('offset') || '0');
        if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
            return NextResponse.json({ message: 'Invalid pagination' }, { status: 400 });
        }
        const search = searchParams.get('search') || '';
        const effectiveMarketId = resolveRequestedMarketId(profile, searchParams.get('marketId'));

        console.log(`[ActivityAPI] Fetching limit=${limit} offset=${offset} search=${search}`);

        // 4. Build Query
        let query = supabase
            .from('lead_activity_log')
            .select(`
                id,
                action,
                created_at,
                metadata,
                agent_id,
                lead_id,
                ai_summary,
                ai_score,
                profiles:agent_id (full_name, avatar_url),
                leads:lead_id!inner (business_name, phone_number, lead_number, status, potential_level, market_id)
            `)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });

        if (effectiveMarketId) {
            query = query.eq('leads.market_id', effectiveMarketId);
        }

        // 5. Handle Search
        if (search) {
            console.log('[ActivityAPI] Applying search filter:', search);
            const cleanSearch = search.replace(/^(sc-?|#)/i, '');
            const isNumberSearch = /^\d+$/.test(cleanSearch);

            let agentSearchQuery = supabase.from('profiles').select('id').ilike('full_name', `%${search}%`);
            if (effectiveMarketId) agentSearchQuery = agentSearchQuery.eq('market_id', effectiveMarketId);
            const { data: agentIdsData } = await agentSearchQuery;
            let leadSearchQuery = supabase.from('leads').select('id').or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
            if (effectiveMarketId) leadSearchQuery = leadSearchQuery.eq('market_id', effectiveMarketId);
            const { data: leadIdsData } = await leadSearchQuery;

            let targetLeadIds = leadIdsData?.map(l => l.id) || [];
            if (isNumberSearch) {
                let leadNumberQuery = supabase.from('leads').select('id').eq('lead_number', parseInt(cleanSearch));
                if (effectiveMarketId) leadNumberQuery = leadNumberQuery.eq('market_id', effectiveMarketId);
                const { data: leadsByNum } = await leadNumberQuery;
                if (leadsByNum) targetLeadIds.push(...leadsByNum.map(l => l.id));
            }

            const targetAgentIds = agentIdsData?.map(a => a.id) || [];
            targetLeadIds = [...new Set(targetLeadIds)];

            if (targetAgentIds.length > 0 || targetLeadIds.length > 0) {
                const orConditions: string[] = [];
                if (targetAgentIds.length > 0) orConditions.push(`agent_id.in.(${targetAgentIds.join(',')})`);
                if (targetLeadIds.length > 0) orConditions.push(`lead_id.in.(${targetLeadIds.join(',')})`);
                query = query.or(orConditions.join(','));
            } else {
                return NextResponse.json({ activities: [] });
            }
        }

        // 6. Execute with Range
        const { data: rawActivities, error: activitiesError } = await query.range(offset, offset + limit - 1);

        if (activitiesError) {
            console.error('[ActivityAPI] Query Error:', activitiesError);
            throw activitiesError;
        }

        if (!rawActivities || rawActivities.length === 0) {
            console.log('[ActivityAPI] No results found');
            return NextResponse.json({ activities: [] });
        }

        // 7. Enrichment (Notes matching logic like before)
        const leadIds = rawActivities.map(a => a.lead_id).filter(Boolean);
        let notesData: ActivityNote[] = [];
        if (leadIds.length > 0) {
            const { data: notes } = await supabase
                .from('lead_notes')
                .select('lead_id, note, action_taken, created_at, agent_id')
                .in('lead_id', leadIds)
                .order('created_at', { ascending: false })
                .limit(200);
            if (notes) notesData = notes;
        }

        const notesMap = new Map<string, ActivityNote[]>();
        notesData.forEach(n => {
            const existing = notesMap.get(n.lead_id) || [];
            existing.push(n);
            notesMap.set(n.lead_id, existing);
        });

        const activities = (rawActivities as RawActivity[]).map((act) => {
            const profile = Array.isArray(act.profiles) ? act.profiles[0] : act.profiles;
            const lead = Array.isArray(act.leads) ? act.leads[0] : act.leads;
            const leadNotes = notesMap.get(act.lead_id) || [];
            const matchingNote = leadNotes.find((n) =>
                n.agent_id === act.agent_id &&
                Math.abs(new Date(n.created_at).getTime() - new Date(act.created_at).getTime()) < 120000
            );

            return {
                ...act,
                profiles: profile || { full_name: 'Bilinmeyen Ajan', avatar_url: null },
                leads: lead || { business_name: 'Bilinmeyen Müşteri' },
                note: matchingNote?.note || act.metadata?.note || null,
                action_taken: matchingNote?.action_taken || act.metadata?.action_taken || act.action,
            };
        });

        console.log(`[ActivityAPI] Success: Returned ${activities.length} activities.`);
        return NextResponse.json({ activities });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch activities';
        console.error('[ActivityAPI] Critical Error:', err);
        return NextResponse.json(
            { message, error: String(err) },
            { status: 500 }
        );
    }
}
