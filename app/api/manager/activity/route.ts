import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    console.log('[ActivityAPI] ========== REQUEST START ==========');
    try {
        console.log('[ActivityAPI] Step 1: Creating Supabase client...');
        const supabase = await createClient();

        // Initialize Admin Client for RLS Bypass
        // We use this ONLY for fetching data to ensure managers see everything regardless of RLS
        const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
        console.log('[ActivityAPI] ✓ Supabase clients created (Auth + Admin)');

        // Verify authentication
        console.log('[ActivityAPI] Step 2: Getting user authentication...');
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[ActivityAPI] ✓ Auth check complete. User:', user?.id);
        if (!user) {
            console.log('[ActivityAPI] Unauthorized');
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Verify manager role
        console.log('[ActivityAPI] Step 2.5: Checking user role...');
        // Use admin client for reliable role check
        const { data: profile } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        console.log('[ActivityAPI] ✓ Role check complete. Role:', profile?.role);
        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            console.log('[ActivityAPI] Forbidden role:', profile?.role);
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Get pagination and search params
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const search = searchParams.get('search') || '';


        console.log(`[ActivityAPI] Fetching limit=${limit} offset=${offset} search=${search}`);

        // 1. Base Query to get IDs first (Fastest way)
        // USE ADMIN CLIENT TO BYPASS RLS
        let query = adminClient
            .from('lead_activity_log')
            .select('id, created_at')
            .order('created_at', { ascending: false });

        if (search) {
            console.log(`[ActivityAPI] Search active: ${search}`);
            let targetLeadIds: string[] = [];

            // 0. Check for Lead Number Search (SC-xxxx or just xxxx)
            const cleanSearch = search.replace(/^(sc-?|#)/i, ''); // Remove SC-, SC, # prefixes
            const isNumberSearch = /^\d+$/.test(cleanSearch);

            if (isNumberSearch) {
                const { data: numLeads } = await adminClient
                    .from('leads')
                    .select('id')
                    .eq('lead_number', parseInt(cleanSearch));

                if (numLeads && numLeads.length > 0) {
                    targetLeadIds.push(...numLeads.map(l => l.id));
                }
            }

            // 1. Find matching Agents
            const { data: agentIds } = await adminClient
                .from('profiles')
                .select('id')
                .ilike('full_name', `%${search}%`);

            // 2. Find matching Leads (by name/phone) 
            const { data: textLeads } = await adminClient
                .from('leads')
                .select('id')
                .or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);

            if (textLeads) targetLeadIds.push(...textLeads.map(l => l.id));

            const targetAgentIds = agentIds?.map(a => a.id) || [];

            // Deduplicate lead IDs
            targetLeadIds = [...new Set(targetLeadIds)];

            if (targetAgentIds.length > 0 || targetLeadIds.length > 0) {
                const orConditions: string[] = [];
                if (targetAgentIds.length > 0) orConditions.push(`agent_id.in.(${targetAgentIds.join(',')})`);
                if (targetLeadIds.length > 0) orConditions.push(`lead_id.in.(${targetLeadIds.join(',')})`);

                query = query.or(orConditions.join(','));
            } else {
                console.log('[ActivityAPI] Search returned no matches for agents or leads.');
                return NextResponse.json({ activities: [] });
            }
        }

        console.log('[ActivityAPI] Step 3: Executing ID query...');
        const { data: activityIds, error: idsError } = await query.range(offset, offset + limit - 1);
        console.log('[ActivityAPI] ✓ ID query complete. Error:', idsError, 'Count:', activityIds?.length);

        if (idsError) {
            console.error('[ActivityAPI] ✗ ID Fetch Error:', idsError);
            return NextResponse.json({ message: 'Error fetching activity IDs', error: idsError }, { status: 500 });
        }

        console.log(`[ActivityAPI] Found ${activityIds?.length || 0} IDs`);

        if (!activityIds || activityIds.length === 0) {
            return NextResponse.json({ activities: [] });
        }

        const uniqueIds = [...new Set(activityIds.map(a => a.id))];
        console.log('[ActivityAPI] Step 4: Unique IDs collected:', uniqueIds.length);

        // Now fetch full data for these unique IDs
        console.log('[ActivityAPI] Step 5: Fetching full details with JOINs...');
        const { data: activities, error: activitiesError } = await adminClient
            .from('lead_activity_log')
            .select(`
                id,
                action,
                created_at,
                metadata,
                agent_id,
                lead_id,
                profiles (
                    full_name,
                    avatar_url
                ),
                leads (
                    business_name,
                    phone_number,
                    lead_number,
                    status,
                    potential_level
                )
            `)
            .in('id', uniqueIds)
            .order('created_at', { ascending: false });

        console.log('[ActivityAPI] ✓ Detail query complete. Error:', activitiesError, 'Count:', activities?.length);

        if (activitiesError) {
            console.error('[ActivityAPI] Detail Fetch Error:', activitiesError);
            return NextResponse.json({ message: 'Error fetching details', error: activitiesError }, { status: 500 });
        }

        console.log(`[ActivityAPI] Fetched ${activities?.length || 0} details`);

        // Get notes for these activities
        console.log('[ActivityAPI] Step 6: Extracting lead IDs for notes...');
        const leadIds = activities?.map(a => a.lead_id).filter(id => id) || [];
        console.log('[ActivityAPI] ✓ Lead IDs extracted:', leadIds.length);
        let notes: any[] = [];

        if (leadIds.length > 0) {
            console.log('[ActivityAPI] Step 7: Fetching notes...');
            const { data: fetchedNotes, error: notesError } = await adminClient
                .from('lead_notes')
                .select('lead_id, note, action_taken, created_at, agent_id')
                .in('lead_id', leadIds)
                .order('created_at', { ascending: false });

            console.log('[ActivityAPI] ✓ Notes query complete. Error:', notesError, 'Count:', fetchedNotes?.length);
            if (!notesError && fetchedNotes) {
                notes = fetchedNotes;
            }
        }

        // Merge notes with activities - match by closest timestamp and same agent
        console.log('[ActivityAPI] Step 8: Enriching activities with notes...');
        const enrichedActivities = activities?.map(activity => {
            // Safe access to joined data (it might be an array or object depending on Supabase version/types)
            // Handle cases where data might be null due to RLS or missing relations
            const profileData = activity.profiles ? (Array.isArray(activity.profiles) ? activity.profiles[0] : activity.profiles) : null;
            const leadData = activity.leads ? (Array.isArray(activity.leads) ? activity.leads[0] : activity.leads) : null;

            // Find note that matches both agent AND is close in time to the activity
            // Ensure notes array exists before searching
            const relatedNote = Array.isArray(notes) ? notes.find(n =>
                n.lead_id === activity.lead_id &&
                n.agent_id === activity.agent_id &&
                n.created_at && activity.created_at &&
                Math.abs(new Date(n.created_at).getTime() - new Date(activity.created_at).getTime()) < 60000 // Within 1 minute
            ) : null;

            return {
                ...activity,
                profiles: profileData || { full_name: 'Unknown Agent', avatar_url: null }, // Fallback
                leads: leadData || { business_name: 'Unknown Lead', phone_number: '', lead_number: '', status: 'unknown', potential_level: 'not_assessed' }, // Fallback
                note: relatedNote?.note || null,
                action_taken: relatedNote?.action_taken || activity.metadata?.action_taken || activity.metadata?.action || null,
            };
        }) || [];


        console.log('[ActivityAPI] ✓ Enrichment complete. Count:', enrichedActivities.length);

        // Final deduplication by ID (safety check)
        console.log('[ActivityAPI] Step 9: Deduplicating activities...');
        const uniqueActivities = enrichedActivities.filter((activity, index, self) =>
            index === self.findIndex((a) => a.id === activity.id)
        );
        console.log('[ActivityAPI] ✓ Deduplication complete. Final count:', uniqueActivities.length);


        console.log('[ActivityAPI] Step 10: Returning response...');
        console.log('[ActivityAPI] ========== REQUEST SUCCESS ==========');
        return NextResponse.json({
            activities: uniqueActivities,
        });


    } catch (error: any) {
        console.error('[ActivityAPI] ========== CRASH DETECTED ==========');
        console.error('[ActivityAPI] Error name:', error.name);
        console.error('[ActivityAPI] Error message:', error.message);
        console.error('[ActivityAPI] Error stack:', error.stack);
        console.error('[ActivityAPI] Full error object:', JSON.stringify(error, null, 2));
        console.error('[ActivityAPI] ========================================');
        return NextResponse.json(
            { message: error.message || 'Failed to fetch activities', error: error.toString() },
            { status: 500 }
        );
    }
}
