'use client';

import { motion } from 'framer-motion';
import { Lightbulb, TrendingUp, AlertTriangle, Target, Sparkles } from 'lucide-react';

interface CoachingTip {
    type: 'success' | 'improvement' | 'warning' | 'strategy';
    icon: React.ReactNode;
    title: string;
    message: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

interface CallCoachingTipsProps {
    analysis: {
        sentiment_score?: number | null;
        potential_level?: string | null;
        key_objections?: string[] | null;
        pain_points?: string[] | null;
        sales_completed?: boolean;
    };
    className?: string;
}

export default function CallCoachingTips({ analysis, className = '' }: CallCoachingTipsProps) {
    const tips: CoachingTip[] = [];

    // Success tips
    if (analysis.sales_completed) {
        tips.push({
            type: 'success',
            icon: <Sparkles className="w-4 h-4" />,
            title: 'Mükemmel İş!',
            message: 'Satışı başarıyla tamamladınız. Bu yaklaşımınızı gelecek görüşmelerde de uygulayın.',
            color: 'text-green-400',
            bgColor: 'bg-green-500/10',
            borderColor: 'border-green-500/30'
        });
    } else if ((analysis.sentiment_score || 0) >= 8) {
        tips.push({
            type: 'success',
            icon: <TrendingUp className="w-4 h-4" />,
            title: 'Harika Duygu Skoru',
            message: 'Müşteri çok olumlu! Şimdi randevu almak için doğru zaman. Somut bir sonraki adım önerin.',
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/10',
            borderColor: 'border-emerald-500/30'
        });
    }

    // Improvement tips based on sentiment
    if ((analysis.sentiment_score || 0) < 5 && (analysis.sentiment_score || 0) > 0) {
        tips.push({
            type: 'improvement',
            icon: <Target className="w-4 h-4" />,
            title: 'Duygu Durumu Orta',
            message: 'Müşterinin ilgisini artırmak için somut faydalardan bahsedin. Case study veya başarı hikayeleri paylaşın.',
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/10',
            borderColor: 'border-yellow-500/30'
        });
    }

    // Objection handling
    if (analysis.key_objections && analysis.key_objections.length > 0) {
        const objectionTips: Record<string, string> = {
            'pahalı': 'Fiyat itirazı için ROI hesaplaması yapın. "Ayda X saat tasarruf = Y TL değer" formülü kullanın.',
            'zaten var': 'Rakip ürünle fark yaratma! "Bizim sistemimiz şu ek özellikleri sunuyor..." deyin.',
            'düşünmem lazım': 'Kararsızlık = bilgi eksikliği. Ücretsiz demo veya pilot süreç önerin.',
            'zamanı değil': 'Zaman itirazı gerçek mi? Gelecek için not alıp takip tarihi belirleyin.'
        };

        for (const objection of analysis.key_objections) {
            const lowerObj = objection.toLowerCase();
            for (const [key, tip] of Object.entries(objectionTips)) {
                if (lowerObj.includes(key)) {
                    tips.push({
                        type: 'strategy',
                        icon: <Lightbulb className="w-4 h-4" />,
                        title: `İtiraz: "${objection}"`,
                        message: tip,
                        color: 'text-purple-400',
                        bgColor: 'bg-purple-500/10',
                        borderColor: 'border-purple-500/30'
                    });
                    break;
                }
            }
        }
    }

    // Warning for low potential
    if (analysis.potential_level === 'low') {
        tips.push({
            type: 'warning',
            icon: <AlertTriangle className="w-4 h-4" />,
            title: 'Düşük Potansiyel',
            message: 'Bu lead şu an hazır değil. Nurturing listesine ekleyin, 1-2 ay sonra tekrar ulaşın. Email kampanyası başlatın.',
            color: 'text-orange-400',
            bgColor: 'bg-orange-500/10',
            borderColor: 'border-orange-500/30'
        });
    }

    // Pain point leverage
    if (analysis.pain_points && analysis.pain_points.length > 1) {
        tips.push({
            type: 'strategy',
            icon: <Target className="w-4 h-4" />,
            title: 'Çoklu Sorun Noktası',
            message: `${analysis.pain_points.length} farklı sorun tespit edildi. Her birine özel çözüm sunarak değer katın.`,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/30'
        });
    }

    // General tip if nothing specific
    if (tips.length === 0) {
        tips.push({
            type: 'improvement',
            icon: <Lightbulb className="w-4 h-4" />,
            title: 'Genel İpucu',
            message: 'Sonraki görüşmede müşterinin sorunlarını daha derinlemesine keşfedin. "Neden?" sorusunu 3 kez sorun.',
            color: 'text-gray-400',
            bgColor: 'bg-gray-500/10',
            borderColor: 'border-gray-500/30'
        });
    }

    return (
        <div className={`space-y-3 ${className}`}>
            <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Coaching İpuçları</span>
            </div>

            <div className="space-y-2">
                {tips.map((tip, index) => (
                    <motion.div
                        key={index}
                        className={`p-3 rounded-lg border ${tip.borderColor} ${tip.bgColor}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <div className="flex items-start gap-2">
                            <div className={`mt-0.5 ${tip.color}`}>
                                {tip.icon}
                            </div>
                            <div className="flex-1">
                                <p className={`text-xs font-semibold mb-1 ${tip.color}`}>
                                    {tip.title}
                                </p>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    {tip.message}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
