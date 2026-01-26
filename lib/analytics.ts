import { SupabaseClient } from '@supabase/supabase-js';

export async function fetchManagerAnalytics(supabase: SupabaseClient) {
    // Get timezone-aware timestamps
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. HOURLY DATA (last 24 hours)
    const { data: hourlyActivity, error: hourlyError } = await supabase
        .from('lead_activity_log')
        .select('created_at, action')
        .eq('action', 'completed')
        .gte('created_at', last24Hours.toISOString());

    if (hourlyError) throw hourlyError;

    // Aggregate by hour
    const hourlyBuckets: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
        hourlyBuckets[i] = 0;
    }

    hourlyActivity?.forEach((activity) => {
        const hour = new Date(activity.created_at).getHours();
        hourlyBuckets[hour]++;
    });

    const hourlyData = Object.entries(hourlyBuckets).map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
        label: `${hour.padStart(2, '0')}:00`,
    }));

    // 2. DAILY DATA (last 7 days)
    const { data: dailyActivity, error: dailyError } = await supabase
        .from('lead_activity_log')
        .select('created_at, action')
        .eq('action', 'completed')
        .gte('created_at', last7Days.toISOString());

    if (dailyError) throw dailyError;

    // Aggregate by day
    const dailyBuckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        dailyBuckets[dateKey] = 0;
    }

    dailyActivity?.forEach((activity) => {
        const dateKey = activity.created_at.split('T')[0];
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
    const { count: totalLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

    const { count: contactedLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['contacted', 'appointment', 'callback']);

    const { count: appointmentLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'appointment');

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
    const { data: categoryData, error: categoryError } = await supabase
        .from('leads')
        .select('category');

    if (categoryError) throw categoryError;

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
    const { count: todayProcessed } = await supabase
        .from('lead_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'completed')
        .gte('created_at', todayStart.toISOString());

    const { count: todayAppointments } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'appointment')
        .gte('processed_at', todayStart.toISOString());

    // 7. AGENT PERFORMANCE COMPARISON
    const { data: agents, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('role', ['agent', 'admin', 'manager', 'founder']);

    if (agentsError) throw agentsError;

    const agentPerformance = await Promise.all(
        (agents || []).map(async (agent) => {
            // Today's count
            const { count: todayCount } = await supabase
                .from('lead_activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('action', 'completed')
                .gte('created_at', todayStart.toISOString());

            // Yesterday's count for comparison
            const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
            const { count: yesterdayCount } = await supabase
                .from('lead_activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('action', 'completed')
                .gte('created_at', yesterdayStart.toISOString())
                .lt('created_at', todayStart.toISOString());

            // Total appointments
            const { count: appointments } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', agent.id)
                .eq('status', 'appointment');

            // Total Sales (Approved)
            const { count: sales } = await supabase
                .from('sales')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('status', 'approved');

            // Total processed (Lifetime) - Used for XP/Level
            const { count: totalProcessed } = await supabase
                .from('lead_activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('action', 'completed');

            // Calculate growth
            const growth = yesterdayCount
                ? Math.round(((todayCount || 0) - yesterdayCount) / yesterdayCount * 100)
                : 0;

            // Calculate Metrics
            const processedCount = totalProcessed || 0;
            const appointmentCount = appointments || 0;
            const salesCount = sales || 0;

            // Calculate Conversion Rate
            const conversionRate = processedCount ? Math.round((appointmentCount) / processedCount * 100) : 0;

            // Calculate Weighted Score (Smart Leaderboard Logic)
            // Sales = 500 pts (High Value)
            // Appointment = 50 pts (Medium Value)
            // Processed = 1 pt (Effort)
            let score = (salesCount * 500) + (appointmentCount * 50) + (processedCount * 1);

            // Efficiency Bonus: If conversion > 15%, add 10% boost
            const isEfficient = conversionRate > 15 && processedCount > 10; // Min 10 calls to qualify
            if (isEfficient) {
                score = Math.round(score * 1.1);
            }

            // Calculate Dynamic Level & Rank based on Score
            // Level = 1 + (Score / 100)
            const level = Math.floor(score / 100) + 1;

            let rank = 'Çaylak'; // Junior
            if (level >= 10) rank = 'Uzman'; // Expert
            if (level >= 25) rank = 'Usta'; // Master
            if (level >= 50) rank = 'Efsane'; // Legend
            if (level >= 100) rank = 'Godlike';

            return {
                agent_id: agent.id,
                agent_name: agent.full_name,
                avatar_url: agent.avatar_url,
                level,
                rank,
                score, // Include score for sorting and display
                today_count: todayCount || 0,
                yesterday_count: yesterdayCount || 0,
                growth_percentage: growth,
                total_appointments: appointmentCount,
                total_sales: salesCount,
                total_processed: processedCount,
                conversion_rate: conversionRate,
                is_efficient: isEfficient, // Pass efficiency flag to UI
            };
        })
    );

    // Sort by Weighted Score (Real Performance)
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
