'use client';

import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Cell, CartesianGrid
} from 'recharts';
import { ArrowDown, TrendingDown, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface FunnelStage {
    name: string;
    value: number;
    fill: string;
    dropRate: number;
    conversionRate: number;
}

export default function ConversionFunnel() {
    const [data, setData] = useState<FunnelStage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/manager/analytics/funnel');
                const json = await res.json();
                if (json.success) {
                    setData(json.data);
                }
            } catch (error) {
                console.error('Failed to fetch funnel data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return (
        <div className="bg-slate-900 rounded-xl p-6 border border-white/10 h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
    );

    const totalLeads = data[0]?.value || 0;
    const finalSales = data[data.length - 1]?.value || 0;
    const totalConversionRate = totalLeads ? ((finalSales / totalLeads) * 100).toFixed(1) : '0';

    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        Dönüşüm Hunisi
                    </h3>
                    <p className="text-sm text-purple-300">Lead'den satışa dönüşüm analizi</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-purple-300">Genel Dönüşüm</p>
                    <p className="text-2xl font-bold text-emerald-400 flex items-center justify-end gap-1">
                        %{totalConversionRate}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            barSize={40}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff10" />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={100}
                                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: '#ffffff05' }}
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: '#f1f5f9'
                                }}
                                formatter={(value: number | undefined) => value ? [value, 'Kişi'] : [0, 'Kişi']}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Metrics Breakdown */}
                <div className="space-y-4">
                    {data.map((stage, index) => (
                        <motion.div
                            key={stage.name}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-white/5 rounded-lg p-3 border border-white/5 relative overflow-hidden group hover:border-white/20 transition-colors"
                        >
                            {/* Progress bar background */}
                            <div
                                className="absolute left-0 top-0 bottom-0 bg-white/5 transition-all duration-500"
                                style={{ width: `${stage.conversionRate}%` }}
                            />

                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: stage.fill }} />
                                    <div>
                                        <div className="text-sm font-medium text-white">{stage.name}</div>
                                        <div className="text-xs text-purple-300">{stage.value} kişi</div>
                                    </div>
                                </div>

                                {index > 0 && (
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 text-xs text-red-400 font-medium">
                                            <TrendingDown className="w-3 h-3" />
                                            %{stage.dropRate} kayıp
                                        </div>
                                        <div className="text-[10px] text-purple-400">
                                            Önceki adımdan
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
