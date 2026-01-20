'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Award, Zap, AlertCircle, Info, ChevronRight, Loader2 } from 'lucide-react';
import { playWarning } from '@/lib/sounds';

interface Insight {
    id: string;
    type: 'warning' | 'opportunity' | 'success' | 'info';
    severity: 'high' | 'medium' | 'low';
    message: string;
    agent_id?: string;
    agent_name?: string;
    icon: string;
    timestamp: string;
}

export default function InsightsPanel() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadInsights();
        const interval = setInterval(loadInsights, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const loadInsights = async () => {
        try {
            const response = await fetch('/api/manager/insights');
            const data = await response.json();

            if (response.ok) {
                // Check for new high-severity warnings to play sound
                const currentIds = new Set(insights.map(i => i.id));
                const newWarnings = data.insights.filter(
                    (i: Insight) => i.type === 'warning' && i.severity === 'high' && !currentIds.has(i.id)
                );

                if (newWarnings.length > 0) {
                    playWarning();
                }

                setInsights(data.insights);
            }
        } catch (err) {
            console.error('Insights load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const getSeverityColor = (type: string, severity: string) => {
        if (type === 'warning') {
            return severity === 'high' ? 'bg-red-500/20 border-red-500/50 text-red-100' : 'bg-orange-500/20 border-orange-500/50 text-orange-100';
        }
        if (type === 'opportunity') {
            return 'bg-blue-500/20 border-blue-500/50 text-blue-100';
        }
        if (type === 'success') {
            return 'bg-green-500/20 border-green-500/50 text-green-100';
        }
        return 'bg-purple-500/20 border-purple-500/50 text-purple-100';
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'warning': return <AlertTriangle className="w-5 h-5 text-red-400" />;
            case 'opportunity': return <Zap className="w-5 h-5 text-blue-400" />;
            case 'success': return <Award className="w-5 h-5 text-green-400" />;
            case 'info': return <Info className="w-5 h-5 text-purple-400" />;
            default: return <Info className="w-5 h-5" />;
        }
    };

    if (loading) return null;
    if (!insights || insights.length === 0) return null;

    return (
        <div className="mb-8 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-white text-lg">Smart Insights</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-purple-200">
                    AI-Powered
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.map((insight) => (
                    <div
                        key={insight.id}
                        className={`p-4 rounded-xl border backdrop-blur-sm transition-all hover:scale-[1.02] cursor-default ${getSeverityColor(
                            insight.type,
                            insight.severity
                        )}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">{getIcon(insight.type)}</div>
                            <div className="flex-1">
                                <p className="font-medium text-sm leading-relaxed">
                                    {insight.message}
                                </p>
                                <p className="text-xs opacity-60 mt-2">
                                    {new Date(insight.timestamp).toLocaleTimeString('tr-TR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                            {insight.agent_id && (
                                <ChevronRight className="w-4 h-4 opacity-50" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
