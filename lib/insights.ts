// Rule-based insight generation engine
// No AI API needed - uses statistical analysis of existing data

export interface Insight {
    id: string;
    type: 'warning' | 'opportunity' | 'success' | 'info';
    severity: 'high' | 'medium' | 'low';
    message: string;
    agent_id?: string;
    agent_name?: string;
    icon: string;
    timestamp: string;
}

export interface AgentNotification {
    id: string;
    type: 'milestone' | 'streak' | 'encouragement' | 'achievement';
    message: string;
    icon: string;
    timestamp: string;
}

interface AgentInsightData {
    agent_id: string;
    agent_name: string;
    yesterday_count?: number;
    today_count?: number;
    current_streak?: number;
    metric_label?: string;
}

interface HourlyInsightData {
    hour: number;
    count: number;
}

interface PotentialConversionData {
    high_potential_rate?: number;
}

interface AnalyticsInsightData {
    agentPerformance?: AgentInsightData[];
    hourly?: HourlyInsightData[];
}

// Manager Insights

export function detectSlowPerformers(agentData: AgentInsightData[]): Insight[] {
    const insights: Insight[] = [];

    agentData.forEach(agent => {
        if (!agent.yesterday_count) return; // Skip if no history

        const avgLast3Days = (agent.yesterday_count + agent.yesterday_count + agent.yesterday_count) / 3;
        const threshold = avgLast3Days * 0.6; // 60% of average

        const todayCount = agent.today_count || 0;
        if (todayCount < threshold && todayCount > 0) {
            const percentage = Math.round((todayCount / avgLast3Days) * 100);
            insights.push({
                id: `slow-${agent.agent_id}`,
                type: 'warning',
                severity: percentage < 40 ? 'high' : 'medium',
                message: `${agent.agent_name} bugün yavaş çalışıyor - son 3 günün %${percentage} altında`,
                agent_id: agent.agent_id,
                agent_name: agent.agent_name,
                icon: '⚠️',
                timestamp: new Date().toISOString(),
            });
        }
    });

    return insights;
}

export function findPeakHours(hourlyData: HourlyInsightData[]): Insight[] {
    const insights: Insight[] = [];

    if (!hourlyData || hourlyData.length === 0) return insights;

    // Find top performing hour
    const sortedHours = [...hourlyData].sort((a, b) => b.count - a.count);
    const peakHour = sortedHours[0];

    if (peakHour && peakHour.count > 0) {
        insights.push({
            id: 'peak-hour',
            type: 'opportunity',
            severity: 'medium',
            message: `${peakHour.hour}:00-${peakHour.hour + 1}:00 arası en verimli saat dilimi (${peakHour.count} operasyon)`,
            icon: '⏰',
            timestamp: new Date().toISOString(),
        });
    }

    return insights;
}

export function analyzeConversionByPotential(conversionData: PotentialConversionData): Insight[] {
    const insights: Insight[] = [];

    // This would need actual potential-based conversion data
    // For now, using a placeholder that can be extended
    const highPotentialRate = conversionData.high_potential_rate || 0;

    if (highPotentialRate > 75) {
        insights.push({
            id: 'high-conversion',
            type: 'success',
            severity: 'low',
            message: `Yüksek potansiyelli lead'lerde %${highPotentialRate} conversion var! 🎯`,
            icon: '🎯',
            timestamp: new Date().toISOString(),
        });
    }

    return insights;
}

export function detectStreaks(agentData: AgentInsightData[]): Insight[] {
    const insights: Insight[] = [];

    agentData.forEach(agent => {
        // Check if we have streak data (would come from backend)
        if (agent.current_streak && agent.current_streak >= 10) {
            insights.push({
                id: `streak-${agent.agent_id}`,
                type: 'success',
                severity: 'low',
                message: `${agent.agent_name} ${agent.current_streak} operasyonluk seri rekorunda! 🔥`,
                agent_id: agent.agent_id,
                agent_name: agent.agent_name,
                icon: '🔥',
                timestamp: new Date().toISOString(),
            });
        }
    });

    return insights;
}

export function detectTopPerformer(agentData: AgentInsightData[]): Insight[] {
    const insights: Insight[] = [];

    if (agentData.length === 0) return insights;

    const topAgent = agentData[0]; // Already sorted by today_count

    const topAgentTodayCount = topAgent?.today_count || 0;

    if (topAgent && topAgentTodayCount >= 10) {
        insights.push({
            id: 'top-performer',
            type: 'success',
            severity: 'low',
            message: `${topAgent.agent_name} bugün ekibi domine ediyor! ${topAgentTodayCount} ${topAgent.metric_label || 'hedef'} tamamladı 🏆`,
            agent_id: topAgent.agent_id,
            agent_name: topAgent.agent_name,
            icon: '🏆',
            timestamp: new Date().toISOString(),
        });
    }

    return insights;
}

// Agent Notifications

export function checkMilestones(todayCount: number, previousCount: number): AgentNotification | null {
    const milestones = [5, 10, 20, 50, 100];

    for (const milestone of milestones) {
        if (todayCount === milestone && previousCount < milestone) {
            return {
                id: `milestone-${milestone}`,
                type: 'milestone',
                message: `🎉 Tebrikler! ${milestone}. operasyon hedefini tamamladın!`,
                icon: '🎉',
                timestamp: new Date().toISOString(),
            };
        }
    }

    return null;
}

export function checkStreak(streak: number): AgentNotification | null {
    const streakThresholds = [3, 5, 10, 15];

    for (const threshold of streakThresholds) {
        if (streak === threshold) {
            return {
                id: `streak-${threshold}`,
                type: 'streak',
                message: `🔥 Harikasın! ${streak} operasyonu üst üste tamamladın!`,
                icon: '🔥',
                timestamp: new Date().toISOString(),
            };
        }
    }

    return null;
}

export function generateEncouragement(todayCount: number): AgentNotification | null {
    if (todayCount < 3) return null;

    // Random encouragement (10% chance per check)
    if (Math.random() > 0.9) {
        const messages = [
            '💪 Devam et! Bugün harika gidiyorsun!',
            '⭐ Süpersin! Bu temponu koru!',
            '🚀 İnanılmazsın! Performansın mükemmel!',
            '🌟 Bugün çok iyisin! Böyle devam!',
            '💯 Hızını alamıyorsun! Muhteşemsin!',
        ];

        return {
            id: `encouragement-${Date.now()}`,
            type: 'encouragement',
            message: messages[Math.floor(Math.random() * messages.length)],
            icon: '💪',
            timestamp: new Date().toISOString(),
        };
    }

    return null;
}

export function checkSpeedRecord(speedLast5Min: number, personalBest: number): AgentNotification | null {
    if (speedLast5Min > personalBest && speedLast5Min >= 3) {
        return {
            id: `record-${Date.now()}`,
            type: 'achievement',
            message: `⚡ Yeni hız rekoru! Son 5 dakikada ${speedLast5Min} operasyon tamamladın!`,
            icon: '⚡',
            timestamp: new Date().toISOString(),
        };
    }

    return null;
}

// Aggregate all manager insights
export function generateManagerInsights(analyticsData: AnalyticsInsightData): Insight[] {
    const insights: Insight[] = [];

    if (analyticsData.agentPerformance) {
        insights.push(...detectSlowPerformers(analyticsData.agentPerformance));
        insights.push(...detectStreaks(analyticsData.agentPerformance));
        insights.push(...detectTopPerformer(analyticsData.agentPerformance));
    }

    if (analyticsData.hourly) {
        insights.push(...findPeakHours(analyticsData.hourly));
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return insights;
}
