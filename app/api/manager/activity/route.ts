import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    console.log('[ActivityAPI] ========== REQUEST START ==========');
    try {
        const supabase = await createClient();
        const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            console.log('[ActivityAPI] Forbidden role:', profile?.role);
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const search = searchParams.get('search') || '';

        console.log(`[ActivityAPI] Fetching limit=${limit} offset=${offset} search=${search}`);

        // Base Query with JOINs - Efficient range-based fetch
        let query = adminClient
            .from('lead_activity_log')
            .select(`
                id,
                action,
                created_at,
                metadata,
                agent_id,
                lead_id,
                profiles (full_name, avatar_url),
                leads (business_name, phone_number, lead_number, status, potential_level)
            `)
            .order('created_at', { ascending: false });

        if (search) {
            let targetLeadIds: string[] = [];
            const cleanSearch = search.replace(/^(sc-?|#)/i, '');
            const isNumberSearch = /^\d+$/.test(cleanSearch);

            if (isNumberSearch) {
                const { data: numLeads } = await adminClient.from('leads').select('id').eq('lead_number', parseInt(cleanSearch));
                if (numLeads) targetLeadIds.push(...numLeads.map(l => l.id));
            }

            const { data: agentIds } = await adminClient.from('profiles').select('id').ilike('full_name', `%${search}%`);
            const { data: textLeads } = await adminClient.from('leads').select('id').or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
            if (textLeads) targetLeadIds.push(...textLeads.map(l => l.id));

            const targetAgentIds = agentIds?.map(a => a.id) || [];
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

        const { data: rawActivities, error: activitiesError } = await query.range(offset, offset + limit - 1);
        if (activitiesError) throw activitiesError;

        if (!rawActivities || rawActivities.length === 0) return NextResponse.json({ activities: [] });

        // Fetch notes only for the business days/agents present in the current page
        const leadIds = rawActivities.map(a => a.lead_id).filter(id => id);
        let notes: any[] = [];
        if (leadIds.length > 0) {
            const { data: fetchedNotes } = await adminClient
                .from('lead_notes')
                .select('lead_id, note, action_taken, created_at, agent_id')
                .in('lead_id', leadIds)
                .order('created_at', { ascending: false })
                .limit(200); // Reasonable limit for notes in one page
            if (fetchedNotes) notes = fetchedNotes;
        }

        // Map notes to a lead_id based structure for faster lookup
        const notesMap = new Map();
        notes.forEach(note => {
            if (!notesMap.has(note.lead_id)) notesMap.set(note.lead_id, []);
            notesMap.get(note.lead_id).push(note);
        });

        const enrichedActivities = rawActivities.map(activity => {
            const profileData = Array.isArray(activity.profiles) ? activity.profiles[0] : activity.profiles;
            const leadData = Array.isArray(activity.leads) ? activity.leads[0] : activity.leads;

            // Optimization: Filter notes only for this lead and agent
            const leadNotes = notesMap.get(activity.lead_id) || [];
            const relatedNote = leadNotes.find((n: any) =>
                n.agent_id === activity.agent_id &&
                Math.abs(new Date(n.created_at).getTime() - new Date(activity.created_at).getTime()) < 60000
            );

            return {
                ...activity,
                profiles: profileData || { full_name: 'Unknown Agent', avatar_url: null },
                leads: leadData || { business_name: 'Unknown Lead', phone_number: '', lead_number: '', status: 'unknown', potential_level: 'not_assessed' },
                note: relatedNote?.note || null,
                action_taken: relatedNote?.action_taken || activity.metadata?.action_taken || activity.action || 'unknown',
            };
        });

        // Unique check
        const uniqueActivities = enrichedActivities.filter((activity, index, self) =>
            index === self.findIndex((a) => a.id === activity.id)
        );

        console.log(`[ActivityAPI] Success. Returned ${uniqueActivities.length} activities.`);
        return NextResponse.json({ activities: uniqueActivities });

    } catch (error: any) {
        console.error('[ActivityAPI] CRASH:', error.message);
        return NextResponse.json(
            { message: error.message || 'Failed to fetch activities', error: error.toString() },
            { status: 500 }
        );
    }
}
