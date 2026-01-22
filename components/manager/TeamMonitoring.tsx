'use client';

import { useState, useEffect } from 'react';
import { Activity, Loader2, Phone, MessageCircle, Calendar, CheckCircle2, Package, TrendingUp } from 'lucide-react';
import { playActivityNotification } from '@/lib/sounds';

interface ActivityItem {
    id: string;
    action: string;
    created_at: string;
    agent_id: string;
    lead_id: string;
    note: string | null;
    action_taken: string | null;
    profiles: {
        full_name: string;
        avatar_url?: string;
    };
    leads: {
        business_name: string;
        phone_number: string;
        status: string;
        potential_level: string;
    };
}

interface BatchStat {
    id: string;
    filename: string;
    total_leads: number;
    created_at: string;
    profiles: {
        full_name: string;
    };
    stats: {
        total: number;
        assigned: number;
        completed: number;
        pending: number;
        progress_percentage: number;
        status_breakdown: Record<string, number>;
    };
}

interface Overview {
    total_leads: number;
    pending_leads: number;
    completed_today: number;
    appointments_today: number;
}

interface AgentStat {
    agent_id: string;
    agent_name: string;
    total_assigned: number;
    completed_today: number;
    total_completed: number;
    pending: number;
    appointments: number;
    completion_rate: number;
}

export default function TeamMonitoring() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [batches, setBatches] = useState<BatchStat[]>([]);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
        // Auto-refresh every 10 seconds
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            // Parallel requests
            const [activitiesRes, batchesRes, overviewRes] = await Promise.all([
                fetch('/api/manager/activity'),
                fetch('/api/manager/batches'),
                fetch('/api/manager/overview'),
            ]);

            if (activitiesRes.ok) {
                const data = await activitiesRes.json();
                const newActivities = data.activities || [];

                // ENHANCED deduplication: Use both ID and composite key (agent + lead + time window)
                const uniqueActivities = newActivities.filter((activity: ActivityItem, index: number, self: ActivityItem[]) => {
                    // First, filter by unique ID
                    const firstIndexById = self.findIndex((a) => a.id === activity.id);
                    if (index !== firstIndexById) return false;

                    // Then, filter by composite key (same agent + lead within 5 seconds)
                    const compositeKey = `${activity.agent_id}-${activity.lead_id}-${Math.floor(new Date(activity.created_at).getTime() / 5000)}`;
                    const firstIndexByComposite = self.findIndex((a) =>
                        `${a.agent_id}-${a.lead_id}-${Math.floor(new Date(a.created_at).getTime() / 5000)}` === compositeKey
                    );

                    return index === firstIndexByComposite;
                });

                // Check if there's a new activity (first item changed)
                if (activities.length > 0 && uniqueActivities.length > 0) {
                    if (uniqueActivities[0].id !== activities[0].id) {
                        // New activity detected! Play sound
                        playActivityNotification();
                    }
                }

                setActivities(uniqueActivities);
            }

            if (batchesRes.ok) {
                const data = await batchesRes.json();
                setBatches(data.batches || []);
            }

            if (overviewRes.ok) {
                const data = await overviewRes.json();
                setOverview(data.overview);
                setAgentStats(data.agent_stats || []);
            }
        } catch (err) {
            console.error('Team monitoring load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

        if (diff < 1) return 'Az önce';
        if (diff < 60) return `${diff} dakika önce`;
        if (diff < 1440) return `${Math.floor(diff / 60)} saat önce`;
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const getActionIcon = (action: string | null) => {
        if (!action) return <CheckCircle2 className="w-4 h-4" />;
        if (action.includes('whatsapp')) return <MessageCircle className="w-4 h-4 text-green-400" />;
        if (action.includes('appointment') || action.includes('randevu')) return <Calendar className="w-4 h-4 text-purple-400" />;
        return <Phone className="w-4 h-4 text-blue-400" />;
    };

    const getPotentialColor = (level: string) => {
        switch (level) {
            case 'high': return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            case 'low': return 'bg-red-500/20 text-red-300 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    };

    const getPotentialLabel = (level: string) => {
        switch (level) {
            case 'high': return 'Yüksek';
            case 'medium': return 'Orta';
            case 'low': return 'Düşük';
            default: return 'Değerlendirilmedi';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <img src="/loading-logo.png" alt="Loading" className="w-20 h-10 animate-pulse object-contain" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            {overview && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-200 text-sm">Toplam Lead</p>
                                <p className="text-3xl font-bold text-white mt-1">{overview.total_leads}</p>
                            </div>
                            <Package className="w-10 h-10 text-purple-400" />
                        </div>
                    </div>

                    <div className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-yellow-200 text-sm">Bekleyen</p>
                                <p className="text-3xl font-bold text-yellow-300 mt-1">{overview.pending_leads}</p>
                            </div>
                            <Activity className="w-10 h-10 text-yellow-400" />
                        </div>
                    </div>

                    <div className="bg-green-500/10 backdrop-blur-lg rounded-xl p-6 border border-green-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-200 text-sm">Bugün İşlenen</p>
                                <p className="text-3xl font-bold text-green-300 mt-1">{overview.completed_today}</p>
                            </div>
                            <CheckCircle2 className="w-10 h-10 text-green-400" />
                        </div>
                    </div>

                    <div className="bg-purple-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-200 text-sm">Bugün Randevu</p>
                                <p className="text-3xl font-bold text-purple-300 mt-1">{overview.appointments_today}</p>
                            </div>
                            <Calendar className="w-10 h-10 text-purple-400" />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Activity Feed */}
                <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Activity className="w-6 h-6 text-purple-400" />
                            <h2 className="text-xl font-bold text-white">Canlı Aktivite</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-300">Canlı</span>
                        </div>
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                        {activities.map((activity) => (
                            <div
                                key={activity.id}
                                className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Agent Avatar */}
                                    <div className="mt-1 flex-shrink-0">
                                        {activity.profiles.avatar_url ? (
                                            <img
                                                src={activity.profiles.avatar_url}
                                                alt={activity.profiles.full_name}
                                                className="w-10 h-10 rounded-full object-cover border-2 border-purple-400/50"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold border-2 border-purple-400/50">
                                                {activity.profiles.full_name.charAt(0)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Icon (smaller, positioned top-right of avatar) */}
                                    <div className="-ml-5 mt-8 z-10 bg-slate-900 rounded-full p-1">
                                        {getActionIcon(activity.action_taken)}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-purple-200">
                                                {activity.profiles.full_name}
                                            </span>
                                            <span className="text-purple-300 text-sm">→</span>
                                            <span className="text-white font-medium">
                                                {activity.leads.business_name}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getPotentialColor(activity.leads.potential_level)}`}>
                                                {getPotentialLabel(activity.leads.potential_level)}
                                            </span>
                                        </div>

                                        {activity.note && (
                                            <p className="text-sm text-purple-200 mt-2 line-clamp-2">
                                                💬 {activity.note}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-3 mt-2 text-xs text-purple-300">
                                            <span>{activity.leads.phone_number}</span>
                                            <span>•</span>
                                            <span>{formatTime(activity.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {activities.length === 0 && (
                            <div className="text-center py-12 text-purple-300">
                                Henüz aktivite yok
                            </div>
                        )}
                    </div>
                </div>

                {/* Agent Stats */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-6 h-6 text-purple-400" />
                        <h2 className="text-xl font-bold text-white">Agent İstatistikleri</h2>
                    </div>

                    <div className="space-y-3">
                        {agentStats.map((agent) => (
                            <div
                                key={agent.agent_id}
                                className="bg-white/5 rounded-lg p-4 border border-white/10"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-white">{agent.agent_name}</span>
                                    <span className="text-xs text-purple-300">{agent.completion_rate}%</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-green-500/10 rounded p-2 border border-green-500/30">
                                        <p className="text-xs text-green-300">Bugün</p>
                                        <p className="text-lg font-bold text-green-200">{agent.completed_today}</p>
                                    </div>
                                    <div className="bg-yellow-500/10 rounded p-2 border border-yellow-500/30">
                                        <p className="text-xs text-yellow-300">Kalan</p>
                                        <p className="text-lg font-bold text-yellow-200">{agent.pending}</p>
                                    </div>
                                </div>

                                {agent.appointments > 0 && (
                                    <div className="mt-2 bg-purple-500/10 rounded p-2 border border-purple-500/30">
                                        <p className="text-xs text-purple-300">Randevular: {agent.appointments}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Batch Progress */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                <div className="flex items-center gap-2 mb-6">
                    <Package className="w-6 h-6 text-purple-400" />
                    <h2 className="text-xl font-bold text-white">Batch İlerlemesi</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {batches.map((batch) => (
                        <div key={batch.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <div className="mb-3">
                                <p className="text-white font-medium truncate">{batch.filename}</p>
                                <p className="text-xs text-purple-300 mt-1">
                                    {new Date(batch.created_at).toLocaleDateString('tr-TR')}
                                    {batch.profiles?.full_name && ` • ${batch.profiles.full_name}`}
                                </p>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-3">
                                <div className="flex justify-between text-xs text-purple-200 mb-1">
                                    <span>İlerleme</span>
                                    <span>{batch.stats.progress_percentage}%</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2">
                                    <div
                                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${batch.stats.progress_percentage}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="text-center">
                                    <p className="text-purple-300">Toplam</p>
                                    <p className="text-white font-semibold">{batch.stats.total}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-green-300">Tamamlanan</p>
                                    <p className="text-green-200 font-semibold">{batch.stats.completed}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-yellow-300">Bekleyen</p>
                                    <p className="text-yellow-200 font-semibold">{batch.stats.pending}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {batches.length === 0 && (
                        <div className="col-span-full text-center py-12 text-purple-300">
                            Henüz batch yüklenmedi
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.4);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.6);
        }
      `}</style>
        </div>
    );
}
