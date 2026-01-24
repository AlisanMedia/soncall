'use client';

import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Award, Zap, Target, ArrowRight, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionInfo } from '@/components/ui/section-info';

interface AgentPerformance {
    agent_id: string;
    agent_name: string;
    avatar_url?: string;
    level: number;
    rank: string;
    today_count: number;
    yesterday_count: number;
    growth_percentage: number;
    total_appointments: number;
    total_processed: number;
    conversion_rate: number;
}

export default function AgentRankings() {
    const [agents, setAgents] = useState<AgentPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'today' | 'total' | 'conversion'>('today');
    const [compareMode, setCompareMode] = useState(false);
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            const response = await fetch('/api/manager/analytics');
            const data = await response.json();

            if (response.ok) {
                setAgents(data.agentPerformance || []);
            }
        } catch (err) {
            console.error('Rankings load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const sortedAgents = [...agents].sort((a, b) => {
        switch (sortBy) {
            case 'today':
                return b.today_count - a.today_count;
            case 'total':
                return b.total_processed - a.total_processed;
            case 'conversion':
                return b.conversion_rate - a.conversion_rate;
            default:
                return 0;
        }
    });

    const toggleAgentSelection = (agentId: string) => {
        if (selectedAgents.includes(agentId)) {
            setSelectedAgents(selectedAgents.filter(id => id !== agentId));
        } else if (selectedAgents.length < 2) {
            setSelectedAgents([...selectedAgents, agentId]);
        }
    };

    const getRankStyle = (index: number) => {
        switch (index) {
            case 0: return {
                border: 'border-yellow-500/50',
                glow: 'shadow-[0_0_15px_-3px_rgba(234,179,8,0.3)]',
                icon: <Trophy className="w-5 h-5 text-yellow-400" />,
                text: 'text-yellow-400'
            };
            case 1: return {
                border: 'border-gray-400/50',
                glow: 'shadow-[0_0_15px_-3px_rgba(156,163,175,0.3)]',
                icon: <Award className="w-5 h-5 text-gray-300" />,
                text: 'text-gray-300'
            };
            case 2: return {
                border: 'border-amber-700/50',
                glow: 'shadow-[0_0_15px_-3px_rgba(180,83,9,0.3)]',
                icon: <Award className="w-5 h-5 text-amber-600" />,
                text: 'text-amber-600'
            };
            default: return {
                border: 'border-white/5',
                glow: '',
                icon: <span className="text-sm font-bold text-gray-500">#{index + 1}</span>,
                text: 'text-gray-500'
            };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            </div>
        );
    }

    const comparedAgents = selectedAgents.map(id => agents.find(a => a.agent_id === id)).filter(Boolean) as AgentPerformance[];

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Trophy className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            Liderlik Tablosu
                            <SectionInfo text="Takım üyelerinin performans sıralaması. Sıralama kriterini butonlarla değiştirebilirsiniz." />
                        </h2>
                        <p className="text-xs text-purple-300">Anlık performans takibi</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl overflow-x-auto">
                    {(['today', 'total', 'conversion'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setSortBy(mode)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${sortBy === mode
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-purple-200 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {mode === 'today' ? 'Bugün' : mode === 'total' ? 'Toplam' : 'Conversion'}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <button
                        onClick={() => {
                            setCompareMode(!compareMode);
                            setSelectedAgents([]);
                        }}
                        className={`p-1.5 rounded-lg transition-all ${compareMode
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'text-purple-200 hover:text-white hover:bg-white/5'
                            }`}
                        title="Karşılaştır"
                    >
                        <Target className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* List View */}
            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {sortedAgents.map((agent, index) => {
                        const style = getRankStyle(index);
                        const isSelected = selectedAgents.includes(agent.agent_id);

                        return (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                key={agent.agent_id}
                                onClick={() => compareMode && toggleAgentSelection(agent.agent_id)}
                                className={`
                                    relative group p-3 rounded-xl border backdrop-blur-md transition-all duration-300
                                    ${compareMode ? 'cursor-pointer' : ''}
                                    ${isSelected
                                        ? 'bg-green-500/10 border-green-500/50 ring-1 ring-green-500/30'
                                        : `bg-white/5 hover:bg-white/10 ${style.border} ${style.glow}`
                                    }
                                `}
                            >
                                {/* Background glow for top 3 */}
                                {index < 3 && (
                                    <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r ${index === 0 ? 'from-yellow-500 to-transparent' :
                                            index === 1 ? 'from-gray-400 to-transparent' :
                                                'from-amber-600 to-transparent'
                                        }`} />
                                )}

                                <div className="relative flex items-center gap-4">
                                    {/* Rank Indicator */}
                                    <div className={`w-8 flex justify-center items-center font-bold ${index < 3 ? 'scale-110' : ''}`}>
                                        {index < 3 ? style.icon : <span className="text-gray-500 text-sm">#{index + 1}</span>}
                                    </div>

                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${isSelected ? 'border-green-400' : 'border-white/10'} overflow-hidden
                                            ${!agent.avatar_url ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' : ''}
                                        `}>
                                            {agent.avatar_url ? (
                                                <img src={agent.avatar_url} alt={agent.agent_name} className="w-full h-full object-cover" />
                                            ) : (
                                                agent.agent_name.charAt(0)
                                            )}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 flex justify-center">
                                            <span className="text-[9px] font-bold px-1 rounded-full bg-slate-900 border border-white/20 text-gray-300">
                                                L{agent.level}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Name & Role */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-white text-sm truncate">{agent.agent_name}</h3>
                                            {index === 0 && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 animate-pulse" />}
                                        </div>
                                        <p className="text-xs text-stone-400 truncate">{agent.rank}</p>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="flex items-center gap-6 sm:gap-8 text-right">
                                        <div className="hidden sm:block">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Bugün</p>
                                            <p className="text-sm font-bold text-white">{agent.today_count}</p>
                                        </div>
                                        <div className="hidden sm:block">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Randevu</p>
                                            <p className="text-sm font-bold text-purple-300">{agent.total_appointments}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Conv.</p>
                                            <div className="flex items-center justify-end gap-1">
                                                <p className="text-sm font-bold text-white">{agent.conversion_rate}%</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Trend */}
                                    <div className={`w-16 text-right text-xs font-bold flex justify-end items-center gap-0.5 ${agent.growth_percentage > 0 ? 'text-emerald-400' : agent.growth_percentage < 0 ? 'text-red-400' : 'text-gray-500'
                                        }`}>
                                        {agent.growth_percentage !== 0 && (
                                            agent.growth_percentage > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                                        )}
                                        {agent.growth_percentage > 0 ? '+' : ''}{agent.growth_percentage}%
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Comparison Overlay */}
            <AnimatePresence>
                {compareMode && comparedAgents.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl w-80 lg:w-96"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Target className="w-4 h-4 text-green-400" />
                                Karşılaştırma
                            </h3>
                            <span className="text-xs text-slate-400">{comparedAgents.length}/2 seçildi</span>
                        </div>

                        {comparedAgents.length === 2 ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-white font-medium">{comparedAgents[0].agent_name}</span>
                                    <span className="text-slate-500 mx-2">vs</span>
                                    <span className="text-white font-medium">{comparedAgents[1].agent_name}</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-indigo-500"
                                            style={{ width: `${(comparedAgents[0].today_count / (comparedAgents[0].today_count + comparedAgents[1].today_count)) * 100}%` }}
                                        />
                                        <div
                                            className="h-full bg-emerald-500"
                                            style={{ width: `${(comparedAgents[1].today_count / (comparedAgents[0].today_count + comparedAgents[1].today_count)) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>{comparedAgents[0].today_count} lead</span>
                                        <span>{comparedAgents[1].today_count} lead</span>
                                    </div>
                                </div>
                                <p className="text-center text-xs text-yellow-400 font-bold mt-2">
                                    {comparedAgents[0].today_count > comparedAgents[1].today_count
                                        ? `🏆 ${comparedAgents[0].agent_name} önde!`
                                        : `🏆 ${comparedAgents[1].agent_name} önde!`}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 text-center py-4">
                                Bir kişi daha seçin...
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
