'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Star, Flame, Zap, Sprout, Swords, Gem, Crown } from 'lucide-react';
import { AgentProgress } from '@/types';
import { getRankInfo } from '@/lib/gamification';

export default function GamificationBar({ agentId }: { agentId: string }) {
    const [progress, setProgress] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Level calc logic based on 1000 XP per level
    const getNextLevelXp = (level: number) => level * 1000;

    useEffect(() => {
        let channel: any;

        const loadProgress = async () => {
            const supabase = createClient();

            // 1. Initial Load
            const { data, error } = await supabase
                .from('agent_progress')
                .select('*')
                .eq('agent_id', agentId)
                .single();

            if (data) {
                setProgress(data);
            } else {
                const { data: newData } = await supabase
                    .from('agent_progress')
                    .insert({ agent_id: agentId })
                    .select()
                    .single();
                setProgress(newData);
            }
            setLoading(false);

            // 2. Realtime Subscription
            channel = supabase
                .channel('agent_xp_updates')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'agent_progress',
                        filter: `agent_id=eq.${agentId}`
                    },
                    (payload) => {
                        console.log('Realtime XP Update:', payload.new);
                        setProgress(payload.new as any);
                    }
                )
                .subscribe();
        };

        loadProgress();

        return () => {
            if (channel) {
                const supabase = createClient();
                supabase.removeChannel(channel);
            }
        };
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

    // GAMIFICATION 2.0 - RANK LOGIC
    const rank = getRankInfo(progress.current_level);

    // Map icon string to component
    const IconComponent = () => {
        if (rank.icon === 'Sprout') return <Sprout className="w-6 h-6 text-green-400" />;
        if (rank.icon === 'Swords') return <Swords className="w-6 h-6 text-slate-300" />;
        if (rank.icon === 'Flame') return <Flame className="w-6 h-6 text-orange-500 animate-pulse" />;
        if (rank.icon === 'Gem') return <Gem className="w-6 h-6 text-cyan-400" />;
        if (rank.icon === 'Crown') return <Crown className="w-6 h-6 text-purple-400" />;
        return <Sprout className="w-6 h-6 text-green-400" />;
    };

    return (
        <div className={`relative overflow-hidden group border rounded-xl p-4 transition-all duration-500 bg-gradient-to-r ${rank.color} bg-opacity-10 ${rank.border}`}>
            {/* Background Texture/Glow */}
            <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[60px] ${rank.bgGlow} opacity-50`}></div>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>

            <div className="relative z-10 flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    {/* Level Badge */}
                    <div className="relative transform transition-transform hover:scale-110 duration-300">
                        <div className="w-14 h-14 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl rotate-3 flex items-center justify-center shadow-2xl border border-white/20 backdrop-blur-md">
                            <span className="text-2xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{progress.current_level}</span>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10 shadow-lg">
                            LVL
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <IconComponent />
                            <h3 className="text-xl font-black text-white tracking-wide drop-shadow-lg">{rank.title}</h3>
                        </div>
                        <p className="text-sm text-white/70 font-mono tracking-tight ml-1">
                            {progress.total_xp.toLocaleString()} XP
                        </p>
                    </div>
                </div>

                {/* Streak Counter */}
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 text-white/90 bg-white/10 px-3 py-1 rounded-full border border-white/5 shadow-inner">
                        <Flame className={`w-4 h-4 ${progress.current_streak > 0 ? 'fill-orange-500 text-orange-500 animate-pulse' : 'text-gray-400'}`} />
                        <span className="text-lg font-bold">{progress.current_streak}</span>
                    </div>
                    <span className="text-[10px] text-white/50 uppercase tracking-wider font-bold mt-1 mr-1">Günlük Seri</span>
                </div>
            </div>

            {/* XP Bar */}
            <div className="mt-4 relative z-10">
                <div className="flex justify-between text-[10px] text-white/60 mb-1.5 font-bold tracking-wider">
                    <span>SEVİYE {progress.current_level}</span>
                    <span>%{Math.floor(percent)}</span>
                    <span className="opacity-50">SEVİYE {progress.current_level + 1}</span>
                </div>
                <div className="h-3.5 bg-black/50 rounded-full overflow-hidden border border-white/10 shadow-inner">
                    <div
                        className={`h-full bg-gradient-to-r ${rank.color} shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-1000 ease-out relative`}
                        style={{ width: `${percent}%` }}
                    >
                        {/* Shimmer effect */}
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer"></div>
                    </div>
                </div>
                <div className="mt-1.5 text-right text-[10px] text-white/40 font-mono">
                    Sonraki seviye için <span className="text-white/80 font-bold">{Math.round(xpNeeded - xpInLevel)} XP</span> kaldı
                </div>
            </div>
        </div>
    );
}
