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

        // Merge notes with activities
        const enrichedActivities = activities?.map(activity => {
            const relatedNotes = notes?.filter(n => n.lead_id === activity.lead_id && n.agent_id === activity.agent_id) || [];
            const latestNote = relatedNotes.length > 0 ? relatedNotes[0] : null;

            return {
                ...activity,
                note: latestNote?.note || null,
                action_taken: latestNote?.action_taken || activity.metadata?.action || null,
            };
        });

        return NextResponse.json({
            activities: enrichedActivities,
        });

    } catch (error: any) {
        console.error('Manager activity error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to fetch activities' },
            { status: 500 }
        );
    }
}
