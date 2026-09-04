import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessMarket } from '@/lib/market-access';

interface AssignmentRequest {
    batchId: string;
    assignments: {
        agentId: string;
        agentName: string;
        count: number;
    }[];
}

export async function POST(request: NextRequest) {
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
            .select('id, role, market_id')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ message: 'Forbidden - Manager only' }, { status: 403 });
        }

        const body: AssignmentRequest = await request.json();
        const { batchId, assignments } = body;

        if (!batchId || !Array.isArray(assignments) || assignments.length === 0) {
            return NextResponse.json({ message: 'Invalid request data' }, { status: 400 });
        }

        const normalizedAssignments = assignments
            .map(assignment => ({
                ...assignment,
                count: Number(assignment.count),
            }));

        if (
            normalizedAssignments.length === 0 ||
            normalizedAssignments.some(assignment => !Number.isSafeInteger(assignment.count) || assignment.count <= 0)
        ) {
            return NextResponse.json({ message: 'Invalid assignment counts' }, { status: 400 });
        }

        const requestedTotal = normalizedAssignments.reduce((sum, assignment) => sum + assignment.count, 0);
        const targetAgentIds = Array.from(new Set(normalizedAssignments.map(assignment => assignment.agentId)));

        const { data: batch, error: batchError } = await supabase
            .from('upload_batches').select('market_id').eq('id', batchId).maybeSingle();
        if (batchError) throw batchError;
        if (!batch || !canAccessMarket(profile, batch.market_id)) {
            return NextResponse.json({ message: 'Batch not found or forbidden' }, { status: 403 });
        }

        const { data: validAgents, error: validAgentsError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('market_id', batch.market_id)
            .in('id', targetAgentIds)
            .eq('role', 'agent')
            .eq('sales_role', 'sdr');

        if (validAgentsError) throw validAgentsError;

        const validAgentIds = new Set((validAgents || []).map(agent => agent.id));
        const invalidTargets = targetAgentIds.filter(agentId => !validAgentIds.has(agentId));

        if (invalidTargets.length > 0) {
            return NextResponse.json({ message: 'Cold lead assignments can only target SDR users' }, { status: 400 });
        }

        // Page reads so requests above the PostgREST row cap remain accurate.
        const batchLeads: { id: string }[] = [];
        const pageSize = 500;
        while (batchLeads.length < requestedTotal) {
            const { data: page, error: fetchError } = await supabase
                .from('leads').select('id')
                .eq('batch_id', batchId).eq('status', 'pending')
                .is('assigned_to', null).is('current_agent_id', null)
                .order('created_at').order('id')
                .range(batchLeads.length, batchLeads.length + Math.min(pageSize, requestedTotal - batchLeads.length) - 1);
            if (fetchError) throw fetchError;
            if (!page?.length) break;
            batchLeads.push(...page);
        }

        if (!batchLeads || batchLeads.length === 0) {
            return NextResponse.json({ message: 'No unassigned leads found' }, { status: 400 });
        }

        if (requestedTotal > batchLeads.length) {
            return NextResponse.json({
                message: `Requested ${requestedTotal} leads, but only ${batchLeads.length} unassigned leads are available`,
            }, { status: 409 });
        }

        // Distribute leads according to assignments
        let leadIndex = 0;
        const assignmentDetails = [];

        for (const assignment of normalizedAssignments) {
            if (assignment.count <= 0) continue;

            const leadsToAssign = batchLeads.slice(leadIndex, leadIndex + assignment.count);

            if (leadsToAssign.length === 0) break;

            // Guard every write against a concurrent assignment or active call.
            const assignedLeads: { id: string }[] = [];
            for (let offset = 0; offset < leadsToAssign.length; offset += pageSize) {
                const chunk = leadsToAssign.slice(offset, offset + pageSize);
                const { data: updated, error: updateError } = await supabase
                    .from('leads')
                    .update({ assigned_to: assignment.agentId, sdr_id: assignment.agentId })
                    .in('id', chunk.map(lead => lead.id))
                    .eq('status', 'pending')
                    .is('assigned_to', null).is('current_agent_id', null)
                    .select('id');
                if (updateError) {
                    return NextResponse.json({
                        success: false,
                        assignmentDetails: [...assignmentDetails, {
                            agentId: assignment.agentId,
                            agentName: assignment.agentName,
                            assignedCount: assignedLeads.length,
                        }],
                        message: 'Assignment interrupted. Refresh the batch before assigning the remainder.',
                    }, { status: 500 });
                }
                assignedLeads.push(...(updated || []));
                if ((updated?.length || 0) !== chunk.length) break;
            }

            // Log assignment activity
            const activityLogs = (assignedLeads || []).map(lead => ({
                lead_id: lead.id,
                agent_id: user.id,
                action: 'assigned',
                metadata: {
                    assigned_agent_id: assignment.agentId,
                    assigned_by: user.id,
                    batch_id: batchId,
                },
            }));

            if (activityLogs.length > 0) {
                const { error: logError } = await supabase.from('lead_activity_log').insert(activityLogs);
                if (logError) console.error('Assignment activity log failed:', logError);
            }

            assignmentDetails.push({
                agentId: assignment.agentId,
                agentName: assignment.agentName,
                assignedCount: assignedLeads?.length || 0,
            });

            if ((assignedLeads?.length || 0) !== leadsToAssign.length) {
                return NextResponse.json({
                    success: false, assignmentDetails,
                    message: 'Some leads changed during assignment. Refresh the batch before assigning the remainder.',
                }, { status: 409 });
            }
            leadIndex += assignment.count;
        }

        return NextResponse.json({
            success: true,
            assignmentDetails,
            message: `Leads successfully assigned to ${assignmentDetails.length} agents`,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Assignment failed';
        console.error('Assignment error:', error);
        return NextResponse.json(
            { success: false, message },
            { status: 500 }
        );
    }
}
