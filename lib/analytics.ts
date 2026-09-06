import { SupabaseClient } from '@supabase/supabase-js';
import { getRankInfo } from './gamification-utils';
import { formatAppDate, getAppDayStart } from './timezone';
import { formatInTimeZone } from 'date-fns-tz';

// PostgREST caps a response at 1,000 rows. Read every page so charts do not
// silently stop counting once a market grows beyond that default.
async function readAllRows<T>(query: {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
}): Promise<T[]> {
    const rows: T[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await query.range(offset, offset + pageSize - 1);
        if (error) throw error;
        const page = data || [];
        rows.push(...page);
        if (page.length < pageSize) return rows;
    }
}


export async function fetchManagerAnalytics(supabase: SupabaseClient, marketId?: string | null) {
    // Get timezone-aware timestamps
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = getAppDayStart(now);

    // 1. HOURLY DATA (last 24 hours)
    let hourlyQuery = supabase
        .from('lead_activity_log')
        .select('created_at, action, leads:lead_id!inner(market_id)')
        .eq('action', 'completed')
        .gte('created_at', last24Hours.toISOString())
        .order('id');
    if (marketId) hourlyQuery = hourlyQuery.eq('leads.market_id', marketId);
    const hourlyActivity = await readAllRows(hourlyQuery);

    // Aggregate by hour
    const hourlyBuckets: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
        hourlyBuckets[i] = 0;
    }

    hourlyActivity?.forEach((activity) => {
        const hour = Number(formatInTimeZone(new Date(activity.created_at), 'Europe/Istanbul', 'H'));
        hourlyBuckets[hour]++;
    });

    const hourlyData = Object.entries(hourlyBuckets).map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
        label: `${hour.padStart(2, '0')}:00`,
    }));

    // 2. DAILY DATA (last 7 days)
    let dailyQuery = supabase
        .from('lead_activity_log')
        .select('created_at, action, leads:lead_id!inner(market_id)')
        .eq('action', 'completed')
        .gte('created_at', last7Days.toISOString())
        .order('id');
    if (marketId) dailyQuery = dailyQuery.eq('leads.market_id', marketId);
    const dailyActivity = await readAllRows(dailyQuery);

    // Aggregate by day
    const dailyBuckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = formatAppDate(date);
        dailyBuckets[dateKey] = 0;
    }

    dailyActivity?.forEach((activity) => {
        const dateKey = formatAppDate(activity.created_at);
        if (dailyBuckets[dateKey] !== undefined) {
            dailyBuckets[dateKey]++;
        }
    });

    const dailyData = Object.entries(dailyBuckets).map(([date, count]) => {
        const d = new Date(date);
        return {
            date,
            count,
            label: d.toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        };
    });

    // 3. CONVERSION FUNNEL
    let totalLeadsQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });
    if (marketId) totalLeadsQuery = totalLeadsQuery.eq('market_id', marketId);
    const { count: totalLeads, error: totalLeadsError } = await totalLeadsQuery;
    if (totalLeadsError) throw totalLeadsError;

    let contactedLeadsQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['contacted', 'appointment', 'callback']);
    if (marketId) contactedLeadsQuery = contactedLeadsQuery.eq('market_id', marketId);
    const { count: contactedLeads, error: contactedLeadsError } = await contactedLeadsQuery;
    if (contactedLeadsError) throw contactedLeadsError;

    let appointmentLeadsQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'appointment');
    if (marketId) appointmentLeadsQuery = appointmentLeadsQuery.eq('market_id', marketId);
    const { count: appointmentLeads, error: appointmentLeadsError } = await appointmentLeadsQuery;
    if (appointmentLeadsError) throw appointmentLeadsError;

    const conversionFunnel = [
        { stage: 'Total Lead', count: totalLeads || 0, percentage: 100 },
        {
            stage: 'İletişim Kuruldu',
            count: contactedLeads || 0,
            percentage: totalLeads ? Math.round((contactedLeads || 0) / totalLeads * 100) : 0
        },
        {
            stage: 'Randevu',
            count: appointmentLeads || 0,
            percentage: totalLeads ? Math.round((appointmentLeads || 0) / totalLeads * 100) : 0
        },
    ];

    // 4. PEAK HOURS (top 3 performing hours)
    const sortedHours = Object.entries(hourlyBuckets)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([hour, count]) => ({
            hour: parseInt(hour),
            count,
            label: `${hour.padStart(2, '0')}:00 - ${(parseInt(hour) + 1).toString().padStart(2, '0')}:00`,
        }));

    // 5. CATEGORY BREAKDOWN
    let categoryQuery = supabase
        .from('leads')
        .select('category')
        .order('id');
    if (marketId) categoryQuery = categoryQuery.eq('market_id', marketId);
    const categoryData = await readAllRows(categoryQuery);

    const categoryCounts: Record<string, number> = {};
    categoryData?.forEach((lead: { category: string | null }) => {
        const cat = lead.category || 'Kategorisiz';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const categoryBreakdown = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10) // Top 10 categories
        .map(([category, count]) => ({
            category,
            count,
            percentage: totalLeads ? Math.round(count / totalLeads * 100) : 0,
        }));

    // 6. TODAY'S STATS
    let todayProcessedQuery = supabase
        .from('lead_activity_log')
        .select('id, leads:lead_id!inner(market_id)', { count: 'exact', head: true })
        .eq('action', 'completed')
        .gte('created_at', todayStart.toISOString());
    if (marketId) todayProcessedQuery = todayProcessedQuery.eq('leads.market_id', marketId);
    const { count: todayProcessed, error: todayProcessedError } = await todayProcessedQuery;
    if (todayProcessedError) throw todayProcessedError;

    let todayAppointmentsQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'appointment')
        .gte('processed_at', todayStart.toISOString());
    if (marketId) todayAppointmentsQuery = todayAppointmentsQuery.eq('market_id', marketId);
    const { count: todayAppointments, error: todayAppointmentsError } = await todayAppointmentsQuery;
    if (todayAppointmentsError) throw todayAppointmentsError;

    // 7. AGENT PERFORMANCE COMPARISON
    let agentsQuery = supabase
        .from('profiles')
        .select('id, full_name, avatar_url, sales_role')
        .eq('role', 'agent');
    if (marketId) agentsQuery = agentsQuery.eq('market_id', marketId);
    const { data: agents, error: agentsError } = await agentsQuery;

    if (agentsError) throw agentsError;

    // Fetch Level Data for ALL agents in one go
    const { data: agentProgress, error: agentProgressError } = await supabase
        .from('agent_progress')
        .select('agent_id, total_xp, current_level')
        .in('agent_id', (agents || []).map(agent => agent.id));
    if (agentProgressError) throw agentProgressError;

    const progressMap = new Map();
    agentProgress?.forEach((p) => progressMap.set(p.agent_id, p));


    const agentPerformance = await Promise.all(
        (agents || []).map(async (agent) => {
            const isCloser = agent.sales_role === 'closer';

            // Today's role count
            let todayLogsQuery = supabase
                .from('lead_activity_log')
                .select('metadata, lead_id, leads:lead_id!inner(status, market_id)')
                .eq('agent_id', agent.id)
                .eq('action', 'completed')
                .gte('created_at', todayStart.toISOString())
                .order('id');
            if (marketId) todayLogsQuery = todayLogsQuery.eq('leads.market_id', marketId);
            const todayLogs = await readAllRows(todayLogsQuery);

            // Yesterday's count for comparison
            const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
            let yesterdayLogsQuery = supabase
                .from('lead_activity_log')
                .select('metadata, lead_id, leads:lead_id!inner(status, market_id)')
                .eq('agent_id', agent.id)
                .eq('action', 'completed')
                .gte('created_at', yesterdayStart.toISOString())
                .lt('created_at', todayStart.toISOString())
                .order('id');
            if (marketId) yesterdayLogsQuery = yesterdayLogsQuery.eq('leads.market_id', marketId);
            const yesterdayLogs = await readAllRows(yesterdayLogsQuery);

            const countRoleActions = (logs?: Array<{ metadata: unknown; lead_id?: string; leads?: { status?: string } | Array<{ status?: string }> }> | null) => {
                const counted = new Set<string>();
                return (logs || []).filter((log) => {
                const metadata = log.metadata as { action_taken?: string; meeting_outcome?: string | null } | null;
                const lead = Array.isArray(log.leads) ? log.leads[0] : log.leads;
                const isAppointment = metadata?.action_taken === 'appointment_scheduled' || lead?.status === 'appointment';
                const qualifies = isCloser ? Boolean(metadata?.meeting_outcome) : isAppointment;
                if (!qualifies) return false;
                const key = log.lead_id || `activity:${counted.size}`;
                if (counted.has(key)) return false;
                counted.add(key);
                return true;
            }).length;
            };

            const todayCount = countRoleActions(todayLogs);
            const yesterdayCount = countRoleActions(yesterdayLogs);

            // Total appointments / meetings owned by this function
            let appointmentsQuery = supabase
                .from('leads')
                .select('*', { count: 'exact', head: true });
            if (marketId) appointmentsQuery = appointmentsQuery.eq('market_id', marketId);

            appointmentsQuery = isCloser
                ? appointmentsQuery.eq('closer_id', agent.id)
                : appointmentsQuery
                    .eq('status', 'appointment')
                    .or(`assigned_to.eq.${agent.id},sdr_id.eq.${agent.id}`);

            const { count: appointments, error: appointmentsError } = await appointmentsQuery;
            if (appointmentsError) throw appointmentsError;

            // Total Sales (Approved)
            let salesQuery = supabase
                .from('sales')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('status', 'approved');
            if (marketId) salesQuery = salesQuery.eq('market_id', marketId);
            const { count: sales, error: salesError } = await salesQuery;
            if (salesError) throw salesError;

            // Total processed (Lifetime) - Used for XP/Level
            let totalProcessedQuery = supabase
                .from('lead_activity_log')
                .select('id, leads:lead_id!inner(market_id)', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('action', 'completed');
            if (marketId) totalProcessedQuery = totalProcessedQuery.eq('leads.market_id', marketId);
            const { count: totalProcessed, error: totalProcessedError } = await totalProcessedQuery;
            if (totalProcessedError) throw totalProcessedError;

            // Calculate growth
            const growth = yesterdayCount
                ? Math.round((todayCount - yesterdayCount) / yesterdayCount * 100)
                : 0;

            // Calculate Metrics
            const processedCount = totalProcessed || 0;
            const appointmentCount = appointments || 0;
            const salesCount = sales || 0;

            // Calculate Conversion Rate
            const conversionRate = isCloser
                ? appointmentCount ? Math.round((salesCount) / appointmentCount * 100) : 0
                : processedCount ? Math.round((appointmentCount) / processedCount * 100) : 0;

            // GAMIFICATION 2.0 INTEGRATION
            const progress = progressMap.get(agent.id);
            const level = progress?.current_level || 1;
            const score = progress?.total_xp || 0; // Use XP as visual score

            // Get Standard Rank Info
            const rankInfo = getRankInfo(level);

            // Efficiency Bonus: If conversion > 15%, add 10% boost (To what? Maybe just a visual flag now)
            const isEfficient = conversionRate > 15 && processedCount > 10;

            return {
                agent_id: agent.id,
                agent_name: agent.full_name,
                avatar_url: agent.avatar_url,
                sales_role: agent.sales_role || 'sdr',
                metric_label: isCloser ? 'toplantı sonucu' : 'toplantı organize',
                level,
                rank: rankInfo.title, // Standardized Title
                score, // Shows Total XP now
                today_count: todayCount,
                yesterday_count: yesterdayCount,
                growth_percentage: growth,
                total_appointments: appointmentCount,
                total_sales: salesCount,
                total_processed: processedCount,
                conversion_rate: conversionRate,
                is_efficient: isEfficient,
            };
        })
    );

    // Sort by Total XP (Level)
    agentPerformance.sort((a, b) => b.score - a.score);

    return {
        hourly: hourlyData,
        daily: dailyData,
        funnel: conversionFunnel,
        peakHours: sortedHours,
        categories: categoryBreakdown,
        todayStats: {
            processed: todayProcessed || 0,
            appointments: todayAppointments || 0,
        },
        agentPerformance,
    };
}
