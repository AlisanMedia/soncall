'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock, Target, Award, Zap, Loader2 } from 'lucide-react';
import InsightsPanel from './InsightsPanel';
import ConversionFunnel from './ConversionFunnel';
import QualityMetrics from './QualityMetrics';
import AiPerformancePanel from './AiPerformancePanel';
import { SectionInfo } from '@/components/ui/section-info';

interface AnalyticsData {
    hourly: Array<{ hour: number; count: number; label: string }>;
    daily: Array<{ date: string; count: number; label: string }>;
    funnel: Array<{ stage: string; count: number; percentage: number }>;
    peakHours: Array<{ hour: number; count: number; label: string }>;
    categories: Array<{ category: string; count: number; percentage: number }>;
    todayStats: {
        processed: number;
        appointments: number;
    };
    agentPerformance: Array<{
        agent_id: string;
        agent_name: string;
        today_count: number;
        yesterday_count: number;
        growth_percentage: number;
        total_appointments: number;
        total_processed: number;
        conversion_rate: number;
    }>;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function AnalyticsView() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAnalytics();
        // Refresh every 30 seconds
        const interval = setInterval(loadAnalytics, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadAnalytics = async () => {
        try {
            const response = await fetch('/api/manager/analytics');
            const result = await response.json();

            if (response.ok) {
                setData(result);
            }
        } catch (err) {
            console.error('Analytics load error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <img src="/loading-logo.png" alt="Loading" className="w-20 h-10 animate-pulse object-contain" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-32 text-purple-300">
                Analitik verileri yüklenemedi
            </div>
        );
    }

    // Top 3 performers
    const topPerformers = data.agentPerformance.slice(0, 3);
    const mostImproved = [...data.agentPerformance].sort((a, b) => b.growth_percentage - a.growth_percentage)[0];
    const bestConverter = [...data.agentPerformance].sort((a, b) => b.conversion_rate - a.conversion_rate)[0];

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-4 sm:p-6 border border-white/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-1">
                                <p className="text-purple-100 text-xs sm:text-sm">Bugün İşlenen</p>
                                <span className="hidden sm:inline"><SectionInfo text="Bugün sistem üzerinden aranan, mesaj atılan veya durumu değiştirilen toplam lead sayısı." /></span>
                            </div>
                            <p className="text-2xl sm:text-4xl font-bold text-white mt-1">{data.todayStats.processed}</p>
                        </div>
                        <Target className="w-8 h-8 sm:w-12 sm:h-12 text-white/30" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-4 sm:p-6 border border-white/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-1">
                                <p className="text-green-100 text-xs sm:text-sm">Bugün Randevu</p>
                                <span className="hidden sm:inline"><SectionInfo text="Bugün oluşturulan toplam kesinleşmiş randevu sayısı." /></span>
                            </div>
                            <p className="text-2xl sm:text-4xl font-bold text-white mt-1">{data.todayStats.appointments}</p>
                        </div>
                        <Award className="w-8 h-8 sm:w-12 sm:h-12 text-white/30" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-600 to-red-600 rounded-xl p-4 sm:p-6 border border-white/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-1">
                                <p className="text-orange-100 text-xs sm:text-sm">Conv. Rate</p>
                                <span className="hidden sm:inline"><SectionInfo text="Toplam leadler içinden satışa veya randevuya dönüşenlerin yüzdesi." /></span>
                            </div>
                            <p className="text-2xl sm:text-4xl font-bold text-white mt-1">
                                {data.funnel[2].percentage}%
                            </p>
                        </div>
                        <TrendingUp className="w-8 h-8 sm:w-12 sm:h-12 text-white/30" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 sm:p-6 border border-white/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-1">
                                <p className="text-blue-100 text-xs sm:text-sm">Peak Saat</p>
                                <span className="hidden sm:inline"><SectionInfo text="Gün içinde en çok işlemin yapıldığı ve verimin en yüksek olduğu saat aralığı." /></span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                                {data.peakHours[0]?.label.split(' - ')[0] || 'N/A'}
                            </p>
                        </div>
                        <Clock className="w-8 h-8 sm:w-12 sm:h-12 text-white/30" />
                    </div>
                </div>
            </div>

            {/* Quality Metrics */}
            <QualityMetrics />

            {/* AI Performance Dashboard (Cortex) */}
            <AiPerformancePanel />

            {/* Performance Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 sm:p-6 border border-white/20">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg">
                            <Award className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                        </div>
                        <h3 className="font-semibold text-white text-sm sm:text-base">Top Performer</h3>
                        <span className="hidden sm:inline"><SectionInfo text="Bugün en çok lead işleyen ve aktivite gösteren takım üyesi." /></span>
                    </div>
                    {topPerformers[0] && (
                        <div>
                            <p className="text-xl sm:text-2xl font-bold text-yellow-400 truncate">{topPerformers[0].agent_name}</p>
                            <p className="text-purple-200 text-xs sm:text-sm mt-1">{topPerformers[0].today_count} lead bugün</p>
                        </div>
                    )}
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 sm:p-6 border border-white/20">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                        </div>
                        <h3 className="font-semibold text-white text-sm sm:text-base">Most Improved</h3>
                        <span className="hidden sm:inline"><SectionInfo text="Düne göre performansını oransal olarak en çok artıran takım üyesi." /></span>
                    </div>
                    {mostImproved && (
                        <div>
                            <p className="text-xl sm:text-2xl font-bold text-green-400 truncate">{mostImproved.agent_name}</p>
                            <p className="text-purple-200 text-xs sm:text-sm mt-1">
                                {mostImproved.growth_percentage > 0 ? '+' : ''}{mostImproved.growth_percentage}% büyüme
                            </p>
                        </div>
                    )}
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 sm:p-6 border border-white/20">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                        </div>
                        <h3 className="font-semibold text-white text-sm sm:text-base">Best Converter</h3>
                        <span className="hidden sm:inline"><SectionInfo text="İşlediği lead başına en yüksek randevu/satış oranına sahip takım üyesi." /></span>
                    </div>
                    {bestConverter && (
                        <div>
                            <p className="text-xl sm:text-2xl font-bold text-purple-400 truncate">{bestConverter.agent_name}</p>
                            <p className="text-purple-200 text-xs sm:text-sm mt-1">{bestConverter.conversion_rate}% conversion</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Activity Chart */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                    <h3 className="text-base sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                        <span className="truncate">Saatlik Aktivite</span>
                        <span className="hidden sm:inline text-sm font-normal">(Son 24 Saat)</span>
                        <span className="hidden sm:inline"><SectionInfo text="Son 24 saat içindeki tüm aktivitelerin saat dilimlerine göre dağılımı." /></span>
                    </h3>
                    <ResponsiveContainer width="100%" height={250} minHeight={100}>
                        <BarChart data={data.hourly}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                                dataKey="label"
                                stroke="#c4b5fd"
                                tick={{ fontSize: 12 }}
                                interval={2}
                            />
                            <YAxis stroke="#c4b5fd" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(30, 27, 75, 0.9)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                            <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Daily Trend Chart */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                    <h3 className="text-base sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                        <span className="truncate">Günlük Trend</span>
                        <span className="hidden sm:inline text-sm font-normal">(Son 7 Gün)</span>
                        <span className="hidden sm:inline"><SectionInfo text="Son 7 gündeki toplam işlem hacminin günlük bazda değişimi." /></span>
                    </h3>
                    <ResponsiveContainer width="100%" height={250} minHeight={100}>
                        <LineChart data={data.daily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="label" stroke="#c4b5fd" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#c4b5fd" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(30, 27, 75, 0.9)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke="#10b981"
                                strokeWidth={3}
                                dot={{ fill: '#10b981', r: 5 }}
                                activeDot={{ r: 7 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Conversion Funnel */}
                <div className="lg:col-span-1">
                    <ConversionFunnel />
                </div>

                {/* Category Breakdown */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                    <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-xl font-bold text-white">Top Kategoriler</h3>
                        <SectionInfo text="İşlenen leadlerin sektörel veya kategorik dağılımı." />
                    </div>
                    <ResponsiveContainer width="100%" height={300} minHeight={100}>
                        <PieChart>
                            <Pie
                                data={data.categories.slice(0, 6)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ payload }: { payload?: { category: string; percentage: number } }) => payload ? `${payload.category} (${payload.percentage}%)` : ''}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="count"
                            >
                                {data.categories.slice(0, 6).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(30, 27, 75, 0.9)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
