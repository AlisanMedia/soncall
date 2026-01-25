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

import { DisplayCard } from '@/components/ui/display-cards';

// ... (imports remain the same, ensure DisplayCard is imported)

export default function AchievementsGrid({ agentId }: { agentId: string }) {
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);

    // ... (useEffect logic remains the same)

    // ... load logic ...

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();

            // Fetch definitions
            const { data: defs } = await supabase
                .from('achievement_definitions')
                .select('*');

            const mergeData = (unlocked: any[]) => {
                if (defs) {
                    const merged = defs.map(def => ({
                        ...def,
                        unlocked_at: unlocked?.find(u => u.achievement_id === def.id)?.unlocked_at
                    }));
                    // SORTING LOGIC: Newest unlocked first, then locked by XP
                    merged.sort((a, b) => {
                        if (a.unlocked_at && b.unlocked_at) {
                            return new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime();
                        }
                        if (a.unlocked_at && !b.unlocked_at) return -1;
                        if (!a.unlocked_at && b.unlocked_at) return 1;
                        return b.xp_reward - a.xp_reward;
                    });
                    setAchievements(merged);
                }
            };

            const { data: unlocked } = await supabase
                .from('agent_achievements')
                .select('achievement_id, unlocked_at')
                .eq('agent_id', agentId);

            mergeData(unlocked || []);
            setLoading(false);

            const channel = supabase
                .channel('agent_achievements_updates')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'agent_achievements',
                        filter: `agent_id=eq.${agentId}`
                    },
                    (payload) => {
                        supabase
                            .from('agent_achievements')
                            .select('achievement_id, unlocked_at')
                            .eq('agent_id', agentId)
                            .then(({ data: freshUnlocked }) => {
                                mergeData(freshUnlocked || []);
                            });
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        load();
    }, [agentId]);

    if (loading) return <div className="text-center p-4 text-gray-400">Yükleniyor...</div>;

    // Display only top 6 cards to avoid clutter, or render all but hidden?
    // Let's render top 5 visibly stacked
    const visibleAchievements = achievements.slice(0, 5);

    return (
        <div className="flex items-center justify-center py-4 min-h-[250px]">
            <div className="grid [grid-template-areas:'stack'] place-items-center">
                {visibleAchievements.map((ach, index) => {
                    const isUnlocked = !!ach.unlocked_at;
                    const Icon = IconMap[ach.icon_name] || Trophy;

                    // Stacking calculations (Compacted)
                    const xOffset = index * 8; // Reduced from 20
                    const yOffset = index * 8; // Reduced from 20
                    const scale = 1 - (index * 0.05);
                    const zIndex = 50 - index;
                    const opacity = 1 - (index * 0.1);

                    return (
                        <div
                            key={ach.id}
                            className={clsx(
                                "transition-all duration-700 ease-out [grid-area:stack]",
                                "hover:z-[60] hover:scale-105 hover:!translate-x-0 hover:!translate-y-0"
                            )}
                            style={{
                                transform: `translateX(${xOffset}px) translateY(${yOffset}px) scale(${scale})`,
                                zIndex: zIndex,
                                opacity: opacity
                            }}
                        >
                            <DisplayCard
                                title={ach.title}
                                description={ach.description}
                                date={isUnlocked ? `Kazanıldı: ${new Date(ach.unlocked_at!).toLocaleDateString()}` : `Ödül: ${ach.xp_reward} XP`}
                                icon={<Icon className={clsx("size-4", isUnlocked ? "text-yellow-300" : "text-gray-400")} />}
                                className={clsx(
                                    "w-[18rem] h-28 shadow-xl", // Compacted size
                                    isUnlocked
                                        ? "bg-purple-900/80 border-purple-500/50 backdrop-blur-md"
                                        : "grayscale opacity-80 bg-slate-900/80 border-white/10"
                                )}
                                titleClassName={clsx("text-base truncate", isUnlocked ? "text-white" : "text-gray-400")} // Smaller text
                                iconClassName={isUnlocked ? "text-yellow-400" : "text-gray-500"}
                            />
                        </div>
                    );
                })}
                {achievements.length === 0 && (
                    <div className="text-gray-400 text-sm">Henüz başarım yok.</div>
                )}
            </div>
        </div>
    );
}
