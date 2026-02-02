'use client';

import { useState, useEffect } from 'react';
import { Activity, Loader2, Phone, Sparkles, Calendar, CheckCircle2, Package, TrendingUp, Eye, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { playActivityNotification } from '@/lib/sounds';
import { SectionInfo } from '@/components/ui/section-info';
import ActivityDetailModal from './ActivityDetailModal';

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
    avatar_url?: string;
    rank?: string;
    level?: number;
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
    const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
    const [showAllBatches, setShowAllBatches] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadInitialData();
        }, 300); // Debounce search

        // Auto-refresh every 10 seconds ONLY if no search term active
        if (!searchTerm) {
            const interval = setInterval(() => loadLatestActivities(), 10000);
            return () => {
                clearInterval(interval);
                clearTimeout(timeoutId);
            };
        }
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const query = searchTerm ? `?limit=50&offset=0&search=${encodeURIComponent(searchTerm)}` : '?limit=50&offset=0';

            const [activitiesRes, batchesRes, overviewRes] = await Promise.all([
                fetch('/api/manager/activity' + query),
                fetch('/api/manager/batches'),
                fetch('/api/manager/overview'),
            ]);

            if (activitiesRes.ok) {
                const data = await activitiesRes.json();
                setActivities(data.activities || []);
                setHasMore(true); // Reset hasMore on new search
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

    const loadLatestActivities = async () => {
        if (loading || searchTerm) return; // Don't auto-refresh if searching

        try {
            // Fetch only latest 50 to keep top fresh
            const res = await fetch('/api/manager/activity?limit=50&offset=0');
            if (res.ok) {
                const data = await res.json();
                const newActivities = data.activities || [];

                setActivities(prev => {
                    // Combine new and old
                    const combined = [...newActivities, ...prev];

                    // Deduplicate
                    const uniqueActivities = combined.filter((activity: ActivityItem, index: number, self: ActivityItem[]) => {
                        const firstIndexById = self.findIndex((a) => a.id === activity.id);
                        return index === firstIndexById;
                    });

                    // Check for new activity for sound
                    if (prev.length > 0 && uniqueActivities.length > 0 && uniqueActivities[0].id !== prev[0].id) {
                        playActivityNotification();
                    }

                    return uniqueActivities;
                });
            }

            // Also refresh stats
            const [batchesRes, overviewRes] = await Promise.all([
                fetch('/api/manager/batches'),
                fetch('/api/manager/overview'),
            ]);

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
            console.error('Error refreshing data:', err);
        }
    };

    const loadMoreActivities = async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        try {
            const currentCount = activities.length;
            const limit = 50; // Smaller chunks for smooth loading
            const searchQuery = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';

            const res = await fetch(`/api/manager/activity?limit=${limit}&offset=${currentCount}${searchQuery}`);

            if (res.ok) {
                const data = await res.json();
                const olderActivities = data.activities || [];

                if (olderActivities.length < limit) {
                    setHasMore(false); // No more data to load
                }

                if (olderActivities.length > 0) {
                    setActivities(prev => {
                        const combined = [...prev, ...olderActivities];
                        // Deduplicate just in case
                        return combined.filter((activity, index, self) =>
                            index === self.findIndex((a) => a.id === activity.id)
                        );
                    });
                } else {
                    setHasMore(false);
                }
            }
        } catch (error) {
            console.error('Error loading more activities:', error);
        } finally {
            setLoadingMore(false);
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
        if (action.includes('whatsapp')) return <Sparkles className="w-4 h-4 text-green-400" />;
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

    const getRankColor = (rank?: string) => {
        switch (rank) {
            case 'Godlike': return 'text-red-400 border-red-500/30 bg-red-500/10';
            case 'Efsane': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
            case 'Usta': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
            case 'Uzman': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
            default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
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
                                <div className="flex items-center gap-2">
                                    <p className="text-purple-200 text-sm">Toplam Lead</p>
                                    <SectionInfo text="Sisteme yüklenen ve işlenmeyi bekleyen tüm potansiyel müşteri datalarının toplam sayısı." />
                                </div>
                                <p className="text-3xl font-bold text-white mt-1">{overview.total_leads}</p>
                            </div>
                            <motion.div
                                key={overview.total_leads}
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.4, 1], rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 0.5, type: 'spring' }}
                            >
                                <Package className="w-10 h-10 text-purple-400" />
                            </motion.div>
                        </div>
                    </div>

                    <div className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-yellow-200 text-sm">Bekleyen</p>
                                    <SectionInfo text="Henüz aranmamış veya işlem yapılmamış lead sayısı. Temsilcilerinizin öncelikli olarak arayacağı data havuzudur." />
                                </div>
                                <p className="text-3xl font-bold text-yellow-300 mt-1">{overview.pending_leads}</p>
                            </div>
                            <motion.div
                                key={overview.pending_leads}
                                initial={{ scale: 1 }}
                                animate={{
                                    scale: [1, 1.2, 1],
                                    filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)']
                                }}
                                transition={{ duration: 0.8, ease: "easeInOut" }}
                            >
                                <Activity className="w-10 h-10 text-yellow-400" />
                            </motion.div>
                        </div>
                    </div>

                    <div className="bg-green-500/10 backdrop-blur-lg rounded-xl p-6 border border-green-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-green-200 text-sm">Bugün İşlenen</p>
                                    <SectionInfo text="Bugün içerisinde başarılı veya başarısız sonuçlandırılan toplam arama/işlem sayısı." />
                                </div>
                                <p className="text-3xl font-bold text-green-300 mt-1">{overview.completed_today}</p>
                            </div>
                            <motion.div
                                key={overview.completed_today}
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.4 }}
                            >
                                <CheckCircle2 className="w-10 h-10 text-green-400" />
                            </motion.div>
                        </div>
                    </div>

                    <div className="bg-purple-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-purple-200 text-sm">Bugün Randevu</p>
                                    <SectionInfo text="Bugün için oluşturulan onaylı satış görüşmesi ve toplantı randevularının sayısı." />
                                </div>
                                <p className="text-3xl font-bold text-purple-300 mt-1">{overview.appointments_today}</p>
                            </div>
                            <motion.div
                                key={overview.appointments_today}
                                initial={{ y: 0 }}
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 0.5, type: 'spring', bounce: 0.5 }}
                            >
                                <Calendar className="w-10 h-10 text-purple-400" />
                            </motion.div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Activity Feed */}
                <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-6 h-6 text-purple-400" />
                            <h2 className="text-xl font-bold text-white">Canlı Aktivite</h2>
                            <SectionInfo
                                text="Takımınızın anlık aramalarını, notlarını ve müşteri etkileşimlerini canlı olarak buradan izleyebilirsiniz."
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="w-4 h-4 text-purple-300 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Aktivite Ara..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-black/20 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/50 w-full md:w-48 transition-all focus:w-64"
                                />
                            </div>
                            {!searchTerm && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-green-300 hidden md:inline">Canlı</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar max-h-[350px]">
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

                                            <button
                                                onClick={() => setSelectedActivity(activity)}
                                                className="ml-auto p-1.5 hover:bg-white/10 rounded-lg text-purple-300 hover:text-white transition-colors group"
                                                title="Detay Görüntüle"
                                            >
                                                <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                            </button>
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
                                {searchTerm ? 'Sonuç bulunamadı' : 'Henüz aktivite yok'}
                            </div>
                        )}

                        {hasMore && activities.length > 0 && (
                            <button
                                onClick={loadMoreActivities}
                                disabled={loadingMore}
                                className="w-full py-3 mt-4 text-sm font-medium text-purple-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Yükleniyor...
                                    </>
                                ) : (
                                    'Daha Fazla Yükle'
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Agent Stats */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-6 h-6 text-purple-400" />
                        <h2 className="text-xl font-bold text-white">Agent İstatistikleri</h2>
                        <SectionInfo
                            text="Her bir agent'ın günlük performansını, tamamlama oranlarını ve randevu sayılarını gösterir."
                        />
                    </div>

                    <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                        {agentStats
                            .sort((a, b) => b.completed_today - a.completed_today)
                            .map((agent) => (
                                <div
                                    key={agent.agent_id}
                                    className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                {agent.avatar_url ? (
                                                    <img src={agent.avatar_url} alt={agent.agent_name} className="w-10 h-10 rounded-full object-cover border border-white/20" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold border border-white/20">
                                                        {agent.agent_name.charAt(0)}
                                                    </div>
                                                )}
                                                <div className="absolute -bottom-1 -right-1 bg-black/80 text-white text-[9px] px-1 py-0.5 rounded-full border border-white/20 font-mono">
                                                    Lvl {agent.level || 1}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white text-sm">{agent.agent_name}</div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRankColor(agent.rank)} font-medium uppercase tracking-wider`}>
                                                    {agent.rank || 'Çaylak'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-purple-300 font-mono bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
                                            {agent.completion_rate}%
                                        </span>
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
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Package className="w-6 h-6 text-purple-400" />
                        <h2 className="text-xl font-bold text-white">Batch İlerlemesi</h2>
                        <SectionInfo
                            text="Yüklediğiniz veri setlerinin (Excel/CSV) işlenme durumunu ve doluluk oranlarını takip edin."
                        />
                    </div>
                    <button
                        onClick={() => setShowAllBatches(!showAllBatches)}
                        className={`p-2 rounded-lg transition-colors ${showAllBatches ? 'bg-purple-600 text-white' : 'bg-white/5 text-purple-300 hover:text-white'}`}
                        title={showAllBatches ? "Eskileri Gizle" : "Eskileri Göster"}
                    >
                        <Eye className="w-5 h-5" />
                    </button>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${showAllBatches ? 'max-h-[350px] overflow-y-auto custom-scrollbar pr-2' : ''}`}>
                    {(showAllBatches ? batches : batches.slice(0, 1)).map((batch) => (
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

            <ActivityDetailModal
                isOpen={!!selectedActivity}
                onClose={() => setSelectedActivity(null)}
                activity={selectedActivity}
            />

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
