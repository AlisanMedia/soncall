
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
        const { leadIds, targetAgentId } = body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json({ error: 'leadIds array is required' }, { status: 400 });
        }
        if (!targetAgentId) {
            return NextResponse.json({ error: 'targetAgentId is required' }, { status: 400 });
        }

        // 3. Verify Target Agent Exists (if not transferring to pool)
        let agentName = 'Havuz (Pool)';
        if (targetAgentId !== 'pool') {
            const { data: agent } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('id', targetAgentId)
                .eq('role', 'agent')
                .single();

            if (!agent) {
                return NextResponse.json({ error: 'Target agent not found' }, { status: 404 });
            }
            agentName = agent.full_name;
        }

        // 4. Perform Update
        const updateData: any = {
            current_agent_id: null, // Unlock if locked
            locked_at: null,
            status: 'pending' // Reset status to pending
        };

        if (targetAgentId === 'pool') {
            updateData.assigned_to = null;
        } else {
            updateData.assigned_to = targetAgentId;
        }

        const { error: updateError } = await supabase
            .from('leads')
            .update(updateData)
            .in('id', leadIds);

        if (updateError) throw updateError;

        // 5. Log Activity (Bulk log might be heavy, for now just one log or iterating?)
        // Ideally we should log for each lead, but for bulk 100s it might be slow.
        // Let's Insert into lead_activity_log for each lead. 
        // Optimized: Create array of logs
        const logs = leadIds.map(leadId => ({
            lead_id: leadId,
            agent_id: user.id, // Manager performed action
            action: 'TRANSFER_LEAD',
            metadata: { target_agent: agentName, previous_agent: 'unknown' } // We don't query previous agent to save time
        }));

        await supabase.from('lead_activity_log').insert(logs);

        return NextResponse.json({
            success: true,
            message: `${leadIds.length} lead successfully transferred to ${agentName}`
        });

    } catch (error: any) {
        console.error('Transfer error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
