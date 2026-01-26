'use client';

import { AlertCircle, Calendar, Flame, TrendingDown, Target, User, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import SentimentMeter from '../ui/sentiment-meter';
import CallCoachingTips from '../ui/call-coaching-tips';

interface AIAnalysis {
    summary?: string | null;
    potential_level?: string | null;
    sentiment_score?: number | null;
    extracted_date?: string | null;
    customer_name?: string | null;
    decision_maker?: boolean;
    interested_service?: string | null;
    pain_points?: string[] | null;
    key_objections?: string[] | null;
    suggested_action?: string | null;
    next_call_timing?: string | null;
    sales_completed?: boolean;
}

interface AIAnalysisDisplayProps {
    analysis: AIAnalysis;
    className?: string;
}

export default function AIAnalysisDisplay({ analysis, className = '' }: AIAnalysisDisplayProps) {
    const getPotentialConfig = (level?: string | null) => {
        switch (level?.toLowerCase()) {
            case 'high':
                return {
                    label: 'YÜKSEK',
                    color: 'from-red-500 to-orange-500',
                    textColor: 'text-red-400',
                    bgColor: 'bg-red-500/10',
                    borderColor: 'border-red-500/30',
                    icon: <Flame className="w-4 h-4" />
                };
            case 'medium':
                return {
                    label: 'ORTA',
                    color: 'from-yellow-500 to-amber-500',
                    textColor: 'text-yellow-400',
                    bgColor: 'bg-yellow-500/10',
                    borderColor: 'border-yellow-500/30',
                    icon: <Target className="w-4 h-4" />
                };
            case 'low':
                return {
                    label: 'DÜŞÜK',
                    color: 'from-blue-500 to-slate-500',
                    textColor: 'text-blue-400',
                    bgColor: 'bg-blue-500/10',
                    borderColor: 'border-blue-500/30',
                    icon: <TrendingDown className="w-4 h-4" />
                };
            default:
                return {
                    label: 'BELİRLENEMEDİ',
                    color: 'from-gray-500 to-gray-600',
                    textColor: 'text-gray-400',
                    bgColor: 'bg-gray-500/10',
                    borderColor: 'border-gray-500/30',
                    icon: <AlertCircle className="w-4 h-4" />
                };
        }
    };

    const potentialConfig = getPotentialConfig(analysis.potential_level);
    const hasAnalysis = analysis.summary && analysis.summary !== 'Analiz yapılamadı';

    const NotAssessedBadge = () => (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-500/10 rounded-lg border border-gray-500/20">
            <AlertCircle className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">Analiz yapılmadı</span>
        </div>
    );

    return (
        <div className={`bg-gradient-to-br from-purple-500/5 to-indigo-500/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                        <span className="text-sm">🤖</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-white">AI SATIŞ ANALİZİ</h3>
                        <p className="text-xs text-purple-300">ArtificAgent</p>
                    </div>
                    {analysis.sales_completed && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded-lg border border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                            <span className="text-xs text-green-400 font-medium">Satış Tamamlandı</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Summary moved to notes field - hidden here */}

                {/* Metrics Row */}
                <div className="space-y-3">
                    {/* Potential Level */}
                    <div className={`p-3 rounded-lg border ${potentialConfig.borderColor} ${potentialConfig.bgColor}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            {potentialConfig.icon}
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Potansiyel</span>
                        </div>
                        <p className={`text-sm font-bold ${potentialConfig.textColor}`}>
                            {potentialConfig.label}
                        </p>
                    </div>

                    {/* Sentiment Score - Animated Meter */}
                    <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                        <SentimentMeter score={analysis.sentiment_score} />
                    </div>
                </div>

                {/* Date */}
                {analysis.extracted_date && (
                    <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Randevu/Tarih</span>
                        </div>
                        <p className="text-sm font-medium text-purple-300 mt-1">{analysis.extracted_date}</p>
                    </div>
                )}

                {/* Customer Info */}
                {analysis.customer_name && (
                    <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                        <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Müşteri</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">{analysis.customer_name}</p>
                            {analysis.decision_maker && (
                                <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-400">
                                    Karar Verici ✓
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Interested Service */}
                {analysis.interested_service && analysis.interested_service !== 'Belirsiz' && (
                    <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">🎯 İlgilenilen Hizmet</span>
                        </div>
                        <p className="text-sm font-medium text-white">{analysis.interested_service}</p>
                    </div>
                )}

                {/* Pain Points */}
                {analysis.pain_points && analysis.pain_points.length > 0 && (
                    <div className="p-3 rounded-lg border border-orange-500/20 bg-orange-500/5">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-orange-400" />
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Sorun Noktaları</span>
                        </div>
                        <ul className="space-y-1">
                            {analysis.pain_points.map((point, idx) => (
                                <li key={idx} className="text-sm text-orange-200 flex items-start gap-2">
                                    <span className="text-orange-400 mt-0.5">•</span>
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Objections */}
                {analysis.key_objections && analysis.key_objections.length > 0 && (
                    <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">İtirazlar</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {analysis.key_objections.map((objection, idx) => (
                                <span key={idx} className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">
                                    {objection}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Suggested Action */}
                {analysis.suggested_action && (
                    <div className="p-3 rounded-lg border border-green-500/20 bg-gradient-to-r from-green-500/5 to-emerald-500/5">
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowRight className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Önerilen Aksiyon</span>
                        </div>
                        <p className="text-sm text-green-200 leading-relaxed">{analysis.suggested_action}</p>
                    </div>
                )}

                {/* Next Call Timing */}
                {analysis.next_call_timing && (
                    <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">⏰ Sonraki Arama</span>
                        </div>
                        <p className="text-sm font-medium text-purple-300">{analysis.next_call_timing}</p>
                    </div>
                )
                }
                {/* Call Coaching Tips */}
                <CallCoachingTips analysis={analysis} />
            </div>
        </div>
    );
}
