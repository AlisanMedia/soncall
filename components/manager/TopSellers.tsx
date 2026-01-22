'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, TrendingUp, DollarSign, Award, Calendar, Zap, ChevronDown, ChevronRight, Building2 } from 'lucide-react';

interface IndividualSale {
    id: string;
    amount: number;
    commission: number;
    created_at: string;
    business_name: string;
}

interface AgentSalesData {
    agent_id: string;
    full_name: string;
    avatar_url?: string;
    total_sales: number;
    total_revenue: number;
    total_commission: number;
    last_sale_date?: string;
    this_month_sales: number;
    last_month_sales: number;
    individual_sales: IndividualSale[];
}

type TimePeriod = 'all' | 'month' | 'week';

export default function TopSellers() {
    const [data, setData] = useState<AgentSalesData[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<TimePeriod>('all');
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [period]);

    const loadData = async () => {
        setLoading(true);
        const supabase = createClient();

        let dateFilter = '';
        const now = new Date();
        if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = monthStart.toISOString();
        } else if (period === 'week') {
            const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
            dateFilter = weekStart.toISOString();
        }

        const query = supabase
            .from('sales')
            .select(`
                id,
                agent_id,
                amount,
                commission,
                created_at,
                agent:profiles!sales_agent_id_fkey(full_name, avatar_url),
                lead:leads!sales_lead_id_fkey(business_name)
            `)
            .eq('status', 'approved');

        if (dateFilter) {
            query.gte('created_at', dateFilter);
        }

        const { data: sales, error } = await query;

        if (error) {
            console.error('Sales load error:', error);
            setLoading(false);
            return;
        }

        const agentMap = new Map<string, AgentSalesData>();

        sales?.forEach((sale: any) => {
            const agentId = sale.agent_id;
            if (!agentMap.has(agentId)) {
                agentMap.set(agentId, {
                    agent_id: agentId,
                    full_name: sale.agent?.full_name || 'Unknown',
                    avatar_url: sale.agent?.avatar_url,
                    total_sales: 0,
                    total_revenue: 0,
                    total_commission: 0,
                    this_month_sales: 0,
                    last_month_sales: 0,
                    individual_sales: [],
                });
            }

            const agentData = agentMap.get(agentId)!;
            agentData.total_sales++;
            agentData.total_revenue += parseFloat(sale.amount);
            agentData.total_commission += parseFloat(sale.commission || 0);

            agentData.individual_sales.push({
                id: sale.id,
                amount: parseFloat(sale.amount),
                commission: parseFloat(sale.commission || 0),
                created_at: sale.created_at,
                business_name: sale.lead?.business_name || 'Bilinmeyen İşletme',
            });

            const saleDate = new Date(sale.created_at);
            if (!agentData.last_sale_date || new Date(agentData.last_sale_date) < saleDate) {
                agentData.last_sale_date = sale.created_at;
            }

            const thisMonth = new Date().getMonth();
            const saleMonth = saleDate.getMonth();
            if (saleMonth === thisMonth) {
                agentData.this_month_sales++;
            } else if (saleMonth === thisMonth - 1) {
                agentData.last_month_sales++;
            }
        });

        const sortedData = Array.from(agentMap.values()).sort((a, b) => b.total_revenue - a.total_revenue);
        setData(sortedData);
        setLoading(false);
    };

    const getPodiumColor = (index: number) => {
        if (index === 0) return 'from-yellow-400 to-yellow-600 shadow-yellow-500/50';
        if (index === 1) return 'from-gray-300 to-gray-500 shadow-gray-400/50';
        if (index === 2) return 'from-orange-400 to-orange-600 shadow-orange-500/50';
        return '';
    };

    const getTrendIcon = (current: number, last: number) => {
        if (current > last) return <TrendingUp className="w-4 h-4 text-green-400" />;
        if (current < last) return <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />;
        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <img src="/loading-logo.png" alt="Loading" className="w-16 h-8 animate-pulse object-contain" />
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-400">Henüz satış verisi bulunmuyor.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Satış Liderleri</h2>
                        <p className="text-sm text-gray-400">En başarılı satış temsilcileri ve detaylar</p>
                    </div>
                </div>

                <div className="flex gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                    {(['all', 'month', 'week'] as TimePeriod[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${period === p ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-300 hover:bg-white/10'
                                }`}
                        >
                            {p === 'all' ? 'Tüm Zamanlar' : p === 'month' ? 'Bu Ay' : 'Bu Hafta'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Podium */}
            {data.length >= 3 && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {data.slice(0, 3).map((agent, index) => (
                        <div
                            key={agent.agent_id}
                            className={`relative flex flex-col items-center p-6 rounded-2xl border ${index === 0 ? 'border-yellow-500/50 scale-105' : 'border-white/10'
                                } bg-gradient-to-br from-white/10 to-white/5 hover:scale-110 transition-transform duration-300`}
                            style={{ order: index === 0 ? 2 : index === 1 ? 1 : 3 }}
                        >
                            <div className={`absolute -top-4 w-12 h-12 rounded-full bg-gradient-to-br ${getPodiumColor(index)} flex items-center justify-center shadow-2xl border-4 border-slate-900`}>
                                <span className="text-2xl font-black text-white drop-shadow-lg">{index + 1}</span>
                            </div>

                            <div className="mt-6 mb-3">
                                {agent.avatar_url ? (
                                    <img src={agent.avatar_url} alt={agent.full_name} className="w-16 h-16 rounded-full object-cover border-2 border-white/20" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                                        {agent.full_name.charAt(0)}
                                    </div>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-white text-center mb-2">{agent.full_name}</h3>

                            <div className="text-center space-y-1">
                                <div className="flex items-center gap-1 justify-center text-green-400">
                                    <DollarSign className="w-4 h-4" />
                                    <span className="text-xl font-bold">{agent.total_revenue.toLocaleString()}₺</span>
                                </div>
                                <p className="text-xs text-gray-400">{agent.total_sales} Satış</p>
                                <p className="text-xs text-purple-300">+{agent.total_commission.toLocaleString()}₺ Prim</p>
                            </div>

                            {index === 0 && <Award className="absolute top-4 right-4 w-5 h-5 text-yellow-400 animate-pulse" />}
                        </div>
                    ))}
                </div>
            )}

            {/* Full Leaderboard with Expandable Rows */}
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                        <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                            <th className="px-6 py-3 w-12"></th>
                            <th className="px-6 py-3">Sıra</th>
                            <th className="px-6 py-3">Temsilci</th>
                            <th className="px-6 py-3">Satış Sayısı</th>
                            <th className="px-6 py-3">Toplam Ciro</th>
                            <th className="px-6 py-3">Kazanılan Prim</th>
                            <th className="px-6 py-3">Son Satış</th>
                            <th className="px-6 py-3">Trend</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((agent, index) => (
                            <React.Fragment key={agent.agent_id}>
                                <tr
                                    onClick={() => setExpandedAgent(expandedAgent === agent.agent_id ? null : agent.agent_id)}
                                    className="hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5"
                                >
                                    <td className="px-6 py-4">
                                        {expandedAgent === agent.agent_id ? (
                                            <ChevronDown className="w-4 h-4 text-purple-400" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${index < 3 ? `bg-gradient-to-br ${getPodiumColor(index)} text-white shadow-lg` : 'bg-white/5 text-gray-400'
                                            }`}>
                                            {index + 1}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {agent.avatar_url ? (
                                                <img src={agent.avatar_url} alt={agent.full_name} className="w-10 h-10 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                                    {agent.full_name.charAt(0)}
                                                </div>
                                            )}
                                            <span className="font-semibold text-white">{agent.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-4 h-4 text-yellow-400" />
                                            <span className="text-white font-bold">{agent.total_sales}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-green-400 font-bold">
                                            <DollarSign className="w-4 h-4" />
                                            {agent.total_revenue.toLocaleString()}₺
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-purple-300 font-semibold">+{agent.total_commission.toLocaleString()}₺</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                                            <Calendar className="w-3 h-3" />
                                            {agent.last_sale_date ? new Date(agent.last_sale_date).toLocaleDateString('tr-TR') : '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getTrendIcon(agent.this_month_sales, agent.last_month_sales)}
                                            {agent.this_month_sales > agent.last_month_sales && (
                                                <span className="text-xs text-green-400 font-medium">+{agent.this_month_sales - agent.last_month_sales}</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>

                                {/* Expanded Row - Individual Sales */}
                                {expandedAgent === agent.agent_id && (
                                    <tr className="bg-white/3">
                                        <td colSpan={8} className="px-6 py-4">
                                            <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                                                <h4 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                                                    <Building2 className="w-4 h-4" />
                                                    Yapılan Satışlar ({agent.individual_sales.length})
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                                                    {agent.individual_sales
                                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                        .map((sale) => (
                                                            <div
                                                                key={sale.id}
                                                                className="bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 transition-colors"
                                                            >
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Building2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                                                        <span className="text-white font-semibold text-sm">{sale.business_name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-green-400 font-bold text-sm">
                                                                        <DollarSign className="w-3 h-3" />
                                                                        {sale.amount.toLocaleString()}₺
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between text-xs text-gray-400">
                                                                    <div className="flex items-center gap-1">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {new Date(sale.created_at).toLocaleDateString('tr-TR')}
                                                                    </div>
                                                                    <span className="text-purple-300">Prim: +{sale.commission.toLocaleString()}₺</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
