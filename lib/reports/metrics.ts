
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export type DateRange = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month';

// Helper to get date ranges based on timezone
const getDateRange = (range: DateRange, timezone: string = 'UTC') => {
    const now = new Date();
    // Convert to target timezone for correct "start of day" calculation
    const zonedNow = toZonedTime(now, timezone);

    switch (range) {
        case 'today':
            return { start: startOfDay(zonedNow), end: endOfDay(zonedNow) };
        case 'yesterday':
            const yesterday = subDays(zonedNow, 1);
            return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
        case 'this_week':
            return { start: startOfWeek(zonedNow, { weekStartsOn: 1 }), end: endOfWeek(zonedNow, { weekStartsOn: 1 }) };
        case 'last_week':
            const lastWeek = subWeeks(zonedNow, 1);
            return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
        case 'this_month':
            return { start: startOfMonth(zonedNow), end: endOfMonth(zonedNow) };
        default:
            return { start: startOfDay(zonedNow), end: endOfDay(zonedNow) };
    }
};

export async function getReportMetrics(managerId: string, range: DateRange = 'today', timezone: string = 'Europe/Istanbul') {
    const supabase = createServiceRoleClient();
    const { start, end } = getDateRange(range, timezone);

    // 1. Fetch Agents managed by this manager (for now all agents, but assuming future hierarchy)
    // Currently system has global roles, so we fetch all 'agent' profiles.
    const { data: agents } = await supabase
        .from('profiles')
        .select('id, full_name, email, sales_role')
        .eq('role', 'agent');

    if (!agents) return null;

    const agentIds = agents.map(a => a.id);

    // 2. Fetch Activities in Range
    const { data: activities } = await supabase
        .from('lead_activity_log')
        .select(`
            id,
            action,
            agent_id,
            created_at,
            lead_id,
            metadata
        `)
        .in('agent_id', agentIds)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

    // 3. Fetch Leads Processed (status changed from pending)
    // We assume 'processed' means status is NOT pending. 
    // Ideally we look at 'processed_at' if available, or rely on activity log
    const { data: processedLeads } = await supabase
        .from('leads')
        .select('id, status, assigned_to, sdr_id, closer_id, processed_at, potential_level')
        .gte('processed_at', start.toISOString())
        .lte('processed_at', end.toISOString());

    // 4. Calculate Metrics

    // Summary Metrics
    const totalLeadsProcessed = processedLeads?.length || 0;

    const statusBreakdown = processedLeads?.reduce((acc: Record<string, number>, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
    }, {}) || {};

    const appointmentCount = activities?.filter(activity => {
        const metadata = activity.metadata as { action_taken?: string } | null;
        return metadata?.action_taken === 'appointment_scheduled';
    }).length || 0;
    const contractedCount = statusBreakdown['contacted'] || 0;
    const conversionBase = activities?.filter(activity => activity.action === 'completed').length || totalLeadsProcessed;
    const conversionRate = conversionBase > 0
        ? Math.round(((appointmentCount + contractedCount) / conversionBase) * 100)
        : 0;

    // Agent Performance
    const agentPerformance = agents.map(agent => {
        const isCloser = agent.sales_role === 'closer';
        const agentLeads = processedLeads?.filter(l => l.assigned_to === agent.id || l.sdr_id === agent.id || l.closer_id === agent.id) || [];
        const agentActivities = activities?.filter(a => a.agent_id === agent.id) || [];
        const roleActions = agentActivities.filter(activity => {
            const metadata = activity.metadata as { action_taken?: string; meeting_outcome?: string | null } | null;
            return isCloser ? Boolean(metadata?.meeting_outcome) : metadata?.action_taken === 'appointment_scheduled';
        });
        const completedCount = roleActions.length;

        const appointments = isCloser
            ? agentLeads.filter(l => l.closer_id === agent.id).length
            : agentLeads.filter(l => l.status === 'appointment' && (l.assigned_to === agent.id || l.sdr_id === agent.id)).length;

        return {
            id: agent.id,
            name: agent.full_name,
            salesRole: agent.sales_role || 'sdr',
            metricLabel: isCloser ? 'toplantı sonucu' : 'toplantı organizasyonu',
            totalProcessed: completedCount,
            totalActivities: agentActivities.length,
            appointments: appointments,
            score: isCloser ? (completedCount * 3) : (completedCount * 5)
        };
    }).sort((a, b) => b.score - a.score);

    const mvp = agentPerformance.length > 0 ? agentPerformance[0] : null;

    return {
        period: { start, end },
        summary: {
            totalLeadsTotal: totalLeadsProcessed,
            conversionRate,
            appointments: appointmentCount,
            topStatus: Object.keys(statusBreakdown).sort((a, b) => statusBreakdown[b] - statusBreakdown[a])[0] || 'N/A'
        },
        agentPerformance,
        mvp: mvp ? { name: mvp.name, score: mvp.score, processed: mvp.totalProcessed, metricLabel: mvp.metricLabel } : null,
        highlights: [
            appointmentCount > 0 ? `${appointmentCount} yeni toplantı organize edildi!` : null,
            conversionRate > 20 ? `Harika! Randevu dönüşüm oranı %${conversionRate} seviyesinde.` : null,
            mvp ? `🏆 Günün Yıldızı: ${mvp.name} (${mvp.totalProcessed} ${mvp.metricLabel})` : null
        ].filter(Boolean)
    };
}
