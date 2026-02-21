import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    console.log('[ActivityAPI] ========== REQUEST START ==========');
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Admin client specifically for bypassing potential RLS or fetching cross-table stats if needed
        // but try to use standard supabase client first for production safety
        const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Verify role using adminClient to ensure we see the profile
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            console.log('[ActivityAPI] Access denied. Role:', profile?.role, 'Error:', profileError);
            return NextResponse.json({ message: 'Forbidden', role: profile?.role }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const search = searchParams.get('search') || '';

        console.log(`[ActivityAPI] Fetching limit=${limit} offset=${offset} search=${search}`);

        // Base Query - Selective fields to avoid overhead
        // Use adminClient here since managers need to see ALL agent activities
        let query = adminClient
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
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        // Search logic
        if (search) {
            const cleanSearch = search.replace(/^(sc-?|#)/i, '');
            const isNumberSearch = /^\d+$/.test(cleanSearch);

            if (isNumberSearch) {
                const { data: leadsByNum } = await adminClient.from('leads').select('id').eq('lead_number', parseInt(cleanSearch));
                const leadIds = leadsByNum?.map(l => l.id) || [];
                if (leadIds.length > 0) query = query.in('lead_id', leadIds);
            } else {
                const { data: agentsByName } = await adminClient.from('profiles').select('id').ilike('full_name', `%${search}%`);
                const { data: leadsByName } = await adminClient.from('leads').select('id').or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);

                const agentIds = agentsByName?.map(a => a.id) || [];
                const leadIds = leadsByName?.map(l => l.id) || [];

                if (agentIds.length > 0 || leadIds.length > 0) {
                    const conditions = [];
                    if (agentIds.length > 0) conditions.push(`agent_id.in.(${agentIds.join(',')})`);
                    if (leadIds.length > 0) conditions.push(`lead_id.in.(${leadIds.join(',')})`);
                    query = query.or(conditions.join(','));
                } else {
                    return NextResponse.json({ activities: [], count: 0 });
                }
            }
        }

        const { data: rawActivities, error: activitiesError, count } = await query.range(offset, offset + limit - 1);

        if (activitiesError) {
            console.error('[ActivityAPI] Query Error:', activitiesError);
            throw activitiesError;
        }

        if (!rawActivities || rawActivities.length === 0) {
            console.log('[ActivityAPI] No activities found for this query');
            return NextResponse.json({ activities: [], count: 0 });
        }

        // Fetch notes for enrichment
        const leadIds = rawActivities.map(a => a.lead_id).filter(Boolean);
        const { data: notes } = await adminClient
            .from('lead_notes')
            .select('lead_id, note, action_taken, created_at, agent_id')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false })
            .limit(200);

        const notesMap = new Map();
        (notes || []).forEach(n => {
            if (!notesMap.has(n.lead_id)) notesMap.set(n.lead_id, []);
            notesMap.get(n.lead_id).push(n);
        });

        // Mapping and Enrichment
        const activities = rawActivities.map((act: any) => {
            // Handle Supabase join object vs array inconsistency
            const profile = Array.isArray(act.profiles) ? act.profiles[0] : act.profiles;
            const lead = Array.isArray(act.leads) ? act.leads[0] : act.leads;

            // Find related note within 2 minutes of the log
            const leadNotes = notesMap.get(act.lead_id) || [];
            const matchingNote = leadNotes.find((n: any) =>
                n.agent_id === act.agent_id &&
                Math.abs(new Date(n.created_at).getTime() - new Date(act.created_at).getTime()) < 120000
            );

            return {
                ...act,
                profiles: profile || { full_name: 'Sistem', avatar_url: null },
                leads: lead || { business_name: 'Bilinmeyen Müşteri' },
                note: matchingNote?.note || act.metadata?.note || null,
                action_taken: matchingNote?.action_taken || act.metadata?.action_taken || act.action
            };
        });

        console.log(`[ActivityAPI] Returning ${activities.length} rows. Total count: ${count}`);
        return NextResponse.json({ activities, totalCount: count });

    } catch (err: any) {
        console.error('[ActivityAPI] Critical Failure:', err);
        return NextResponse.json({
            message: 'Internal Server Error',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status: 500 });
    }
}
