
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Authenticate Manager
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse Body
        const body = await request.json();
        const { agentId } = body;

        if (!agentId) {
            return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
        }

        // 3. Revoke (Unassign all pending leads)
        const { data: leads, error: updateError } = await supabase
            .from('leads')
            .update({
                assigned_to: null,
                current_agent_id: null,
                locked_at: null
            })
            .eq('assigned_to', agentId)
            .eq('status', 'pending')
            .select('id');

        if (updateError) throw updateError;

        const revokedCount = leads?.length || 0;

        // 4. Log
        await supabase.from('lead_activity_log').insert({
            // lead_id: ... cannot allow null? checking schema... schema says UUID references leads.
            // If we did bulk update, maybe we skip per-row logs or insert one representative log if possible?
            // "lead_activity_log" usually requires a lead_id. 
            // Logging 1000 items here works but is slow. 
            // Let's create a "SYSTEM" log entry instead? 
            // Or just logging the metadata in a separate "audit" table? 
            // For now, let's just log ONE entry attached to the FIRST lead if exists, just to trace it.
            lead_id: leads?.[0]?.id,
            agent_id: user.id,
            action: 'EMERGENCY_REVOKE',
            metadata: { target_agent_id: agentId, count: revokedCount }
        });

        return NextResponse.json({
            success: true,
            revokedCount,
            message: `Successfully revoked ${revokedCount} leads from agent.`
        });

    } catch (error: any) {
        console.error('Revoke error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
