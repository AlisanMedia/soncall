import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ message: 'Forbidden - Manager only' }, { status: 403 });
        }

        const body: AssignmentRequest = await request.json();
        const { batchId, assignments } = body;

        if (!batchId || !assignments || assignments.length === 0) {
            return NextResponse.json({ message: 'Invalid request data' }, { status: 400 });
        }

        const normalizedAssignments = assignments
            .map(assignment => ({
                ...assignment,
                count: Number(assignment.count),
            }))
            .filter(assignment => assignment.count > 0);

        if (
            normalizedAssignments.length === 0 ||
            normalizedAssignments.some(assignment => !Number.isInteger(assignment.count))
        ) {
            return NextResponse.json({ message: 'Invalid assignment counts' }, { status: 400 });
        }

        const requestedTotal = normalizedAssignments.reduce((sum, assignment) => sum + assignment.count, 0);
        const targetAgentIds = Array.from(new Set(normalizedAssignments.map(assignment => assignment.agentId)));

        const { data: validAgents, error: validAgentsError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', targetAgentIds)
            .eq('role', 'agent')
            .eq('sales_role', 'sdr');

        if (validAgentsError) throw validAgentsError;

        const validAgentIds = new Set((validAgents || []).map(agent => agent.id));
        const invalidTargets = targetAgentIds.filter(agentId => !validAgentIds.has(agentId));

        if (invalidTargets.length > 0) {
            return NextResponse.json({ message: 'Cold lead assignments can only target SDR users' }, { status: 400 });
        }

        // Get unassigned leads from this batch
        const { data: batchLeads, error: fetchError } = await supabase
            .from('leads')
            .select('id')
            .eq('batch_id', batchId)
            .is('assigned_to', null)
            .order('created_at');

        if (fetchError) throw fetchError;

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

            // Update leads with assigned_to
            const { error: updateError } = await supabase
                .from('leads')
                .update({ assigned_to: assignment.agentId })
                .in('id', leadsToAssign.map(l => l.id));

            if (updateError) throw updateError;

            // Log assignment activity
            const activityLogs = leadsToAssign.map(lead => ({
                lead_id: lead.id,
                agent_id: assignment.agentId,
                action: 'assigned',
                metadata: {
                    assigned_by: user.id,
                    batch_id: batchId,
                },
            }));

            await supabase.from('lead_activity_log').insert(activityLogs);

            assignmentDetails.push({
                agentId: assignment.agentId,
                agentName: assignment.agentName,
                assignedCount: leadsToAssign.length,
            });

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
