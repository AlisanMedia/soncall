'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Check, X, Loader2, AlertTriangle } from 'lucide-react';

interface Profile {
    id: string;
    full_name: string;
    email: string;
    pending_email: string;
    avatar_url?: string;
}

export default function EmailRequestsView() {
    const [requests, setRequests] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .not('pending_email', 'is', null);

        if (error) {
            console.error('Error fetching requests:', error);
        } else {
            setRequests(data as Profile[] || []);
        }
        setLoading(false);
    };

    const handleApprove = async (agentId: string, newEmail: string) => {
        setProcessingId(agentId);
        try {
            const response = await fetch('/api/admin/approve-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId, newEmail }),
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.error || 'Failed to approve');

            setRequests(prev => prev.filter(r => r.id !== agentId));
            alert('✅ Email değişikliği onaylandı ve güncellendi!');

        } catch (error: any) {
            console.error('Approval error:', error);
            alert('Hata: ' + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (agentId: string) => {
        if (!confirm('Bu talebi reddetmek istediğinize emin misiniz?')) return;

        setProcessingId(agentId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ pending_email: null })
                .eq('id', agentId);

            if (error) throw error;

            setRequests(prev => prev.filter(r => r.id !== agentId));

        } catch (error: any) {
            console.error('Rejection error:', error);
            alert('Hata: ' + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-white"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Yükleniyor...</div>;

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white/5 rounded-2xl border border-white/10">
                <Mail className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg">Bekleyen email değişiklik talebi yok.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Onay Bekleyen Email Değişiklikleri
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {requests.map((request) => (
                    <div key={request.id} className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-xl flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                                {request.full_name.substring(0, 1)}
                            </div>
                            <div>
                                <h3 className="text-white font-bold">{request.full_name}</h3>
                                <p className="text-xs text-gray-400">Mevcut: {request.email}</p>
                            </div>
                        </div>

                        <div className="bg-black/30 p-3 rounded-lg border border-yellow-500/30">
                            <p className="text-xs text-gray-400 mb-1">Talep Edilen Email:</p>
                            <p className="text-sm text-yellow-400 font-mono font-bold break-all">
                                {request.pending_email}
                            </p>
                        </div>

                        <div className="flex gap-2 mt-auto">
                            <button
                                onClick={() => handleApprove(request.id, request.pending_email)}
                                disabled={processingId === request.id}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {processingId === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Onayla
                            </button>
                            <button
                                onClick={() => handleReject(request.id)}
                                disabled={processingId === request.id}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                                Reddet
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
