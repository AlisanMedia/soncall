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

        // Fetch all needed data
        // 1. Lead Notes for Length analysis
        const { data: notes } = await supabase
            .from('lead_notes')
            .select('agent_id, note, created_at, lead_id');

        // 2. Activity Logs for Handle Time and Re-opens
        const { data: logs } = await supabase
            .from('lead_activity_log')
            .select('agent_id, action, created_at, lead_id')
            .order('created_at', { ascending: true }); // Ordered for time diff calc

        // 3. Profiles for agent names
        const { data: agents } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'agent');

        // Process Data per Agent
        const agentMetrics = (agents || []).map(agent => {
            const agentNotes = (notes || []).filter(n => n.agent_id === agent.id);
            const agentLogs = (logs || []).filter(l => l.agent_id === agent.id);

            // 1. Avg Note Length
            const totalChars = agentNotes.reduce((sum, n) => sum + (n.note?.length || 0), 0);
            const avgNoteLength = agentNotes.length > 0 ? Math.round(totalChars / agentNotes.length) : 0;

            // 2. Handle Time (Viewed -> Completed)
            let totalHandleTime = 0;
            let handleTimeCount = 0;

            // Group logs by lead
            const leadLogs: Record<string, any[]> = {};
            agentLogs.forEach(log => {
                if (!leadLogs[log.lead_id]) leadLogs[log.lead_id] = [];
                leadLogs[log.lead_id].push(log);
            });

            Object.values(leadLogs).forEach(leadEvents => {
                // Find pairs of viewed -> completed
                // Simple approach: For each 'completed', find the last 'viewed' before it
                const completedEvents = leadEvents.filter(e => e.action === 'completed');

                completedEvents.forEach(complete => {
                    const completeTime = new Date(complete.created_at).getTime();

                    // Find most recent start event before completion
                    // Prioritize 'viewed', but could utilize 'assigned' if viewed is missing (backward compatibility)
                    const startEvent = leadEvents
                        .filter(e => e.action === 'viewed' && new Date(e.created_at).getTime() < completeTime)
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

                    if (startEvent) {
                        const startTime = new Date(startEvent.created_at).getTime();
                        const durationSeconds = (completeTime - startTime) / 1000;

                        // Filter out unrealistic times (e.g., > 1 hour might be a break)
                        if (durationSeconds > 0 && durationSeconds < 3600) {
                            totalHandleTime += durationSeconds;
                            handleTimeCount++;
                        }
                    }
                });
            });

            const avgHandleTime = handleTimeCount > 0 ? Math.round(totalHandleTime / handleTimeCount) : 0;

            // 3. Re-open Rate (Leads with multiple views or manual unlocks)
            // We'll define re-open as: Leads that have > 1 'viewed' event
            let reOpenedLeads = 0;
            let totalTouchedLeads = Object.keys(leadLogs).length;

            Object.values(leadLogs).forEach(events => {
                const views = events.filter(e => e.action === 'viewed').length;
                if (views > 1) reOpenedLeads++;
            });

            const reOpenRate = totalTouchedLeads > 0
                ? parseFloat(((reOpenedLeads / totalTouchedLeads) * 100).toFixed(1))
                : 0;

            // 4. Quality Score Calculation (Weighted)
            // Standardize metrics to 0-100 scale

            // Note Score: Target 50 chars. Cap at 100.
            const noteScore = Math.min((avgNoteLength / 50) * 100, 100);

            // Speed Score: Target 120s (2 min). 
            // Too fast (<30s) is bad. Too slow (>300s) is bad.
            // Optimal range 60-180s.
            let speedScore = 0;
            if (avgHandleTime < 30) speedScore = 40; // Rushed
            else if (avgHandleTime > 300) speedScore = 50; // Sluggish
            else speedScore = 100 - (Math.abs(120 - avgHandleTime) / 120 * 50); // Peak at 120s
            speedScore = Math.max(0, Math.min(speedScore, 100));

            // Reliability Score: Inverse of Re-open rate. 
            // 0% re-open = 100 score. 20% re-open = 0 score.
            const reliabilityScore = Math.max(0, 100 - (reOpenRate * 5));

            const qualityScore = Math.round(
                (noteScore * 0.4) +
                (speedScore * 0.3) +
                (reliabilityScore * 0.3)
            );

            return {
                agent_id: agent.id,
                agent_name: agent.full_name,
                avg_note_length: avgNoteLength,
                avg_handle_time: avgHandleTime,
                re_open_rate: reOpenRate,
                quality_score: qualityScore,
                total_processed: handleTimeCount
            };
        }).sort((a, b) => b.quality_score - a.quality_score);

        // Calculate Team Averages
        const teamAvg = {
            avg_note_length: Math.round(agentMetrics.reduce((acc, curr) => acc + curr.avg_note_length, 0) / (agentMetrics.length || 1)),
            avg_handle_time: Math.round(agentMetrics.reduce((acc, curr) => acc + curr.avg_handle_time, 0) / (agentMetrics.length || 1)),
            re_open_rate: parseFloat((agentMetrics.reduce((acc, curr) => acc + curr.re_open_rate, 0) / (agentMetrics.length || 1)).toFixed(1)),
            quality_score: Math.round(agentMetrics.reduce((acc, curr) => acc + curr.quality_score, 0) / (agentMetrics.length || 1)),
        };

        return NextResponse.json({
            metrics: agentMetrics,
            team: teamAvg
        });

    } catch (error: any) {
        console.error('Quality metrics error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to calculate metrics' },
            { status: 500 }
        );
    }
}
