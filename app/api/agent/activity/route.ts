
import { NextResponse } from 'next/server';
import { createClient as createCookieClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        const cookieSupabase = await createCookieClient();

        // 1. Verify Authentication (using cookie client)
        const { data: { user }, error: authError } = await cookieSupabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { lead_id, action, metadata } = body;

        if (typeof lead_id !== 'string' || !['viewed', 'call_recording'].includes(action)) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // Verify assignment before appending an event; never bypass row policies.
        const { data: lead, error: leadError } = await cookieSupabase
            .from('leads').select('assigned_to, sdr_id, closer_id').eq('id', lead_id).maybeSingle();
        if (leadError) return NextResponse.json({ message: 'Failed to verify lead access' }, { status: 500 });
        if (!lead || ![lead.assigned_to, lead.sdr_id, lead.closer_id].includes(user.id)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { error: insertError } = await cookieSupabase
            .from('lead_activity_log')
            .insert({
                agent_id: user.id, // Ensure we use the authenticated user's ID
                lead_id,
                action,
                metadata: metadata || {}
            });

        if (insertError) {
            console.error('Activity Insert Error:', insertError);
            return NextResponse.json({ message: 'Failed to log activity', error: insertError }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Activity API Error:', error);
        return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
    }
}
