'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock3, Loader2, RefreshCw, Users } from 'lucide-react';

type InventoryItem = {
    agentId: string;
    agentName: string;
    remaining: number;
    pending: number;
    inProgress: number;
    callback: number;
    contacted: number;
    appointment: number;
    totalAssigned: number;
};

export default function AgentLeadInventory({ marketId, refreshVersion = 0 }: { marketId?: string | null; refreshVersion?: number }) {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshedAt, setRefreshedAt] = useState('');

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ view: 'summary' });
            if (marketId) params.set('marketId', marketId);
            const response = await fetch(`/api/manager/leads?${params}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.message || 'Lead sayıları yüklenemedi');
            setItems(data.inventory || []);
            setRefreshedAt(data.refreshedAt || new Date().toISOString());
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Lead sayıları yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [marketId]);

    useEffect(() => {
        const initialLoad = window.setTimeout(() => load(), 0);
        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') load(true);
        }, 20_000);
        return () => {
            window.clearTimeout(initialLoad);
            window.clearInterval(interval);
        };
    }, [load, refreshVersion]);

    return (
        <section className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4" aria-labelledby="lead-inventory-title">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 id="lead-inventory-title" className="flex items-center gap-2 text-base font-bold text-white sm:text-lg">
                        <Users className="h-5 w-5 text-cyan-300" aria-hidden="true" /> Agent Lead Durumu
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">Kalan = bekleyen + işlemde + geri arama. 20 saniyede bir yenilenir.</p>
                </div>
                <button type="button" onClick={() => load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-200 hover:bg-white/10">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile
                </button>
            </div>

            {error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
            ) : loading && items.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor</div>
            ) : items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-slate-400">Bu operasyonda SDR bulunamadı.</div>
            ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => (
                        <article key={item.agentId} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="min-w-0 truncate text-sm font-semibold text-white">{item.agentName}</span>
                                <span className="shrink-0 rounded-full bg-cyan-500/15 px-2.5 py-1 text-sm font-bold text-cyan-200">{item.remaining} kalan</span>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[11px]">
                                <span className="rounded bg-white/5 px-1 py-1.5 text-slate-300">Bekleyen <b className="block text-white">{item.pending}</b></span>
                                <span className="rounded bg-white/5 px-1 py-1.5 text-slate-300">İşlemde <b className="block text-white">{item.inProgress}</b></span>
                                <span className="rounded bg-amber-500/10 px-1 py-1.5 text-amber-200">Geri arama <b className="block">{item.callback}</b></span>
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500">Toplam atanmış {item.totalAssigned} · Arandı {item.contacted} · Randevu {item.appointment}</div>
                        </article>
                    ))}
                </div>
            )}
            {refreshedAt && <p className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500"><Clock3 className="h-3 w-3" /> Son güncelleme {new Date(refreshedAt).toLocaleTimeString('tr-TR')}</p>}
        </section>
    );
}
