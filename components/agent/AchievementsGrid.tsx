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
                    merged.sort((a, b) => {
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

    return (
        <div className="flex flex-wrap gap-6 justify-center">
            {achievements.map((ach) => {
                const isUnlocked = !!ach.unlocked_at;
                const Icon = IconMap[ach.icon_name] || Trophy;

                return (
                    <DisplayCard
                        key={ach.id}
                        title={ach.title}
                        description={ach.description}
                        date={isUnlocked ? `Kazanıldı: ${new Date(ach.unlocked_at!).toLocaleDateString()}` : `Ödül: ${ach.xp_reward} XP`}
                        icon={<Icon className={clsx("size-4", isUnlocked ? "text-yellow-300" : "text-gray-400")} />}
                        className={clsx(
                            "w-full sm:w-[20rem] h-auto min-h-[9rem]", // Override default fixed width
                            isUnlocked
                                ? "bg-purple-900/40 border-purple-500/50 hover:bg-purple-900/60"
                                : "grayscale opacity-60 bg-white/5 border-white/5 hover:opacity-100"
                        )}
                        titleClassName={isUnlocked ? "text-white" : "text-gray-400"}
                        iconClassName={isUnlocked ? "text-yellow-400" : "text-gray-500"}
                    />
                );
            })}
        </div>
    );
}
