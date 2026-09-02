'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarCheck, CheckCircle2, Headphones, PhoneCall, Search, Target, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Profile } from '@/types';

type Step = {
    id: string;
    title: string;
    body: string;
    icon: LucideIcon;
};

type Progress = {
    completed_steps?: string[];
    completed_at?: string | null;
    dismissed_at?: string | null;
    sales_role?: string | null;
};

const sdrSteps: Step[] = [
    {
        id: 'sdr_queue',
        title: 'Sıradaki leadi aç',
        body: 'Lead kartındaki telefon, kısa not ve geçmiş bilgiyi kontrol et. Lead kodu varsa yardımcı chate bu kodla soru sorabilirsin.',
        icon: Target,
    },
    {
        id: 'sdr_call',
        title: 'Görüşmeyi başlat ve kaydet',
        body: 'Arama sırasında net konuş, karar vericiyi bul ve görüşme kaydını analiz için sisteme gönder.',
        icon: PhoneCall,
    },
    {
        id: 'sdr_outcome',
        title: 'Sonucu doğru işle',
        body: 'Toplantı alındıysa randevu, tekrar aranacaksa callback, ilgilenmiyorsa doğru kapanış durumunu seç.',
        icon: CalendarCheck,
    },
    {
        id: 'sdr_callback',
        title: 'Callback disiplinini koru',
        body: 'Müşteri tarih verdiyse sistem SMS ve panel uyarısı üretir. Vakti gelince lead kartından tekrar arama yap.',
        icon: Headphones,
    },
    {
        id: 'sdr_assistant',
        title: 'Yardımcı chatten destek al',
        body: 'İtiraz, sektör, konuşma özeti veya lead geçmişi için SonCall yardımcı chatine kısa ve net soru sor.',
        icon: Search,
    },
];

const closerSteps: Step[] = [
    {
        id: 'closer_calendar',
        title: 'Randevuları kontrol et',
        body: 'Günün toplantılarını, lead notlarını ve SDR’ın bıraktığı kritik bilgileri görüşmeden önce oku.',
        icon: CalendarCheck,
    },
    {
        id: 'closer_meet',
        title: 'Google Meet görüşmesine gir',
        body: 'Müşterinin sorunu, bütçesi ve karar verici bilgisi üzerinden kısa, net ve çözüm odaklı ilerle.',
        icon: Headphones,
    },
    {
        id: 'closer_context',
        title: 'Geçmişi incele',
        body: 'Daha önce konuşma varsa timeline ve çağrı kaydı ikonundan önceki temasları kontrol et.',
        icon: BookOpen,
    },
    {
        id: 'closer_result',
        title: 'Toplantı sonucunu kapat',
        body: 'Satış oldu, olmadı, gelmedi veya takip gerekiyor gibi sonucu aynı gün içinde sisteme işle.',
        icon: CheckCircle2,
    },
    {
        id: 'closer_assistant',
        title: 'Kapanış desteği al',
        body: 'Teklif, itiraz, fiyatlandırma veya sonraki adım için yardımcı chatten closer koçu olarak destek iste.',
        icon: Search,
    },
];

function getLocalKey(userId: string) {
    return `soncall_onboarding_${userId}`;
}

export default function AgentOnboarding({ profile }: { profile: Profile }) {
    const [visible, setVisible] = useState(false);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [setupRequired, setSetupRequired] = useState(false);

    const steps = useMemo(() => (
        profile.sales_role === 'closer' ? closerSteps : sdrSteps
    ), [profile.sales_role]);

    const completedCount = completedSteps.length;
    const isComplete = completedCount >= steps.length;

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch('/api/agent/onboarding');
                const data = await response.json();
                const local = JSON.parse(localStorage.getItem(getLocalKey(profile.id)) || 'null') as Progress | null;
                const progress = data.progress || local;

                if (cancelled) return;

                setSetupRequired(Boolean(data.setupRequired));
                setCompletedSteps(progress?.completed_steps || []);
                setVisible(!progress?.completed_at && !progress?.dismissed_at);
            } catch {
                const local = JSON.parse(localStorage.getItem(getLocalKey(profile.id)) || 'null') as Progress | null;
                if (!cancelled) {
                    setCompletedSteps(local?.completed_steps || []);
                    setVisible(!local?.completed_at && !local?.dismissed_at);
                }
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [profile.id]);

    const persist = async (action: 'complete_step' | 'complete' | 'dismiss', stepId?: string) => {
        const nextSteps = stepId
            ? Array.from(new Set([...completedSteps, stepId]))
            : completedSteps;

        setCompletedSteps(nextSteps);
        if (action !== 'complete_step') setVisible(false);

        const localProgress: Progress = {
            completed_steps: nextSteps,
            completed_at: action === 'complete' ? new Date().toISOString() : null,
            dismissed_at: action === 'dismiss' ? new Date().toISOString() : null,
            sales_role: profile.sales_role || 'sdr',
        };
        localStorage.setItem(getLocalKey(profile.id), JSON.stringify(localProgress));

        try {
            await fetch('/api/agent/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    stepId,
                    completedSteps: nextSteps,
                    salesRole: profile.sales_role || 'sdr',
                }),
            });
        } catch {
            setSetupRequired(true);
        }
    };

    if (!visible) {
        return (
            <button
                onClick={() => setVisible(true)}
                className="fixed bottom-24 right-6 z-40 hidden md:flex items-center gap-2 rounded-full border border-cyan-400/30 bg-slate-950/90 px-4 py-2 text-sm text-cyan-100 shadow-xl shadow-cyan-500/10 hover:bg-cyan-500/10"
            >
                <BookOpen className="w-4 h-4" />
                Rehber
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-cyan-400/30 bg-slate-950 shadow-2xl shadow-cyan-500/10">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                            Yeni Başlayan Rehberi
                        </p>
                        <h2 className="mt-1 text-2xl font-bold text-white">
                            {profile.sales_role === 'closer' ? 'Closer Operasyon Akışı' : 'SDR Operasyon Akışı'}
                        </h2>
                        <p className="mt-2 text-sm text-slate-300">
                            Bu rehber, panelde gerçek işin hangi sırayla yürüdüğünü kısa ve net gösterir.
                        </p>
                    </div>
                    <button
                        onClick={() => persist('dismiss')}
                        className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                        aria-label="Rehberi kapat"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="max-h-[62vh] overflow-y-auto p-5">
                    {setupRequired && (
                        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                            Supabase onboarding tablosu uygulanana kadar ilerleme bu cihazda saklanır.
                        </div>
                    )}

                    <div className="mb-4 h-2 rounded-full bg-white/10">
                        <div
                            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
                            style={{ width: `${Math.round((completedCount / steps.length) * 100)}%` }}
                        />
                    </div>

                    <div className="space-y-3">
                        {steps.map((step, index) => {
                            const Icon = step.icon;
                            const done = completedSteps.includes(step.id);

                            return (
                                <button
                                    key={step.id}
                                    onClick={() => persist('complete_step', step.id)}
                                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
                                >
                                    <div className="flex gap-3">
                                        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${done ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300' : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'}`}>
                                            {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">
                                                {index + 1}. {step.title}
                                            </p>
                                            <p className="mt-1 text-sm leading-relaxed text-slate-300">{step.body}</p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-400">
                        {completedCount}/{steps.length} adım tamamlandı
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => persist('dismiss')}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                        >
                            Sonra bakacağım
                        </button>
                        <button
                            onClick={() => persist('complete')}
                            disabled={!isComplete}
                            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Rehberi tamamla
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
