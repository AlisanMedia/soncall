'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Loader2, Phone, Sparkles, Calendar, CheckCircle2, Package, TrendingUp, Eye, Search, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { playActivityNotification } from '@/lib/sounds';
import { SectionInfo } from '@/components/ui/section-info';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { GlassButton } from '@/components/ui/glass-button';
import { StatusIndicator, isAgentOnline } from '@/components/ui/status-indicator';
import ActivityDetailModal from './ActivityDetailModal';
import BatchDetailModal from './BatchDetailModal';
import type { Profile } from '@/types';
import { createClient } from '@/lib/supabase/client';

interface ActivityItem {
    id: string;
    action: string;
    created_at: string;
    agent_id: string;
    lead_id: string;
    note: string | null;
    action_taken: string | null;
    profiles?: {
        full_name: string;
        avatar_url?: string;
    } | null;
    leads?: {
        business_name: string;
        phone_number: string;
        status: string;
        potential_level: string;
    } | null;
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
    last_activity_timestamp?: string | null;
}

export default function TeamMonitoring() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [batches, setBatches] = useState<BatchStat[]>([]);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const [showAllBatches, setShowAllBatches] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [newActivitiesCount, setNewActivitiesCount] = useState(0);

    // Refs for infinite scroll and scroll management
    const observerTarget = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isUserScrolled = useRef(false);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setActivities([]); // Clear on search change
            setHasMore(true);
            loadInitialData();
        }, 300); // Debounce search

        // Auto-refresh every 5 seconds for "Live" feel
        const interval = setInterval(() => loadLatestActivities(), 5000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeoutId);
        };
    }, [searchTerm]);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
                    loadMoreActivities();
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [hasMore, loadingMore, loading, activities.length]);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop } = scrollContainerRef.current;
            // If scrolled down more than 50px, consider user "scrolled away"
            isUserScrolled.current = scrollTop > 50;

            if (scrollTop <= 50) {
                setNewActivitiesCount(0); // Reset badge when at top
            }
        }
    };

    const scrollToTop = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            setNewActivitiesCount(0);
        }
    };

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
                console.log('[TeamMonitoring] Initial Data:', data);
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
        if (loading || loadingMore || searchTerm) return; // Don't auto-refresh during intensive operations or search

        try {
            // Fetch only the very latest few to check for updates
            const res = await fetch('/api/manager/activity?limit=20&offset=0');
            if (res.ok) {
                const data = await res.json();
                console.log('[TeamMonitoring] Latest Activities:', data);
                const fetchedActivities = data.activities || [];

                if (fetchedActivities.length === 0) return;

                setActivities(prev => {
                    const currentIds = new Set(prev.map(a => a.id));
                    const newItems = fetchedActivities.filter((a: ActivityItem) => !currentIds.has(a.id));

                    if (newItems.length > 0) {
                        playActivityNotification();

                        // If user is scrolled down, just track count
                        if (isUserScrolled.current) {
                            setNewActivitiesCount(n => n + newItems.length);
                        }

                        const combined = [...newItems, ...prev];
                        // Limit to 1000 items in memory to prevent performance issues
                        return combined.slice(0, 1000);
                    }
                    return prev;
                });
            }

            // Refresh stats silently
            Promise.all([
                fetch('/api/manager/batches'),
                fetch('/api/manager/overview'),
            ]).then(([batchesRes, overviewRes]) => {
                if (batchesRes.ok) batchesRes.json().then(d => setBatches(d.batches || []));
                if (overviewRes.ok) overviewRes.json().then(d => {
                    setOverview(d.overview);
                    setAgentStats(d.agent_stats || []);
                });
            });

        } catch (err) {
            console.error('Error refreshing data:', err);
        }
    };

    const loadMoreActivities = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const currentCount = activities.length;
            const limit = 50;
            const searchQuery = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';

            // Don't load more if we reached strict 1000 limit
            if (currentCount >= 1000) {
                setHasMore(false);
                setLoadingMore(false);
                return;
            }

            const res = await fetch(`/api/manager/activity?limit=${limit}&offset=${currentCount}${searchQuery}`);

            if (res.ok) {
                const data = await res.json();
                const olderActivities = data.activities || [];

                if (olderActivities.length < limit) {
                    setHasMore(false);
                }

                if (olderActivities.length > 0) {
                    setActivities(prev => {
                        const combined = [...prev, ...olderActivities];
                        // Deduplicate
                        const unique = combined.filter((activity, index, self) =>
                            index === self.findIndex((a) => a.id === activity.id)
                        );
                        return unique;
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
                    <div className="glass-card glass-card-hover p-6 relative">
                        <GlowingEffect spread={30} glow={true} disabled={false} proximity={80} borderWidth={2} />
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
                                transition={{ duration: 0.5 }}
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
                                transition={{ duration: 0.5 }}
                            >
                                <Calendar className="w-10 h-10 text-purple-400" />
                            </motion.div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {/* Live Activity Feed */}
                <div className="glass-card glass-card-hover p-0 overflow-hidden relative border border-purple-500/20 shadow-2xl">
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <div className="absolute inset-0 bg-green-500 blur-md opacity-20 animate-pulse"></div>
                                <Activity className="w-6 h-6 text-green-400 relative z-10" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    Canlı Aktivite Akışı
                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 animate-pulse">
                                        LIVE
                                    </span>
                                </h2>
                                <p className="text-xs text-purple-300 mt-0.5">Takımınızın anlık aksiyonlarını buradan takip edin.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="w-4 h-4 text-purple-300 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Aktivite veya Personel Ara..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-black/40 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 w-full md:w-64 transition-all focus:bg-black/60 focus:ring-1 focus:ring-purple-500/50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* New Activity Notification Badge */}
                    <AnimatePresence>
                        {newActivitiesCount > 0 && (
                            <motion.button
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                onClick={scrollToTop}
                                className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full shadow-lg border border-white/20 flex items-center gap-2 text-sm font-medium transition-colors"
                            >
                                <ArrowUp className="w-4 h-4" />
                                {newActivitiesCount} Yeni Aktivite
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* Scrollable Feed Container - Fixed Height */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="overflow-y-auto custom-scrollbar h-[600px] relative bg-black/20"
                    >
                        <div className="p-4 space-y-3">
                            {activities.map((activity, index) => (
                                <motion.div
                                    key={activity.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index < 10 ? index * 0.05 : 0 }}
                                    className="bg-gradient-to-r from-white/5 to-transparent rounded-xl p-4 border border-white/5 hover:border-purple-500/30 hover:bg-white/10 transition-all group relative"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Agent Avatar */}
                                        <div className="mt-1 flex-shrink-0 relative">
                                            {activity.profiles?.avatar_url ? (
                                                <img
                                                    src={activity.profiles.avatar_url}
                                                    alt={activity.profiles.full_name || 'Agent'}
                                                    className="w-12 h-12 rounded-full object-cover border-2 border-white/10 group-hover:border-purple-500/50 transition-colors"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-white font-bold border-2 border-white/10 group-hover:border-purple-500/50 transition-colors">
                                                    {(activity.profiles?.full_name || '?').charAt(0)}
                                                </div>
                                            )}
                                            {/* Action Badge */}
                                            <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-1.5 border border-white/10 shadow-sm">
                                                {getActionIcon(activity.action_taken)}
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-bold text-white text-base">
                                                    {activity.profiles?.full_name || 'Bilinmeyen Ajan'}
                                                </span>
                                                <span className="text-purple-400/50 text-xs">●</span>
                                                <span className="text-purple-200 font-medium truncate max-w-[200px]">
                                                    {activity.leads?.business_name || 'Bilinmeyen Müşteri'}
                                                </span>
                                                {activity.leads?.potential_level && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ml-auto ${getPotentialColor(activity.leads.potential_level)}`}>
                                                        {activity.leads.potential_level?.toUpperCase()}
                                                    </span>
                                                )}
                                            </div>

                                            {activity.note && (
                                                <div className="bg-black/30 rounded-lg p-3 mt-2 border border-white/5">
                                                    <p className="text-sm text-gray-300 leading-relaxed italic">
                                                        "{activity.note}"
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mt-3">
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {activity.leads?.phone_number || '-'}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-mono text-purple-400/70">
                                                    {formatTime(activity.created_at)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <GlassButton
                                                onClick={() => setSelectedActivity(activity)}
                                                size="icon"
                                                className="bg-white/5 hover:bg-purple-600"
                                            >
                                                <Eye className="w-4 h-4 text-white" />
                                            </GlassButton>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Sentinel for Infinite Scroll */}
                            <div ref={observerTarget} className="h-10 flex items-center justify-center w-full">
                                {loadingMore && <Loader2 className="w-6 h-6 animate-spin text-purple-500" />}
                                {!hasMore && activities.length > 0 && (
                                    <span className="text-xs text-gray-600">— Tüm kayıtlar yüklendi —</span>
                                )}
                            </div>

                            {activities.length === 0 && !loading && (
                                <div className="text-center py-20 bg-white/5 rounded-xl border border-dashed border-white/10">
                                    <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">Henüz bir aktivite kaydı bulunmuyor.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Agent Stats */}
                <div className="glass-card glass-card-hover p-6">
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
                                                {/* Online Status Indicator */}
                                                <StatusIndicator isOnline={isAgentOnline(agent.last_activity_timestamp)} size="sm" />
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
                    <GlassButton
                        onClick={() => setShowAllBatches(!showAllBatches)}
                        size="icon"
                        className={`${showAllBatches ? '[&>.glass-button]:!bg-purple-600 [&>.glass-button]:text-white' : ''}`}
                        title={showAllBatches ? "Eskileri Gizle" : "Eskileri Göster"}
                    >
                        <Eye className={`w-5 h-5 ${showAllBatches ? 'text-white' : 'text-purple-300'}`} />
                    </GlassButton>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${showAllBatches ? 'max-h-[350px] overflow-y-auto custom-scrollbar pr-2' : ''}`}>
                    {(showAllBatches ? batches : batches.slice(0, 3)).map((batch) => (
                        <div key={batch.id} className="bg-white/5 rounded-lg p-4 border border-white/10 group hover:border-purple-500/30 transition-colors relative">
                            {/* Action Overlay (Visible on Hover) */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <GlassButton
                                    onClick={() => setSelectedBatchId(batch.id)}
                                    size="icon"
                                    className="scale-75 [&>.glass-button]:!bg-purple-600 [&>.glass-button]:!p-1.5 hover:[&>.glass-button]:!bg-purple-500 shadow-lg"
                                    title="Detaylı İncele"
                                >
                                    <Search className="w-3 h-3 text-white" />
                                </GlassButton>
                                {/* Direct quick export can also be added here, but inside modal is cleaner for filters */}
                            </div>

                            <div className="mb-3">
                                <p className="text-white font-medium truncate pr-8">{batch.filename}</p>
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

            <BatchDetailModal
                isOpen={!!selectedBatchId}
                onClose={() => setSelectedBatchId(null)}
                batchId={selectedBatchId}
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
