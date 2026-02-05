'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Brain, Zap, TrendingUp, Activity, Target, Sparkles,
    CheckCircle2, XCircle, Diamond, ShieldCheck
} from 'lucide-react';
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { SectionInfo } from '@/components/ui/section-info';

interface AiPerformanceData {
    oracle: {
        accuracy: number;
        precision: number;
        totalPredictions: number;
        breakdown: {
            truePositives: number;
            falsePositives: number;
            hiddenGems: number;
            trueNegatives: number;
        };
    };
    appointmentDetection: {
        rate: number;
        total: number;
    };
    learningCurve: Array<{
        week: string;
        accuracy: number;
        predictions: number;
    }>;
    synergy: {
        score: number;
        quickFollowUps: number;
        totalOpportunities: number;
    };
    healthScore: number;
}

export default function AiPerformancePanel() {
    const [data, setData] = useState<AiPerformanceData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/manager/analytics/ai-performance');
                const json = await res.json();
                if (json.success) {
                    setData(json.data);
                }
            } catch (error) {
                console.error('Failed to fetch AI performance data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Refresh every 60 seconds
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
        <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-2xl p-6 border border-cyan-500/30 h-[600px] flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
                <p className="text-cyan-300 text-sm animate-pulse">Initializing Cortex...</p>
            </div>
        </div>
    );

    if (!data) return null;

    // Prepare confusion matrix data
    const confusionData = [
        {
            name: 'Doğru Tahmin',
            value: data.oracle.breakdown.truePositives,
            fill: '#10b981',
            icon: '✅'
        },
        {
            name: 'Yanlış Alarm',
            value: data.oracle.breakdown.falsePositives,
            fill: '#ef4444',
            icon: '❌'
        },
        {
            name: 'Gizli Cevher',
            value: data.oracle.breakdown.hiddenGems,
            fill: '#f59e0b',
            icon: '💎'
        },
    ];

    // Health status color
    const getHealthColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getHealthGlow = (score: number) => {
        if (score >= 80) return 'shadow-emerald-500/50';
        if (score >= 60) return 'shadow-yellow-500/50';
        return 'shadow-red-500/50';
    };

    return (
        <div className="space-y-6">
            {/* Header: Cortex Status */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-2xl p-6 border border-cyan-500/30 relative overflow-hidden"
            >
                {/* Animated background grid */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'linear-gradient(#06b6d4 1px, transparent 1px), linear-gradient(90deg, #06b6d4 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }} />
                </div>

                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <motion.div
                            animate={{
                                rotate: [0, 360],
                                scale: [1, 1.1, 1]
                            }}
                            transition={{
                                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                                scale: { duration: 2, repeat: Infinity }
                            }}
                            className="p-3 bg-cyan-500/20 rounded-xl border-2 border-cyan-400/50"
                        >
                            <Brain className="w-8 h-8 text-cyan-400" />
                        </motion.div>
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                CORTEX
                                <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-400/30">
                                    v2.0
                                </span>
                                <SectionInfo text="Cortex Yapay Zeka motorunun anlık sağlık durumu ve sistem performansı." />
                            </h2>
                            <p className="text-cyan-300 text-sm">Yapay Zeka Performans Merkezi</p>
                        </div>
                    </div>

                    {/* Health Score */}
                    <div className="text-right">
                        <p className="text-xs text-cyan-300 mb-1">SYSTEM HEALTH</p>
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className={`text-5xl font-bold ${getHealthColor(data.healthScore)} drop-shadow-lg ${getHealthGlow(data.healthScore)}`}
                        >
                            {data.healthScore}%
                        </motion.div>
                        <div className="flex items-center justify-end gap-1 mt-1">
                            <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                            <span className="text-[10px] text-cyan-400">ONLINE</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Oracle Accuracy */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/30"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Target className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Kahin Skoru</h3>
                            <p className="text-xs text-purple-300">Weighted Precision</p>
                        </div>
                        <SectionInfo text="Yeni Katı Puanlama: Satış (+100), Randevu (+50). Yanlış tahminler (-100) ile cezalandırılır." />
                    </div>

                    <div className="text-center mb-4">
                        <div className="text-4xl font-bold text-purple-400 mb-1">
                            {data.oracle.totalPredictions < 5 ? (
                                <span className="text-2xl text-purple-300 animate-pulse">Veri Toplanıyor...</span>
                            ) : (
                                `${data.oracle.accuracy}%`
                            )}
                        </div>
                        <p className="text-xs text-purple-200">
                            {data.oracle.totalPredictions} analiz doğrulandı
                        </p>
                    </div>

                    {/* Confusion Matrix Breakdown */}
                    <div className="space-y-2">
                        {confusionData.map((item, index) => (
                            <motion.div
                                key={item.name}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + index * 0.1 }}
                                className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                            >
                                <span className="text-sm text-white flex items-center gap-2">
                                    <span>{item.icon}</span>
                                    {item.name}
                                </span>
                                <span className="font-semibold" style={{ color: item.fill }}>
                                    {item.value}
                                </span>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex justify-between text-xs">
                            <span className="text-purple-300">Güven Skoru</span>
                            <span className="text-purple-400 font-semibold">Verified</span>
                        </div>
                    </div>
                </motion.div>

                {/* Learning Curve */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-cyan-500/30"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Performans Eğrisi</h3>
                            <p className="text-xs text-cyan-300">Trend Analizi</p>
                        </div>
                        <SectionInfo text="Cortex'in tahmin başarısının haftalık değişimi." />
                    </div>

                    <ResponsiveContainer width="100%" height={200} minHeight={100}>
                        <LineChart data={data.learningCurve}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <XAxis
                                dataKey="week"
                                stroke="#06b6d4"
                                tick={{ fontSize: 11, fill: '#67e8f9' }}
                            />
                            <YAxis
                                stroke="#06b6d4"
                                tick={{ fontSize: 11, fill: '#67e8f9' }}
                                domain={[0, 100]}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #06b6d4',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="accuracy"
                                stroke="#06b6d4"
                                strokeWidth={3}
                                dot={{ fill: '#06b6d4', r: 5 }}
                                activeDot={{ r: 7, fill: '#22d3ee' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    <p className="text-xs text-cyan-200 text-center mt-2">
                        Durum: {data.learningCurve.length > 0 && data.learningCurve[data.learningCurve.length - 1]?.accuracy >= 50 ? '✅ Stabil' : '⚠️ Kalibrasyon Gerekli'}
                    </p>
                </motion.div>

                {/* Synergy Index */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-emerald-500/30"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <Zap className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Sinerji Endeksi</h3>
                            <p className="text-xs text-emerald-300">Action Compliance</p>
                        </div>
                        <SectionInfo text="AI'ın 'Ara' veya 'Mesaj At' önerilerinin Agent tarafından uygulanma oranı." />
                    </div>

                    <div className="text-center mb-4">
                        <div className="text-4xl font-bold text-emerald-400 mb-1">
                            {data.synergy.score}%
                        </div>
                        <p className="text-xs text-emerald-200">
                            {data.synergy.quickFollowUps}/{data.synergy.totalOpportunities} öneri uygulandı
                        </p>
                    </div>

                    {/* Visual representation */}
                    <div className="relative h-32 flex items-center justify-center">
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 1, 0.5]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute w-24 h-24 rounded-full bg-emerald-500/20 blur-xl"
                        />
                        <div className="relative text-center">
                            <Sparkles className="w-16 h-16 text-emerald-400 mx-auto animate-pulse" />
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-emerald-300">Aksiyon Uyumu</span>
                            <span className="text-emerald-400 font-semibold">
                                {data.synergy.score >= 80 ? 'Harika' : data.synergy.score >= 50 ? 'İyi' : 'Düşük'}
                            </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${data.synergy.score}%` }}
                                transition={{ duration: 1, delay: 0.5 }}
                                className="h-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                            />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Appointment Verification */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-orange-500/30"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                                <ShieldCheck className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Doğrulanmış Randevu</h3>
                                <p className="text-xs text-orange-300">Cross-Check Sistem</p>
                            </div>
                            <SectionInfo text="Sadece AI loglarında kanıtı bulunan (tarih/kelime eşleşen) randevuları sayar." />
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-orange-400">{data.appointmentDetection.rate}%</div>
                            <div className="text-xs text-orange-200">{data.appointmentDetection.total} verified</div>
                        </div>
                    </div>

                    <div className="w-full bg-white/10 rounded-full h-3">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${data.appointmentDetection.rate}%` }}
                            transition={{ duration: 1, delay: 0.6 }}
                            className="h-3 rounded-full bg-gradient-to-r from-orange-600 to-orange-400"
                        />
                    </div>

                    <p className="text-xs text-orange-200 mt-3">
                        AI, alınan randevuların %{data.appointmentDetection.rate}'sini önceden tespit etti veya logladı.
                    </p>
                </motion.div>

                {/* Confusion Matrix Visual */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-pink-500/30"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-pink-500/20 rounded-lg">
                            <Diamond className="w-5 h-5 text-pink-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Başarı Dağılımı</h3>
                            <p className="text-xs text-pink-300">Kazanım vs Kayıp</p>
                        </div>
                        <SectionInfo text="Cortex'in pozitif ve negatif tahminlerinin gerçek sonuçlarla dağılımı." />
                    </div>

                    <ResponsiveContainer width="100%" height={180} minHeight={100}>
                        <PieChart>
                            <Pie
                                data={confusionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={70}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {confusionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #ec4899',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </motion.div>
            </div >
        </div >
    );
}
