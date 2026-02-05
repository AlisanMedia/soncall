
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, ArrowRight, CheckCircle, Loader2, Users } from 'lucide-react';
import type { Profile } from '@/types';

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedLeadsCount: number;
    leadIds: string[];
    onSuccess: () => void;
}

export default function TransferModal({ isOpen, onClose, selectedLeadsCount, leadIds, onSuccess }: TransferModalProps) {
    const [agents, setAgents] = useState<Profile[]>([]);
    const [targetAgentId, setTargetAgentId] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingAgents, setFetchingAgents] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        if (isOpen) {
            loadAgents();
        }
    }, [isOpen]);

    const loadAgents = async () => {
        try {
            const res = await fetch('/api/manager/team/list-all');
            const data = await res.json();
            setAgents(data.agents || []);
        } catch (e) {
            console.error(e);
        } finally {
            setFetchingAgents(false);
        }
    };

    const handleTransfer = async () => {
        if (!targetAgentId) return;

        setLoading(true);
        try {
            const res = await fetch('/api/leads/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadIds, targetAgentId })
            });
            const data = await res.json();

            if (data.success) {
                onSuccess();
                onClose();
            } else {
                alert('Transfer başarısız: ' + data.error);
            }
        } catch (error) {
            alert('Hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-[#1e293b] border-t sm:border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                <div className="sticky top-0 z-10 p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-sm">
                    <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                        <ArrowRight className="w-5 h-5 text-purple-400" />
                        Lead Transferi
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 touch-target"><X className="w-6 h-6 sm:w-5 sm:h-5" /></button>
                </div>

                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{selectedLeadsCount}</div>
                        <div className="text-xs sm:text-sm text-purple-300">Lead Transfer Edilecek</div>
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm mb-2 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Hedef Agent Seçin
                        </label>
                        {fetchingAgents ? (
                            <div className="h-12 sm:h-10 bg-white/5 animate-pulse rounded-lg"></div>
                        ) : (
                            <select
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 sm:p-3 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none touch-target text-base"
                                value={targetAgentId}
                                onChange={(e) => setTargetAgentId(e.target.value)}
                            >
                                <option value="">Agent Seçiniz...</option>
                                <option value="pool">⚠️ Havuz (Atamayı Kaldır)</option>
                                {agents.map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.full_name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <button
                        onClick={handleTransfer}
                        disabled={!targetAgentId || loading}
                        className="w-full py-4 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 touch-target-large active:scale-95"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        Transferi Onayla
                    </button>

                    <p className="text-xs text-gray-500 text-center pb-4">Transfer işleminden sonra lead'ler hedef agent'ın ekranında anında görünecektir.</p>
                </div>
            </div>
        </div>
    );
}
