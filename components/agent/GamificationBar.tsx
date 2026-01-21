'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Star, Flame, Zap } from 'lucide-react';
import { AgentProgress } from '@/types'; // We might need to define this type or just use standard fetch

export default function GamificationBar({ agentId }: { agentId: string }) {
    const [progress, setProgress] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Level calc logic (simple version for UI)
    // Level N requires N * 1000 XP (Linear) or quadratic? 
    // Let's assume database stores current_level and we use specific thresholds.
    // Ideally backend logic handles leveling, but let's visualize based on total_xp.
    // For now, we trust database 'level' field.

    // Level thresholds for display (Example: Level 1 -> 2 needs 1000 XP)
    const getNextLevelXp = (level: number) => level * 1000;

    useEffect(() => {
        const loadProgress = async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('agent_progress')
                .select('*')
                .eq('agent_id', agentId)
                .single();

            if (data) {
                setProgress(data);
            } else {
                // Init if empty
                const { data: newData } = await supabase
                    .from('agent_progress')
                    .insert({ agent_id: agentId })
                    .select()
                    .single();
                setProgress(newData);
            }
            setLoading(false);
        };
        loadProgress();
    }, [agentId]);

    if (loading || !progress) return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse h-24"></div>
    );

    const nextLevelXp = getNextLevelXp(progress.current_level);
    const currentLevelBaseXp = getNextLevelXp(progress.current_level - 1);
    const xpInLevel = progress.total_xp - currentLevelBaseXp;
    const xpNeeded = nextLevelXp - currentLevelBaseXp;

    // Safe guard for calculation if math is weird for level 1
    const percent = Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));

    // Rank Names based on level
    const getRankName = (lvl: number) => {
        if (lvl < 5) return 'Çaylak Temsilci';
        if (lvl < 10) return 'Satış Uzmanı';
        if (lvl < 20) return 'Kıdemli Temsilci';
        if (lvl < 50) return 'Yıldız Satıcı';
        return 'Efsane';
    };

    return (
        <div className="bg-gradient-to-r from-violet-900/50 to-fuchsia-900/50 border border-purple-500/30 rounded-xl p-4 relative overflow-hidden group">

            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/30 transition-all duration-500"></div>

            <div className="flex items-center justify-between mb-2 relative z-10">
                <div className="flex items-center gap-3">
                    {/* Level Badge */}
                    <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-lg transform rotate-3 flex items-center justify-center shadow-lg border-2 border-yellow-200/50">
                            <span className="text-xl font-black text-white drop-shadow-md">{progress.current_level}</span>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-yellow-400 border border-yellow-500/30">
                            LVL
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-white leading-tight">{getRankName(progress.current_level)}</h3>
                        <p className="text-xs text-purple-200 font-mono">
                            {progress.total_xp.toLocaleString()} XP
                        </p>
                    </div>
                </div>

                {/* Streak Counter */}
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 text-orange-400">
                        <Flame className={`w-5 h-5 ${progress.current_streak > 0 ? 'fill-orange-500 animate-pulse' : ''}`} />
                        <span className="text-xl font-black">{progress.current_streak}</span>
                    </div>
                    <span className="text-[10px] text-orange-300/80 uppercase tracking-wider font-bold">Günlük Seri</span>
                </div>
            </div>

            {/* XP Bar */}
            <div className="mt-3 relative z-10">
                <div className="flex justify-between text-[10px] text-purple-300 mb-1 font-medium">
                    <span>SEVİYE {progress.current_level}</span>
                    <span>{Math.floor(percent)}%</span>
                    <span>SEVİYE {progress.current_level + 1}</span>
                </div>
                <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-1000 ease-out"
                        style={{ width: `${percent}%` }}
                    >
                        {/* Shimmer effect */}
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer"></div>
                    </div>
                </div>
                <div className="mt-1 text-center text-[10px] text-gray-400">
                    Sonraki seviye için {Math.round(xpNeeded - xpInLevel)} XP kaldı
                </div>
            </div>
        </div>
    );
}
