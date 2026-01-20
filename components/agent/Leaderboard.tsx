'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Loader2, Zap, Flame, Target } from 'lucide-react';
import type { LeaderboardEntry } from '@/types';

interface ExtendedLeaderboardEntry extends LeaderboardEntry {
    remaining_count?: number;
    last_activity?: string;
    streak?: number;
    speed_last_5min?: number;
}

interface LeaderboardProps {
    agentId: string;
    refreshKey: number;
}

export default function Leaderboard({ agentId, refreshKey }: LeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<ExtendedLeaderboardEntry[]>([]);
    const [userStats, setUserStats] = useState({
        processed_today: 0,
        total_assigned: 0,
        remaining: 0,
        streak: 0,
        speed_last_5min: 0
    });
    const [loading, setLoading] = useState(true);
    const [activityPulse, setActivityPulse] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadLeaderboard();

        // Silent auto-refresh every 5 seconds
        const interval = setInterval(loadLeaderboard, 5000);
        return () => clearInterval(interval);
    }, [refreshKey]);

    const loadLeaderboard = async () => {
        try {
            const response = await fetch(`/api/stats?agentId=${agentId}`);
            const data = await response.json();

            if (response.ok) {
                const newLeaderboard = data.leaderboard || [];

                // Check for activity changes
                newLeaderboard.forEach((entry: ExtendedLeaderboardEntry) => {
                    const oldEntry = leaderboard.find(e => e.agent_id === entry.agent_id);
                    if (oldEntry && oldEntry.processed_count < entry.processed_count) {
                        // New lead processed! Trigger pulse
                        setActivityPulse(prev => ({ ...prev, [entry.agent_id]: true }));
                        setTimeout(() => {
                            setActivityPulse(prev => ({ ...prev, [entry.agent_id]: false }));
                        }, 2000);
                    }
                });

                setLeaderboard(newLeaderboard);
                setUserStats(data.currentUserStats || {
                    processed_today: 0,
                    total_assigned: 0,
                    remaining: 0,
                    streak: 0,
                    speed_last_5min: 0
                });
            }
        } catch (err) {
            console.error('Leaderboard load error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 space-y-6">
            {/* Header with Online Status */}
            <div className="flex items-center justify-between border-b border-white/20 pb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-purple-400" />
                    <h3 className="text-xl font-bold text-white">Takım Performansı</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                    </div>
                    <span className="text-xs text-green-300 font-medium">Canlı</span>
                </div>
            </div>

            {/* User Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-purple-500/20 rounded-lg p-3 border border-purple-500/30 col-span-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-purple-200 text-xs mb-1">Bugün İşlenen</div>
                            <div className="text-2xl font-bold text-white">{userStats.processed_today}</div>
                        </div>
                        {userStats.streak > 0 && (
                            <div className="flex items-center gap-1 bg-orange-500/20 px-2 py-1 rounded-lg">
                                <Flame className="w-4 h-4 text-orange-400" />
                                <span className="text-xs text-orange-300 font-bold">{userStats.streak}x</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                    <div className="text-purple-300 text-xs mb-1">Atanan</div>
                    <div className="text-lg font-semibold text-white">{userStats.total_assigned}</div>
                </div>

                <div className="bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/30">
                    <div className="text-yellow-300 text-xs mb-1">Kalan</div>
                    <div className="text-lg font-semibold text-yellow-300">{userStats.remaining}</div>
                </div>

                {userStats.speed_last_5min > 0 && (
                    <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/30 col-span-2">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-400" />
                            <div>
                                <div className="text-blue-300 text-xs">Verimlilik</div>
                                <div className="text-sm font-semibold text-blue-200">{userStats.speed_last_5min} lead/5dk</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Leaderboard */}
            <div>
                <div className="flex items-center gap-2 text-purple-200 text-sm mb-3">
                    <TrendingUp className="w-4 h-4" />
                    <span>Bugünkü İlerleme</span>
                </div>

                <div className="space-y-2">
                    {leaderboard.map((entry, index) => {
                        const isCurrentUser = entry.agent_id === agentId;
                        const hasPulse = activityPulse[entry.agent_id];

                        return (
                            <div
                                key={entry.agent_id}
                                className={`relative flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${isCurrentUser
                                        ? 'bg-purple-500/30 border-2 border-purple-400'
                                        : 'bg-white/5 border border-white/10'
                                    } ${hasPulse ? 'ring-2 ring-green-400 scale-105' : ''}`}
                            >
                                {/* Activity Pulse Indicator */}
                                {hasPulse && (
                                    <div className="absolute -top-1 -right-1">
                                        <div className="relative">
                                            <div className="w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                                            <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full"></div>
                                        </div>
                                    </div>
                                )}

                                {/* Rank Number */}
                                <div className="font-bold text-lg w-8 text-purple-300">
                                    #{entry.rank}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`font-semibold truncate ${isCurrentUser ? 'text-white' : 'text-purple-100'}`}>
                                            {entry.agent_name}
                                            {isCurrentUser && (
                                                <span className="ml-2 text-xs bg-purple-600 px-2 py-0.5 rounded-full">Siz</span>
                                            )}
                                        </div>
                                        {/* Online Indicator - Always show */}
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                    </div>

                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="text-xs text-purple-300">
                                            {entry.processed_count} lead
                                        </div>

                                        {/* Remaining Count */}
                                        {entry.remaining_count !== undefined && entry.remaining_count > 0 && (
                                            <div className="flex items-center gap-1 text-xs">
                                                <Target className="w-3 h-3 text-yellow-400" />
                                                <span className="text-yellow-400 font-medium">{entry.remaining_count} kaldı</span>
                                            </div>
                                        )}

                                        {/* Streak - only show if > 2 */}
                                        {entry.streak && entry.streak > 2 && (
                                            <div className="flex items-center gap-1 text-xs">
                                                <Flame className="w-3 h-3 text-orange-400" />
                                                <span className="text-orange-400 font-medium">{entry.streak}x</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {leaderboard.length === 0 && (
                        <div className="text-center py-6 text-purple-300 text-sm">
                            Henüz veri yok
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
