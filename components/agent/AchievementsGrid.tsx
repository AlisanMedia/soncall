'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Phone, Zap, Target, Flame, Lock } from 'lucide-react';
import { clsx } from 'clsx';

interface Achievement {
    id: string;
    slug: string;
    title: string;
    description: string;
    icon_name: string;
    category: string;
    xp_reward: number;
    unlocked_at?: string; // If present, user has it
}

const IconMap: Record<string, any> = {
    Trophy, Phone, Zap, Target, Flame
};

export default function AchievementsGrid({ agentId }: { agentId: string }) {
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();

            // Fetch definitions
            const { data: defs } = await supabase
                .from('achievement_definitions')
                .select('*');

            // Fetch unlocked
            const { data: unlocked } = await supabase
                .from('agent_achievements')
                .select('achievement_id, unlocked_at')
                .eq('agent_id', agentId);

            if (defs) {
                // Merge data
                const merged = defs.map(def => ({
                    ...def,
                    unlocked_at: unlocked?.find(u => u.achievement_id === def.id)?.unlocked_at
                }));
                // Sort by unlocked first, then xp reward
                merged.sort((a, b) => {
                    if (a.unlocked_at && !b.unlocked_at) return -1;
                    if (!a.unlocked_at && b.unlocked_at) return 1;
                    return b.xp_reward - a.xp_reward;
                });
                setAchievements(merged);
            }
            setLoading(false);
        };
        load();
    }, [agentId]);

    if (loading) return <div className="text-center p-4 text-gray-400">Yükleniyor...</div>;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {achievements.map((ach) => {
                const isUnlocked = !!ach.unlocked_at;
                const Icon = IconMap[ach.icon_name] || Trophy;

                return (
                    <div
                        key={ach.id}
                        className={clsx(
                            "relative aspect-square rounded-xl p-3 flex flex-col items-center justify-center text-center border transition-all duration-300 group",
                            isUnlocked
                                ? "bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border-purple-500/30 hover:border-purple-400 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20"
                                : "bg-white/5 border-white/5 grayscale opacity-50 hover:opacity-75"
                        )}
                        title={isUnlocked ? `Kazanıldı: ${new Date(ach.unlocked_at!).toLocaleDateString()}` : "Kilitli"}
                    >
                        <div className={clsx(
                            "w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-inner",
                            isUnlocked ? "bg-white/10 text-yellow-400" : "bg-black/20 text-gray-500"
                        )}>
                            {isUnlocked ? <Icon className="w-5 h-5 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" /> : <Lock className="w-4 h-4" />}
                        </div>

                        <h4 className="text-xs font-bold text-white mb-1 line-clamp-1">{ach.title}</h4>
                        <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">{ach.description}</p>

                        {/* XP Badge */}
                        <div className={clsx(
                            "absolute top-2 right-2 text-[9px] font-mono px-1.5 rounded-full border",
                            isUnlocked ? "bg-yellow-500/20 text-yellow-200 border-yellow-500/30" : "bg-gray-800 text-gray-500 border-gray-700"
                        )}>
                            +{ach.xp_reward}XP
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
