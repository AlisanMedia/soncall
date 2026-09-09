'use client';

import { useMemo, useState } from 'react';
import { Loader2, Shuffle, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile } from '@/types';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    leadIds: string[];
    agents: Profile[];
    marketId?: string | null;
    onSuccess: () => void;
};

export default function SelectedLeadDistribution({ isOpen, onClose, leadIds, agents, marketId, onSuccess }: Props) {
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const sdrAgents = useMemo(() => agents.filter((agent) => agent.role === 'agent' && agent.sales_role !== 'closer'), [agents]);

    if (!isOpen) return null;
    const toggle = (id: string) => setSelectedAgents((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

    const distribute = async () => {
        if (!leadIds.length || !selectedAgents.length) return;
        setLoading(true);
        try {
            const response = await fetch('/api/manager/leads/distribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadIds, agentIds: selectedAgents, marketId }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Dağıtım tamamlanamadı');
            toast.success(data.message);
            setSelectedAgents([]);
            onSuccess();
            onClose();
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'Dağıtım tamamlanamadı');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="equal-distribution-title">
            <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 id="equal-distribution-title" className="flex items-center gap-2 text-lg font-bold text-white"><Shuffle className="h-5 w-5 text-purple-300" /> Eşit Dağıt</h3>
                        <p className="mt-1 text-sm text-slate-400">Seçilen {leadIds.length} lead, işaretlediğiniz SDR’lara eşit paylaştırılır.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Kapat" className="min-h-10 min-w-10 rounded-lg text-slate-300 hover:bg-white/10"><X className="mx-auto h-5 w-5" /></button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {sdrAgents.map((agent) => (
                        <label key={agent.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white hover:bg-white/10">
                            <input type="checkbox" checked={selectedAgents.includes(agent.id)} onChange={() => toggle(agent.id)} className="h-4 w-4 accent-purple-500" />
                            <span className="truncate">{agent.full_name}</span>
                        </label>
                    ))}
                </div>
                <button type="button" onClick={distribute} disabled={loading || selectedAgents.length === 0} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shuffle className="h-5 w-5" />} {selectedAgents.length || 0} SDR’a Eşit Dağıt
                </button>
            </div>
        </div>
    );
}
