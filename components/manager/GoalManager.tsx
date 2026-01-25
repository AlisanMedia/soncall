'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { Target, Phone, Save, ChevronLeft, ChevronRight, Trophy, RotateCcw, Check, Edit3 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionInfo } from '@/components/ui/section-info';

interface Goal {
    id: string;
    agent_id: string;
    target_sales: number;
    target_calls: number;
    current_sales: number;
    current_calls: number;
    period_key: string;
}

export default function GoalManager() {
    const [agents, setAgents] = useState<Profile[]>([]);
    const [goals, setGoals] = useState<Record<string, Goal>>({});
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [saving, setSaving] = useState<string | null>(null);
    const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

    const supabase = createClient();
    const periodKey = format(selectedDate, 'yyyy-MM');
    const periodLabel = format(selectedDate, 'MMMM yyyy', { locale: tr });

    useEffect(() => {
        loadData();
    }, [periodKey]);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: agentsData } = await supabase
                .from('profiles')
                .select('*')
                .in('role', ['agent', 'admin', 'manager', 'founder'])
                .order('full_name');

            if (agentsData) setAgents(agentsData);

            const { data: goalsData } = await supabase
                .from('goals')
                .select('*')
                .eq('period_key', periodKey);

            const goalsMap: Record<string, Goal> = {};
            goalsData?.forEach(g => {
                goalsMap[g.agent_id] = g;
            });
            setGoals(goalsMap);

        } catch (error) {
            console.error('Error loading goals:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGoalChange = (agentId: string, field: 'target_sales' | 'target_calls', value: string) => {
        const numValue = parseInt(value) || 0;
        setGoals(prev => ({
            ...prev,
            [agentId]: {
                ...prev[agentId],
                [field]: numValue,
                agent_id: agentId,
                period_key: periodKey
            } as Goal
        }));
    };

    const saveGoal = async (agentId: string) => {
        setSaving(agentId);
        try {
            const goalData = goals[agentId] || {
                agent_id: agentId,
                period_key: periodKey,
                target_sales: 0,
                target_calls: 0
            };

            const { data, error } = await supabase
                .from('goals')
                .upsert({
                    agent_id: agentId,
                    period_key: periodKey,
                    target_sales: goalData.target_sales,
                    target_calls: goalData.target_calls
                }, { onConflict: 'agent_id, period_key' })
                .select()
                .single();

            if (error) throw error;

            setGoals(prev => ({
                ...prev,
                [agentId]: data as Goal
            }));

            // Flip back after success
            setTimeout(() => {
                toggleFlip(agentId);
            }, 500);

        } catch (error) {
            console.error('Error saving goal:', error);
            alert('Hedef kaydedilemedi!');
        } finally {
            setSaving(null);
        }
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setSelectedDate(newDate);
    };

    const toggleFlip = (agentId: string) => {
        setFlippedCards(prev => ({
            ...prev,
            [agentId]: !prev[agentId]
        }));
    };

    if (loading) return (
        <div className="flex justify-center p-20">
            <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg shadow-purple-500/20">
                        <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Hedef Yönetimi
                            <SectionInfo text="Kartların üzerine tıklayarak hedefleri düzenleyebilirsiniz. 360° dönüşüm deneyimi." />
                        </h2>
                        <p className="text-purple-300 text-sm">Aylık performans hedefleri</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-black/40 rounded-xl p-1.5 border border-white/5 shadow-inner">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-mono font-bold text-white min-w-[120px] text-center text-sm">
                        {periodLabel}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Responsive Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {agents.map(agent => {
                    const goal = goals[agent.id] || { target_calls: 0, target_sales: 0 };
                    const isFlipped = flippedCards[agent.id];

                    // Progress calculations
                    const callProgress = goal.target_calls > 0 ? Math.min(100, ((goal.current_calls || 0) / goal.target_calls) * 100) : 0;
                    const salesProgress = goal.target_sales > 0 ? Math.min(100, ((goal.current_sales || 0) / goal.target_sales) * 100) : 0;

                    const hasActiveGoal = goal.target_calls > 0 || goal.target_sales > 0;

                    return (
                        <div key={agent.id} className="relative h-[280px] perspective-1000 group">
                            <motion.div
                                className="w-full h-full relative preserve-3d transition-all duration-500"
                                animate={{ rotateY: isFlipped ? 180 : 0 }}
                                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                            >
                                {/* Front Face */}
                                <div
                                    className="absolute inset-0 backface-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-between cursor-pointer hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/10 transition-all"
                                    onClick={() => toggleFlip(agent.id)}
                                >
                                    {/* Agent Header */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-14 h-14 rounded-full p-1 bg-gradient-to-br from-white/10 to-transparent border border-white/20">
                                            <div className="w-full h-full rounded-full overflow-hidden">
                                                {agent.avatar_url ? (
                                                    <img src={agent.avatar_url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white font-bold text-lg">
                                                        {agent.full_name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <h3 className="font-bold text-white text-lg leading-tight">{agent.full_name}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${hasActiveGoal ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                                                {hasActiveGoal ? 'HEDEF AKTİF' : 'HEDEF YOK'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress Rings */}
                                    <div className="flex items-center justify-center gap-6 w-full">
                                        {/* Calls Ring */}
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="relative w-16 h-16">
                                                <svg className="w-full h-full -rotate-90">
                                                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                                                    <circle
                                                        cx="32" cy="32" r="28"
                                                        stroke="currentColor" strokeWidth="4"
                                                        fill="transparent"
                                                        strokeDasharray={175.9}
                                                        strokeDashoffset={175.9 - (175.9 * callProgress) / 100}
                                                        className="text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                                                        strokeLinecap="round"
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Phone className="w-5 h-5 text-purple-200" />
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xs text-purple-300 font-bold">{goal.target_calls}</div>
                                                <div className="text-[9px] text-gray-500 uppercase">Arama</div>
                                            </div>
                                        </div>

                                        <div className="w-px h-10 bg-white/10" />

                                        {/* Sales Ring */}
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="relative w-16 h-16">
                                                <svg className="w-full h-full -rotate-90">
                                                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                                                    <circle
                                                        cx="32" cy="32" r="28"
                                                        stroke="currentColor" strokeWidth="4"
                                                        fill="transparent"
                                                        strokeDasharray={175.9}
                                                        strokeDashoffset={175.9 - (175.9 * salesProgress) / 100}
                                                        className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                                        strokeLinecap="round"
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Trophy className="w-5 h-5 text-emerald-200" />
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xs text-emerald-300 font-bold">{goal.target_sales}</div>
                                                <div className="text-[9px] text-gray-500 uppercase">Satış</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Edit3 className="w-4 h-4 text-white/50" />
                                    </div>
                                </div>

                                {/* Back Face (Edit Form) */}
                                <div
                                    className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 border border-purple-500/30 rounded-2xl p-6 flex flex-col justify-center gap-4 shadow-2xl"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="text-center mb-2">
                                        <h4 className="text-white font-bold">Hedef Düzenle</h4>
                                        <p className="text-xs text-gray-400">{agent.full_name}</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs text-purple-300 flex items-center gap-2">
                                                <Phone className="w-3 h-3" /> Arama Hedefi
                                            </label>
                                            <input
                                                type="number"
                                                value={goal.target_calls || ''}
                                                onChange={(e) => handleGoalChange(agent.id, 'target_calls', e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none transition-colors"
                                                placeholder="0"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs text-emerald-300 flex items-center gap-2">
                                                <Trophy className="w-3 h-3" /> Satış Hedefi
                                            </label>
                                            <input
                                                type="number"
                                                value={goal.target_sales || ''}
                                                onChange={(e) => handleGoalChange(agent.id, 'target_sales', e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        <button
                                            onClick={() => toggleFlip(agent.id)}
                                            className="py-2 rounded-lg text-xs font-bold text-gray-400 hover:bg-white/5 transition-colors"
                                        >
                                            İptal
                                        </button>
                                        <button
                                            onClick={() => saveGoal(agent.id)}
                                            disabled={saving === agent.id}
                                            className="py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                        >
                                            {saving === agent.id ? <span className="animate-spin">⌛</span> : <Save className="w-3 h-3" />}
                                            Kaydet
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    );
                })}

                {/* Info Card / Placeholder */}
                <div className="h-[280px] bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-6 text-white/20 hover:text-white/40 hover:border-white/20 transition-all cursor-default">
                    <Target className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm font-medium">Yeni Temsilci Ekle</p>
                    <p className="text-xs mt-1 max-w-[150px]">Ayarlar sayfasından yeni takım arkadaşları davet edebilirsiniz.</p>
                </div>
            </div>

            {/* Styles for 3D Transform */}
            <style jsx global>{`
                .perspective-1000 {
                    perspective: 1000px;
                }
                .preserve-3d {
                    transform-style: preserve-3d;
                }
                .backface-hidden {
                    backface-visibility: hidden;
                }
                .rotate-y-180 {
                    transform: rotateY(180deg);
                }
            `}</style>
        </div>
    );
}
