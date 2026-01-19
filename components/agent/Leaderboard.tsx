'use client';

import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Loader2 } from 'lucide-react';
import type { LeaderboardEntry } from '@/types';

interface LeaderboardProps {
    agentId: string;
    refreshKey: number;
}

export default function Leaderboard({ agentId, refreshKey }: LeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [userStats, setUserStats] = useState({ processed_today: 0, total_assigned: 0, remaining: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLeaderboard();

        // Refresh every 30 seconds
        const interval = setInterval(loadLeaderboard, 30000);
        return () => clearInterval(interval);
    }, [refreshKey]);

    const loadLeaderboard = async () => {
        try {
            const response = await fetch(`/api/stats?agentId=${agentId}`);
            const data = await response.json();

            if (response.ok) {
                setLeaderboard(data.leaderboard || []);
                setUserStats(data.currentUserStats || { processed_today: 0, total_assigned: 0, remaining: 0 });
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
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-white/20 pb-4">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-bold text-white">Liderlik Tablosu</h3>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-1 gap-3">
                <div className="bg-purple-500/20 rounded-lg p-3 border border-purple-500/30">
                    <div className="text-purple-200 text-xs mb-1">Bugün İşlenen</div>
                    <div className="text-2xl font-bold text-white">{userStats.processed_today}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-purple-300 text-xs mb-1">Toplam Atanan</div>
                    <div className="text-lg font-semibold text-white">{userStats.total_assigned}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-purple-300 text-xs mb-1">Kalan</div>
                    <div className="text-lg font-semibold text-yellow-300">{userStats.remaining}</div>
                </div>
            </div>

            {/* Leaderboard */}
            <div>
                <div className="flex items-center gap-2 text-purple-200 text-sm mb-3">
                    <TrendingUp className="w-4 h-4" />
                    <span>Bugünkü Performans</span>
                </div>

                <div className="space-y-2">
                    {leaderboard.map((entry, index) => {
                        const isCurrentUser = entry.agent_id === agentId;
                        const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

                        return (
                            <div
                                key={entry.agent_id}
                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isCurrentUser
                                        ? 'bg-purple-500/30 border-2 border-purple-400'
                                        : 'bg-white/5 border border-white/10'
                                    }`}
                            >
                                <div className={`font-bold text-lg w-6 ${rankColors[index] || 'text-purple-300'}`}>
                                    #{entry.rank}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className={`font-semibold truncate ${isCurrentUser ? 'text-white' : 'text-purple-100'}`}>
                                        {entry.agent_name}
                                        {isCurrentUser && (
                                            <span className="ml-2 text-xs bg-purple-600 px-2 py-0.5 rounded-full">Siz</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-purple-300">{entry.processed_count} lead</div>
                                </div>

                                {index < 3 && (
                                    <Trophy className={`w-5 h-5 ${rankColors[index]}`} />
                                )}
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

            <div className="text-xs text-purple-300/60 text-center pt-4 border-t border-white/10">
                Her 30 saniyede otomatik güncellenir
            </div>
        </div>
    );
}
