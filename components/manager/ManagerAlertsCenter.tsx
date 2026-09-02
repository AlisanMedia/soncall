'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Bell,
    BellOff,
    CheckCircle2,
    Clock,
    Loader2,
    Phone,
    ShieldAlert,
    User,
    XCircle,
} from 'lucide-react';
import { playManagerCriticalAlert, playWarning } from '@/lib/sounds';

type ManagerAlert = {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
    title: string;
    message: string;
    due_at?: string | null;
    triggered_at: string;
    lead_id?: string | null;
    agent_id?: string | null;
    leads?: {
        lead_number?: number | null;
        business_name?: string | null;
        phone_number?: string | null;
        status?: string | null;
        potential_level?: string | null;
        callback_at?: string | null;
        appointment_date?: string | null;
    } | null;
    profiles?: {
        full_name?: string | null;
        phone_number?: string | null;
        sales_role?: string | null;
    } | null;
};

type AlertsResponse = {
    alerts?: ManagerAlert[];
    counts?: {
        active: number;
        critical: number;
        open: number;
    };
    setupRequired?: boolean;
    setupFile?: string;
};

function formatLeadCode(value?: number | null) {
    return value ? `#${String(value).padStart(4, '0')}` : '#----';
}

function formatDateTime(value?: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleString('tr-TR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDelay(value?: string | null) {
    if (!value) return '-';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (diffMinutes < 60) return `${diffMinutes} dk gecikti`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours} sa ${minutes} dk gecikti`;
}

function severityClass(severity: ManagerAlert['severity']) {
    switch (severity) {
        case 'critical':
            return 'border-red-500/40 bg-red-500/10 text-red-100';
        case 'high':
            return 'border-orange-500/40 bg-orange-500/10 text-orange-100';
        case 'medium':
            return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
        default:
            return 'border-white/10 bg-white/5 text-slate-100';
    }
}

function alertTypeLabel(type: string) {
    switch (type) {
        case 'callback_missed':
            return 'Callback kaçtı';
        case 'callback_due':
            return 'Callback zamanı';
        case 'appointment_unresolved':
            return 'Toplantı sonucu eksik';
        case 'appointment_missing_closer':
            return 'Closer atanmamış';
        case 'appointment_missing_meet':
            return 'Meet linki eksik';
        case 'high_potential_idle':
            return 'Sıcak lead bekliyor';
        case 'agent_inactive':
            return 'Agent pasif';
        case 'recording_missing':
            return 'Ses kaydı eksik';
        case 'ai_callback_needs_date':
            return 'Callback tarihi eksik';
        case 'repeat_miss':
            return 'Tekrarlı kaçırma';
        default:
            return 'Operasyon alarmı';
    }
}

export default function ManagerAlertsCenter({ selectedMarketId }: { selectedMarketId?: string | null }) {
    const [alerts, setAlerts] = useState<ManagerAlert[]>([]);
    const [counts, setCounts] = useState({ active: 0, critical: 0, open: 0 });
    const [loading, setLoading] = useState(true);
    const [setupRequired, setSetupRequired] = useState(false);
    const [filter, setFilter] = useState<'active' | 'open' | 'acknowledged' | 'resolved' | 'dismissed'>('active');
    const [mutatingId, setMutatingId] = useState<string | null>(null);
    const [soundMuted, setSoundMuted] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('manager_alert_sound_muted') === 'true';
    });
    const previousCriticalIds = useRef<Set<string>>(new Set());

    const criticalAlerts = useMemo(
        () => alerts.filter(alert => alert.severity === 'critical' && ['open', 'acknowledged'].includes(alert.status)),
        [alerts]
    );

    const loadAlerts = useCallback(async () => {
        try {
            const params = new URLSearchParams({ status: filter });
            if (selectedMarketId) params.set('marketId', selectedMarketId);
            const response = await fetch(`/api/manager/alerts?${params.toString()}`);
            const data = await response.json() as AlertsResponse;

            if (!response.ok) {
                throw new Error('Alarm verisi alınamadı');
            }

            const nextAlerts = data.alerts || [];
            const nextCriticalIds = new Set(
                nextAlerts
                    .filter(alert => alert.severity === 'critical' && alert.status === 'open')
                    .map(alert => alert.id)
            );

            const hasNewCritical = [...nextCriticalIds].some(id => !previousCriticalIds.current.has(id));

            if (hasNewCritical && !soundMuted) {
                playManagerCriticalAlert();
            } else if (nextAlerts.some(alert => alert.status === 'open') && !soundMuted) {
                playWarning();
            }

            previousCriticalIds.current = nextCriticalIds;
            setAlerts(nextAlerts);
            setCounts(data.counts || { active: 0, critical: 0, open: 0 });
            setSetupRequired(Boolean(data.setupRequired));
        } catch (error) {
            console.error('Manager alerts load error:', error);
        } finally {
            setLoading(false);
        }
    }, [filter, selectedMarketId, soundMuted]);

    useEffect(() => {
        loadAlerts();
        const interval = window.setInterval(loadAlerts, 30000);
        return () => window.clearInterval(interval);
    }, [loadAlerts]);

    const updateAlert = async (id: string, status: ManagerAlert['status']) => {
        setMutatingId(id);
        try {
            const response = await fetch('/api/manager/alerts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });

            if (!response.ok) {
                throw new Error('Alarm güncellenemedi');
            }

            await loadAlerts();
        } catch (error) {
            console.error('Manager alert update error:', error);
        } finally {
            setMutatingId(null);
        }
    };

    const toggleSound = () => {
        const next = !soundMuted;
        setSoundMuted(next);
        localStorage.setItem('manager_alert_sound_muted', String(next));
    };

    return (
        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur-md sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10">
                        <ShieldAlert className="h-5 w-5 text-red-300" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold text-white">Operasyon Alarm Merkezi</h2>
                            {counts.critical > 0 && (
                                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                                    {counts.critical} kritik
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-slate-400">
                            Callback, randevu ve takip disiplini burada kanıtla izlenir.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {(['active', 'open', 'acknowledged', 'resolved'] as const).map(item => (
                        <button
                            key={item}
                            onClick={() => setFilter(item)}
                            className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${filter === item
                                ? 'border-purple-400/60 bg-purple-500/20 text-white'
                                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                                }`}
                        >
                            {item === 'active' ? 'Aktif' : item === 'open' ? 'Açık' : item === 'acknowledged' ? 'Görüldü' : 'Çözüldü'}
                        </button>
                    ))}
                    <button
                        onClick={toggleSound}
                        className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10"
                        title={soundMuted ? 'Alarm sesini aç' : 'Alarm sesini kapat'}
                        aria-label={soundMuted ? 'Alarm sesini aç' : 'Alarm sesini kapat'}
                    >
                        {soundMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {setupRequired && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    Alarm tablosu henüz kurulmamış. Supabase SQL Editor’da
                    <span className="font-mono"> supabase/migrations/20260902_manager_alerts.sql </span>
                    dosyasını çalıştırınca bu merkez canlı alarm üretmeye başlar.
                </div>
            )}

            {loading ? (
                <div className="flex h-28 items-center justify-center text-slate-400">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Alarmlar kontrol ediliyor
                </div>
            ) : alerts.length === 0 ? (
                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-100">
                    Aktif operasyon alarmı yok. Callback ve randevu takipleri düzenli görünüyor.
                </div>
            ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {alerts.map(alert => (
                        <article key={alert.id} className={`rounded-xl border p-4 ${severityClass(alert.severity)}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                            {alertTypeLabel(alert.type)}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wide opacity-70">{alert.severity}</span>
                                    </div>
                                    <h3 className="mt-2 text-sm font-bold text-white">{alert.title}</h3>
                                    <p className="mt-1 text-sm leading-relaxed opacity-90">{alert.message}</p>
                                </div>
                                <AlertTriangle className="h-5 w-5 shrink-0 opacity-80" />
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-200/90 sm:grid-cols-3">
                                <div className="flex items-center gap-2 rounded-lg bg-black/15 px-2 py-2">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>{formatDelay(alert.due_at || alert.triggered_at)}</span>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-black/15 px-2 py-2">
                                    <User className="h-3.5 w-3.5" />
                                    <span className="truncate">{alert.profiles?.full_name || 'Agent yok'}</span>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-black/15 px-2 py-2">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span className="truncate">{alert.profiles?.phone_number || 'Telefon yok'}</span>
                                </div>
                            </div>

                            <div className="mt-3 rounded-lg bg-black/15 p-3 text-xs text-slate-200/90">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="font-bold text-white">{formatLeadCode(alert.leads?.lead_number)}</span>
                                    <span>{alert.leads?.business_name || 'İsimsiz lead'}</span>
                                    <span className="text-slate-400">Plan: {formatDateTime(alert.due_at)}</span>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                                {alert.status === 'open' && (
                                    <button
                                        onClick={() => updateAlert(alert.id, 'acknowledged')}
                                        disabled={mutatingId === alert.id}
                                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
                                    >
                                        <Bell className="h-3.5 w-3.5" />
                                        Gördüm
                                    </button>
                                )}
                                <button
                                    onClick={() => updateAlert(alert.id, 'resolved')}
                                    disabled={mutatingId === alert.id}
                                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-100 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                                >
                                    {mutatingId === alert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    Çözüldü
                                </button>
                                <button
                                    onClick={() => updateAlert(alert.id, 'dismissed')}
                                    disabled={mutatingId === alert.id}
                                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Kapat
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {criticalAlerts.length > 0 && !soundMuted && (
                <p className="mt-3 text-xs text-red-200/80">
                    Kritik alarm sesi yeni açık alarm geldiğinde çalar; aynı alarm için sürekli tekrar etmez.
                </p>
            )}
        </section>
    );
}
