'use client';

import { useState, useEffect } from 'react';
import {
    FileText, Clock, RotateCcw, Award,
    TrendingUp, TrendingDown, HelpCircle, Loader2
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { SectionInfo } from '@/components/ui/section-info';

interface QualityData {
    metrics: {
        agent_id: string;
        agent_name: string;
        avg_note_length: number;
        avg_handle_time: number;
        re_open_rate: number;
        quality_score: number;
        total_processed: number;
    }[];
    team: {
        avg_note_length: number;
        avg_handle_time: number;
        re_open_rate: number;
        quality_score: number;
    };
}

export default function QualityMetrics() {
    const [data, setData] = useState<QualityData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 60000); // 1 min refresh
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            const response = await fetch('/api/manager/quality');
            if (response.ok) {
                setData(await response.json());
            }
        } catch (err) {
            console.error('Quality data load error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
    );

    if (!data) return null;

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Award className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white">Kalite Skorlaması & Metrikler</h2>
                <SectionInfo text="Takımın ve bireysel agentların görüşme kalitesi, not detayları ve işlem sürelerinin analizi." />
            </div>

            {/* Team Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {/* Quality Score */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 sm:p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Award className="w-10 h-10 sm:w-12 sm:h-12" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs sm:text-sm text-purple-200 flex items-center gap-1">
                            <span className="truncate">Takım Skoru</span>
                            <span className="hidden sm:inline"><SectionInfo text="Yapay zeka tarafından değerlendirilen tüm görüşmelerin ortalama başarı puanı." /></span>
                        </span>
                        <div className={`text-2xl sm:text-3xl font-bold mt-1 ${getScoreColor(data.team.quality_score)}`}>
                            {data.team.quality_score}<span className="text-base sm:text-xl">/100</span>
                        </div>
                    </div>
                    <div className="mt-2 sm:mt-3 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-1000"
                            style={{ width: `${data.team.quality_score}%` }}
                        />
                    </div>
                </div>

                {/* Note Length */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span className="text-xs sm:text-sm text-purple-200 truncate">Not Uzunluğu</span>
                        <span className="hidden sm:inline"><SectionInfo text="Görüşme sonrası girilen notların ortalama karakter sayısı. Detaylı notlar kaliteyi artırır." /></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-white">
                        {data.team.avg_note_length} <span className="text-xs sm:text-sm font-normal text-white/50">krk</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-white/40 mt-1">Hedef: 50+</p>
                </div>

                {/* Handle Time */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                        <Clock className="w-4 h-4 text-purple-400" />
                        <span className="text-xs sm:text-sm text-purple-200 truncate">İşlem Süresi</span>
                        <span className="hidden sm:inline"><SectionInfo text="Bir leadin açılıp kapatılması arasında geçen ortalama süre." /></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-white">
                        {data.team.avg_handle_time} <span className="text-xs sm:text-sm font-normal text-white/50">sn</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-white/40 mt-1">Hedef: 60-180</p>
                </div>

                {/* Re-open Rate */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                        <RotateCcw className="w-4 h-4 text-orange-400" />
                        <span className="text-xs sm:text-sm text-purple-200 truncate">Tekrar Açılma</span>
                        <span className="hidden sm:inline"><SectionInfo text="Tamamlandı olarak işaretlenen leadlerin tekrar işleme alınma oranı." /></span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-white">
                        %{data.team.re_open_rate}
                    </div>
                    <p className="text-[10px] sm:text-xs text-white/40 mt-1">Düşük iyidir</p>
                </div>
            </div>

            {/* Agent Comparison Table */}
            <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-semibold text-white">Agent Performans Detayları</h3>
                    <span className="text-xs text-purple-300 bg-purple-500/10 px-2 py-1 rounded">
                        Son 24 Saat Verisi
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 text-purple-200 text-[10px] sm:text-sm">
                                <th className="p-2 sm:p-4 text-left">Agent</th>
                                <th className="p-2 sm:p-4 text-center">Skor</th>
                                <th className="p-2 sm:p-4 text-center hidden sm:table-cell">Not</th>
                                <th className="p-2 sm:p-4 text-center hidden md:table-cell">Süre</th>
                                <th className="p-2 sm:p-4 text-center hidden md:table-cell">Re-open</th>
                                <th className="p-2 sm:p-4 text-center">Top.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.metrics.map((agent) => (
                                <tr key={agent.agent_id} className="text-white text-xs sm:text-sm hover:bg-white/5 transition-colors">
                                    <td className="p-2 sm:p-4 font-medium flex items-center gap-2">
                                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                                            {agent.agent_name.charAt(0)}
                                        </div>
                                        <span className="truncate max-w-[80px] sm:max-w-none">{agent.agent_name}</span>
                                    </td>
                                    <td className="p-2 sm:p-4 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${agent.quality_score >= 80 ? 'bg-green-500/20 text-green-300' :
                                            agent.quality_score >= 60 ? 'bg-yellow-500/20 text-yellow-300' :
                                                'bg-red-500/20 text-red-300'
                                            }`}>
                                            {agent.quality_score}
                                        </span>
                                    </td>
                                    <td className="p-2 sm:p-4 text-center text-xs sm:text-sm hidden sm:table-cell">
                                        {agent.avg_note_length} krk
                                    </td>
                                    <td className="p-2 sm:p-4 text-center text-xs sm:text-sm hidden md:table-cell">
                                        {agent.avg_handle_time} sn
                                    </td>
                                    <td className="p-2 sm:p-4 text-center text-xs sm:text-sm hidden md:table-cell">
                                        %{agent.re_open_rate}
                                    </td>
                                    <td className="p-2 sm:p-4 text-center text-white/60 text-xs sm:text-sm">
                                        {agent.total_processed}
                                    </td>
                                </tr>
                            ))}

                            {data.metrics.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-white/40">
                                        Henüz veri bulunmuyor.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
