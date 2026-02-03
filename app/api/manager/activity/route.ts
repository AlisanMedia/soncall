import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Verify manager role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Get pagination and search params
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const search = searchParams.get('search') || '';

        let query = supabase
            .from('lead_activity_log')
            .select('id')
            .order('created_at', { ascending: false });

        if (search) {
            let targetLeadIds: string[] = [];

            // 0. Check for Lead Number Search (SC-xxxx or just xxxx)
            const cleanSearch = search.replace(/^(sc-?|#)/i, ''); // Remove SC-, SC, # prefixes
            const isNumberSearch = /^\d+$/.test(cleanSearch);

            if (isNumberSearch) {
                const { data: numLeads } = await supabase
                    .from('leads')
                    .select('id')
                    .eq('lead_number', parseInt(cleanSearch));

                if (numLeads && numLeads.length > 0) {
                    targetLeadIds.push(...numLeads.map(l => l.id));
                }
            }

            // 1. Find matching Agents
            const { data: agentIds } = await supabase
                .from('profiles')
                .select('id')
                .ilike('full_name', `%${search}%`);

            // 2. Find matching Leads (by name/phone) 
            const { data: textLeads } = await supabase
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
                return NextResponse.json({ activities: [] });
            }
        }

        const { data: activityIds, error: idsError } = await query.range(offset, offset + limit - 1);

        if (idsError) throw idsError;

        const uniqueIds = [...new Set(activityIds?.map(a => a.id) || [])];

        // Now fetch full data for these unique IDs
        const { data: activities, error: activitiesError } = await supabase
            .from('lead_activity_log')
            .select(`
        id,
        action,
        created_at,
        metadata,
        agent_id,
        lead_id,
        profiles!lead_activity_log_agent_id_fkey (
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

        if (activitiesError) throw activitiesError;

        // Get notes for these activities
        const leadIds = activities?.map(a => a.lead_id) || [];
        const { data: notes, error: notesError } = await supabase
            .from('lead_notes')
            .select('lead_id, note, action_taken, created_at, agent_id')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false });

        if (notesError) throw notesError;

        // Merge notes with activities - match by closest timestamp and same agent
        const enrichedActivities = activities?.map(activity => {
            // Find note that matches both agent AND is close in time to the activity
            const relatedNote = notes?.find(n =>
                n.lead_id === activity.lead_id &&
                n.agent_id === activity.agent_id &&
                Math.abs(new Date(n.created_at).getTime() - new Date(activity.created_at).getTime()) < 60000 // Within 1 minute
            );

            return {
                ...activity,
                note: relatedNote?.note || null,
                action_taken: relatedNote?.action_taken || activity.metadata?.action || null,
            };
        });

        // Final deduplication by ID (safety check)
        const uniqueActivities = enrichedActivities?.filter((activity, index, self) =>
            index === self.findIndex((a) => a.id === activity.id)
        );

        return NextResponse.json({
            activities: uniqueActivities,
        });

    } catch (error: any) {
        console.error('Manager activity error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to fetch activities' },
            { status: 500 }
        );
    }
}
