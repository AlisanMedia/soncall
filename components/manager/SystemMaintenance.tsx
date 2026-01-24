'use client';

import { useState } from 'react';
import { Trash2, RefreshCw, Unlock, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function SystemMaintenance() {
    const [loading, setLoading] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ id: string; title: string; desc: string } | null>(null);

    const executeAction = async (actionId: string) => {
        setLoading(actionId);
        try {
            const response = await fetch('/api/admin/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: actionId,
                    confirm: true
                })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            alert(`✅ İşlem Başarılı: ${data.message}`);
        } catch (error: unknown) {
            console.error('System action failed:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`❌ Hata: ${message}`);
        } finally {
            setLoading(null);
            setConfirmAction(null);
        }
    };

    const actions = [
        {
            id: 'unlock_leads',
            title: 'Kilitli Leadleri Aç',
            description: '4 saatten uzun süredir "İşleniyor" durumunda kalan leadlerin kilidini kaldırır.',
            icon: Unlock,
            color: 'blue',
            dangerous: false
        },
        {
            id: 'cleanup_logs',
            title: 'Kayıtları Temizle',
            description: '30 günden eski çağrı kayıtlarını ve logları siler.',
            icon: Trash2,
            color: 'orange',
            dangerous: false
        },
        {
            id: 'reset_stats',
            title: 'İstatistikleri Sıfırla',
            description: 'Tüm ajanların bu ayki satış ve arama hedeflerindeki ilerlemesini sıfırlar.',
            icon: RefreshCw,
            color: 'yellow',
            dangerous: true
        },
        {
            id: 'reset_leads',
            title: 'Tüm Leadleri Sıfırla',
            description: 'TÜM leadleri "Beklemede" durumuna getirir ve atamaları kaldırır. (DİKKAT)',
            icon: RefreshCw,
            color: 'red',
            dangerous: true
        },
        {
            id: 'delete_leads',
            title: 'Tüm Veriyi Sil',
            description: 'Veritabanındaki TÜM lead kayıtlarını kalıcı olarak siler.',
            icon: ShieldAlert,
            color: 'red',
            dangerous: true
        }
    ];

    return (
        <div className="space-y-6">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-4">
                <div className="p-3 bg-red-500/20 rounded-lg text-red-400">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white mb-2">Sistem Bakımı ve Tehlikeli Bölge</h2>
                    <p className="text-gray-300">
                        Bu paneldeki işlemler geri alınamaz veri değişikliklerine neden olabilir. Lütfen işlem yapmadan önce dikkatli olun.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {actions.map((action) => (
                    <div
                        key={action.id}
                        className={`bg-white/5 border rounded-xl p-5 hover:border-white/20 transition-all ${action.dangerous ? 'border-red-500/20' : 'border-white/10'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-lg ${action.color === 'red' ? 'bg-red-500/20 text-red-400' :
                                action.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-blue-500/20 text-blue-400'
                                }`}>
                                <action.icon className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-white">{action.title}</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4 h-10">{action.description}</p>
                        <button
                            onClick={() => setConfirmAction({ id: action.id, title: action.title, desc: action.description })}
                            className={`w-full py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${action.dangerous
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
                                : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            {action.title}
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirmation Modal */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Emin misiniz?</h3>
                            <p className="text-gray-300 mb-4">
                                <span className="font-bold text-white">{confirmAction.title}</span> işlemini yapmak üzeresiniz.
                            </p>
                            <p className="text-sm text-red-300 bg-red-900/20 p-3 rounded-lg border border-red-900/50">
                                {confirmAction.desc}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium"
                            >
                                İptal
                            </button>
                            <button
                                onClick={() => executeAction(confirmAction.id)}
                                disabled={!!loading}
                                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                            >
                                {loading === confirmAction.id ? (
                                    <span className="animate-spin">⌛</span>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        Onayla
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
