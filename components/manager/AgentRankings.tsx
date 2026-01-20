'use client';

import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Award, Zap, Target, Loader2 } from 'lucide-react';

interface AgentPerformance {
    agent_id: string;
    agent_name: string;
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

    const getRankColor = (index: number) => {
        switch (index) {
            case 0: return 'from-yellow-600 to-yellow-500';
            case 1: return 'from-gray-500 to-gray-400';
            case 2: return 'from-amber-700 to-amber-600';
            default: return 'from-purple-600 to-indigo-600';
        }
    };

    const getRankIcon = (index: number) => {
        switch (index) {
            case 0: return <Trophy className="w-6 h-6 text-yellow-300" />;
            case 1: return <Award className="w-6 h-6 text-gray-300" />;
            case 2: return <Award className="w-6 h-6 text-amber-400" />;
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
        );
    }

    const comparedAgents = selectedAgents.map(id => agents.find(a => a.agent_id === id)).filter(Boolean) as AgentPerformance[];

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSortBy('today')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${sortBy === 'today'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                            }`}
                    >
                        Bugün
                    </button>
                    <button
                        onClick={() => setSortBy('total')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${sortBy === 'total'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                            }`}
                    >
                        Toplam
                    </button>
                    <button
                        onClick={() => setSortBy('conversion')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${sortBy === 'conversion'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                            }`}
                    >
                        Conversion
                    </button>
                </div>

                <button
                    onClick={() => {
                        setCompareMode(!compareMode);
                        setSelectedAgents([]);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${compareMode
                            ? 'bg-green-600 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                >
                    {compareMode ? 'Karşılaştırmayı Kapat' : 'Karşılaştır'}
                </button>
            </div>

            {/* Leaderboard */}
            <div className="grid grid-cols-1 gap-4">
                {sortedAgents.map((agent, index) => (
                    <div
                        key={agent.agent_id}
                        onClick={() => compareMode && toggleAgentSelection(agent.agent_id)}
                        className={`bg-gradient-to-r ${getRankColor(index)} rounded-xl p-6 border border-white/20 transition-all ${compareMode ? 'cursor-pointer hover:scale-[1.02]' : ''
                            } ${selectedAgents.includes(agent.agent_id) ? 'ring-4 ring-green-400' : ''
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            {/* Rank */}
                            <div className="flex flex-col items-center">
                                <div className="text-4xl font-bold text-white">#{index + 1}</div>
                                {getRankIcon(index)}
                            </div>

                            {/* Agent Info */}
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-white mb-2">{agent.agent_name}</h3>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-white/70 text-sm">Bugün</p>
                                        <p className="text-2xl font-bold text-white">{agent.today_count}</p>
                                    </div>

                                    <div>
                                        <p className="text-white/70 text-sm">Toplam</p>
                                        <p className="text-2xl font-bold text-white">{agent.total_processed}</p>
                                    </div>

                                    <div>
                                        <p className="text-white/70 text-sm">Randevu</p>
                                        <p className="text-2xl font-bold text-white">{agent.total_appointments}</p>
                                    </div>

                                    <div>
                                        <p className="text-white/70 text-sm">Conversion</p>
                                        <p className="text-2xl font-bold text-white">{agent.conversion_rate}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Growth Indicator */}
                            <div className="text-right">
                                {agent.growth_percentage !== 0 && (
                                    <div className={`flex items-center gap-1 ${agent.growth_percentage > 0 ? 'text-green-300' : 'text-red-300'
                                        }`}>
                                        {agent.growth_percentage > 0 ? (
                                            <TrendingUp className="w-6 h-6" />
                                        ) : (
                                            <TrendingDown className="w-6 h-6" />
                                        )}
                                        <span className="text-2xl font-bold">
                                            {agent.growth_percentage > 0 ? '+' : ''}{agent.growth_percentage}%
                                        </span>
                                    </div>
                                )}
                                <p className="text-white/70 text-sm mt-1">vs. dün</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Comparison View */}
            {compareMode && comparedAgents.length === 2 && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <Target className="w-6 h-6 text-purple-400" />
                        Head-to-Head Karşılaştırma
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                        {comparedAgents.map((agent, idx) => (
                            <div key={agent.agent_id} className={`${idx === 0 ? 'border-r border-white/20 pr-6' : 'pl-6'}`}>
                                <h4 className="text-xl font-bold text-white mb-4">{agent.agent_name}</h4>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-purple-200">Bugün</span>
                                            <span className="text-white font-bold">{agent.today_count}</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-3">
                                            <div
                                                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-3 rounded-full"
                                                style={{
                                                    width: `${(agent.today_count / Math.max(comparedAgents[0].today_count, comparedAgents[1].today_count)) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-purple-200">Toplam İşlenen</span>
                                            <span className="text-white font-bold">{agent.total_processed}</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-3">
                                            <div
                                                className="bg-gradient-to-r from-green-600 to-emerald-600 h-3 rounded-full"
                                                style={{
                                                    width: `${(agent.total_processed / Math.max(comparedAgents[0].total_processed, comparedAgents[1].total_processed)) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-purple-200">Randevu</span>
                                            <span className="text-white font-bold">{agent.total_appointments}</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-3">
                                            <div
                                                className="bg-gradient-to-r from-yellow-600 to-orange-600 h-3 rounded-full"
                                                style={{
                                                    width: `${(agent.total_appointments / Math.max(comparedAgents[0].total_appointments, comparedAgents[1].total_appointments)) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-purple-200">Conversion Rate</span>
                                            <span className="text-white font-bold">{agent.conversion_rate}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-3">
                                            <div
                                                className="bg-gradient-to-r from-blue-600 to-cyan-600 h-3 rounded-full"
                                                style={{
                                                    width: `${(agent.conversion_rate / Math.max(comparedAgents[0].conversion_rate, comparedAgents[1].conversion_rate)) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Winner Declaration */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg text-center">
                        <p className="text-white font-bold text-lg">
                            {comparedAgents[0].today_count > comparedAgents[1].today_count
                                ? `🏆 ${comparedAgents[0].agent_name} bugün önde!`
                                : comparedAgents[1].today_count > comparedAgents[0].today_count
                                    ? `🏆 ${comparedAgents[1].agent_name} bugün önde!`
                                    : '🤝 Bugün eşitler!'}
                        </p>
                    </div>
                </div>
            )}

            {compareMode && comparedAgents.length < 2 && (
                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10 text-center">
                    <Trophy className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <p className="text-purple-200">
                        Karşılaştırma için {2 - selectedAgents.length} agent daha seçin
                    </p>
                </div>
            )}
        </div>
    );
}
