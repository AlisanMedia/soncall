
import { useState } from 'react';
import { AlertOctagon, RotateCcw, Loader2 } from 'lucide-react';

interface StuckLeadsPanelProps {
    onActionComplete: () => void;
}

export default function StuckLeadsPanel({ onActionComplete }: StuckLeadsPanelProps) {
    const [checking, setChecking] = useState(false);
    const [stuckCount, setStuckCount] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);

    const checkStuckLeads = async () => {
        setChecking(true);
        // This effectively triggers a "dry run" or we just call the reassign API to count
        // Currently my API just reassigns. 
        // For better UI, I should probably split "Check" and "Fix" logic or just proceed.
        // Let's assume user clicks "Fix Stuck Leads" directly.
        // But let's build a smarter dual-step if possible or simplify.
        // Simplified: Button "Otomatik Düzelt (24+ Saat)"

        // Actually, let's call API directly for now.
        try {
            const res = await fetch('/api/leads/reassign-stuck', {
                method: 'POST',
                body: JSON.stringify({ hours: 24, targetAgentId: null }) // Return to pool
            });
            const data = await res.json();
            if (data.success) {
                alert(`${data.count} adet sıkışmış lead havuza geri gönderildi.`);
                onActionComplete();
            } else {
                alert(data.message);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                <AlertOctagon className="w-5 h-5 text-red-500" />
                Stuck Lead Monitor
            </h3>
            <p className="text-gray-400 text-sm mb-4">
                24 saatten uzun süredir işlem görmeyen "Pending" lead'leri otomatik tespit et ve havuza geri gönder.
            </p>
            <button
                onClick={checkStuckLeads}
                disabled={checking}
                className="bg-red-600/20 hover:bg-red-600/40 text-red-200 px-4 py-2 rounded-lg border border-red-500/30 transition-colors flex items-center gap-2 text-sm font-medium"
            >
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Taramayı Başlat ve Düzelt
            </button>
        </div>
    );
}
