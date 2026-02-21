import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            console.log('[ActivityAPI] Forbidden: Invalid role', profile?.role);
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // 3. Parse query params
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const search = searchParams.get('search') || '';

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
                profiles:agent_id (full_name, avatar_url),
                leads:lead_id (business_name, phone_number, lead_number, status, potential_level)
            `)
            .order('created_at', { ascending: false });

        // 5. Handle Search
        if (search) {
            console.log('[ActivityAPI] Applying search filter:', search);
            const cleanSearch = search.replace(/^(sc-?|#)/i, '');
            const isNumberSearch = /^\d+$/.test(cleanSearch);

            const { data: agentIdsData } = await supabase.from('profiles').select('id').ilike('full_name', `%${search}%`);
            const { data: leadIdsData } = await supabase.from('leads').select('id').or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);

            let targetLeadIds = leadIdsData?.map(l => l.id) || [];
            if (isNumberSearch) {
                const { data: leadsByNum } = await supabase.from('leads').select('id').eq('lead_number', parseInt(cleanSearch));
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
        let notesData: any[] = [];
        if (leadIds.length > 0) {
            const { data: notes } = await supabase
                .from('lead_notes')
                .select('lead_id, note, action_taken, created_at, agent_id')
                .in('lead_id', leadIds)
                .order('created_at', { ascending: false })
                .limit(200);
            if (notes) notesData = notes;
        }

        const notesMap = new Map();
        notesData.forEach(n => {
            if (!notesMap.has(n.lead_id)) notesMap.set(n.lead_id, []);
            notesMap.get(n.lead_id).push(n);
        });

        const activities = rawActivities.map((act: any) => {
            const profile = Array.isArray(act.profiles) ? act.profiles[0] : act.profiles;
            const lead = Array.isArray(act.leads) ? act.leads[0] : act.leads;
            const leadNotes = notesMap.get(act.lead_id) || [];
            const matchingNote = leadNotes.find((n: any) =>
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

    } catch (err: any) {
        console.error('[ActivityAPI] Critical Error:', err);
        return NextResponse.json(
            { message: err.message || 'Failed to fetch activities', error: err.toString() },
            { status: 500 }
        );
    }
}
