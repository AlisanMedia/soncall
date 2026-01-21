'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { Target, Phone, Save, ChevronLeft, ChevronRight, Trophy, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

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
    const [saving, setSaving] = useState<string | null>(null); // agent_id being saved

    const supabase = createClient();
    const periodKey = format(selectedDate, 'yyyy-MM');
    const periodLabel = format(selectedDate, 'MMMM yyyy', { locale: tr });

    useEffect(() => {
        loadData();
    }, [periodKey]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Get Agents
            const { data: agentsData } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'agent')
                .order('full_name');

            if (agentsData) setAgents(agentsData);

            // 2. Get Goals for Period
            const { data: goalsData } = await supabase
                .from('goals')
                .select('*')
                .eq('period_key', periodKey);

            const goalsMap: Record<string, Goal> = {};
            // Initialize map with existing goals
            goalsData?.forEach(g => {
                goalsMap[g.agent_id] = g;
            });

            // For agents without goals, create temporary local goal objects (ID undefined)
            // We don't save to DB until user clicks save, or we could auto-create.
            // Let's just map them.
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
                agent_id: agentId, // Ensure ID is set for new entries
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

            // Update local state with returned ID
            setGoals(prev => ({
                ...prev,
                [agentId]: data as Goal
            }));

            // Optional: Show success toast
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

    if (loading) return <div className="p-8 text-center text-purple-200">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* Header / Month Selector */}
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                        <Target className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Hedef Yönetimi</h2>
                        <p className="text-purple-300 text-sm">Temsilciler için aylık performans hedefleri belirleyin</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-black/40 rounded-lg p-1">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="p-2 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-mono font-bold text-white min-w-[140px] text-center">
                        {periodLabel}
                    </span>
                    <button
                        onClick={() => changeMonth(1)}
                        className="p-2 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Goals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map(agent => {
                    const goal = goals[agent.id] || { target_calls: 0, target_sales: 0 };
                    const isSaving = saving === agent.id;
                    const hasGoal = !!goal.id; // Check if it exists in DB

                    return (
                        <div key={agent.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-purple-500/30 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                                    {agent.full_name.substring(0, 1)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white truncate">{agent.full_name}</h3>
                                    <p className="text-xs text-purple-300 truncate">{agent.email}</p>
                                </div>
                                {hasGoal && (
                                    <div className="text-green-400" title="Hedef Belirlendi">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                {/* Calls Target */}
                                <div>
                                    <label className="text-xs font-medium text-purple-200 flex items-center gap-2 mb-1">
                                        <Phone className="w-3 h-3" />
                                        Arama Hedefi (Aylık)
                                    </label>
                                    <input
                                        type="number"
                                        value={goal.target_calls || ''}
                                        onChange={(e) => handleGoalChange(agent.id, 'target_calls', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none"
                                        placeholder="Örn: 500"
                                    />
                                </div>

                                {/* Sales Target */}
                                <div>
                                    <label className="text-xs font-medium text-purple-200 flex items-center gap-2 mb-1">
                                        <Trophy className="w-3 h-3" />
                                        Satış Hedefi (Aylık)
                                    </label>
                                    <input
                                        type="number"
                                        value={goal.target_sales || ''}
                                        onChange={(e) => handleGoalChange(agent.id, 'target_sales', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none"
                                        placeholder="Örn: 10"
                                    />
                                </div>

                                <button
                                    onClick={() => saveGoal(agent.id)}
                                    disabled={isSaving}
                                    className="w-full py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <span className="animate-spin">⌛</span>
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {hasGoal ? 'Hedefi Güncelle' : 'Hedef Oluştur'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
