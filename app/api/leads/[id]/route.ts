import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { status, potentialLevel, note, actionTaken } = body;

        if (!status || !potentialLevel || !note || !actionTaken) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // Verify this lead is assigned to the current user
        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (lead.assigned_to !== user.id) {
            return NextResponse.json({ message: 'Forbidden - Not your lead' }, { status: 403 });
        }

        // Update lead
        const { error: updateError } = await supabase
            .from('leads')
            .update({
                status,
                potential_level: potentialLevel,
                current_agent_id: null, // Unlock
                locked_at: null,
                processed_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // Insert note
        const { error: noteError } = await supabase
            .from('lead_notes')
            .insert({
                lead_id: id,
                agent_id: user.id,
                note,
                action_taken: actionTaken,
            });

        if (noteError) throw noteError;

        // Log activity
        await supabase.from('lead_activity_log').insert({
            lead_id: id,
            agent_id: user.id,
            action: 'completed',
            metadata: { status, potential_level: potentialLevel, action_taken: actionTaken },
        });

        // Get next lead ID (optional)
        const { data: nextLeads } = await supabase
            .from('leads')
            .select('id')
            .eq('assigned_to', user.id)
            .eq('status', 'pending')
            .order('created_at')
            .limit(1);

        return NextResponse.json({
            success: true,
            nextLeadId: nextLeads && nextLeads.length > 0 ? nextLeads[0].id : null,
            message: 'Lead successfully updated',
        });

    } catch (error: any) {
        console.error('Lead update error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'Update failed' },
            { status: 500 }
        );
    }
}
