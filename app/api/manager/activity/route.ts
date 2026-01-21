import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
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

        if (profile?.role !== 'manager') {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Get recent activity (last 50 actions)
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
          full_name
        ),
        leads (
          business_name,
          phone_number,
          status,
          potential_level
        )
      `)
            .order('created_at', { ascending: false })
            .limit(50);

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

        // Remove any duplicate activities based on ID (shouldn't happen, but safety check)
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
