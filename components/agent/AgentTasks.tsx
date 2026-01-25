'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Phone, Zap, Target, Flame, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

interface Task {
    id: string;
    title: string;
    description: string;
    icon_name: string;
    xp_reward: number;
    unlocked_at?: string;
}

const IconMap: Record<string, any> = {
    Trophy, Phone, Zap, Target, Flame
};

export default function AgentTasks({ agentId }: { agentId: string }) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

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

                    // Sort: Unlocked last (they are done), Locked first (to do).
                    // Within locked: By XP reward (easier/small first? or big first? Let's do XP asc for "steps")
                    merged.sort((a, b) => {
                        const aUnlocked = !!a.unlocked_at;
                        const bUnlocked = !!b.unlocked_at;
                        if (aUnlocked && !bUnlocked) return 1;
                        if (!aUnlocked && bUnlocked) return -1;
                        // If both locked or both unlocked, sort by XP
                        return a.xp_reward - b.xp_reward;
                    });

                    setTasks(merged);
                }
            };

            const { data: unlocked } = await supabase
                .from('agent_achievements')
                .select('achievement_id, unlocked_at')
                .eq('agent_id', agentId);

            mergeData(unlocked || []);
            setLoading(false);
        };

        load();
    }, [agentId]);

    if (loading) return <div className="h-40 flex items-center justify-center text-purple-300/50 text-sm">Yükleniyor...</div>;

    // Show top 5 tasks
    const visibleTasks = tasks.slice(0, 5);

    return (
        <div className="space-y-1">
            {visibleTasks.map((task, index) => {
                const isCompleted = !!task.unlocked_at;
                const Icon = IconMap[task.icon_name] || Target;

                return (
                    <div
                        key={task.id}
                        className={clsx(
                            "group flex items-center gap-3 p-2 rounded-lg transition-all duration-200",
                            isCompleted
                                ? "opacity-50 hover:opacity-100"
                                : "hover:bg-white/5"
                        )}
                        title={task.description} // Tooltip for description
                    >
                        {/* Status/Icon */}
                        <div className={clsx(
                            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border",
                            isCompleted ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-white/5 border-white/10 text-slate-400"
                        )}>
                            {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />}
                        </div>

                        {/* Title & Description */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className={clsx(
                                "text-sm font-medium truncate leading-tight",
                                isCompleted ? "text-purple-200/50 line-through" : "text-slate-200"
                            )}>
                                {task.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate leading-tight opacity-80 group-hover:opacity-100 transition-opacity">
                                {task.description}
                            </p>
                        </div>

                        {/* Reward */}
                        <div className="flex-shrink-0">
                            {!isCompleted && (
                                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                    +{task.xp_reward} XP
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            {tasks.length > 5 && (
                <button className="w-full pt-2 text-[10px] text-center text-slate-500 hover:text-purple-300 transition-colors">
                    +{tasks.length - 5} diğer görev...
                </button>
            )}
        </div>
    );
}
