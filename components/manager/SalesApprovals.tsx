'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, XCircle, DollarSign, Clock, User, Building2, Loader2, AlertCircle, TrendingUp, Calendar, Eye } from 'lucide-react';
import { toast } from 'sonner';
import LeadDetailModal from './LeadDetailModal';

interface SaleRequest {
    id: string;
    agent_id: string;
    lead_id: string;
    amount: number;
    commission?: number;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    agent: {
        full_name: string;
        email: string;
        avatar_url?: string;
    };
    lead: {
        business_name: string;
        phone_number: string;
    };
}

export default function SalesApprovals() {
    const [requests, setRequests] = useState<SaleRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<SaleRequest | null>(null);
    const [commissionAmount, setCommissionAmount] = useState('');
    const [managerNote, setManagerNote] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
    const [viewDetailRequest, setViewDetailRequest] = useState<SaleRequest | null>(null);

    const supabase = createClient();

    useEffect(() => {
        loadRequests();

        // Realtime subscription for new sales
        const channel = supabase
            .channel('sales_approvals')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, payload => {
                loadRequests(); // Reload on any change
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const loadRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    agent:profiles!sales_agent_id_fkey(full_name, email, avatar_url),
                    lead:leads!sales_lead_id_fkey(business_name, phone_number)
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data as any || []);
        } catch (error) {
            console.error('Error loading sales requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleActionClick = (request: SaleRequest, type: 'approve' | 'reject') => {
        setSelectedRequest(request);
        setActionType(type);
        setCommissionAmount(''); // Reset
        setManagerNote('');

        // Auto-calculate suggested commission (e.g. 10%)
        if (type === 'approve') {
            const suggested = (request.amount * 0.10).toFixed(2);
            setCommissionAmount(suggested);
        }
    };

    const submitAction = async () => {
        if (!selectedRequest || !actionType) return;
        setProcessingId(selectedRequest.id);

        try {
            const updateData: any = {
                status: actionType === 'approve' ? 'approved' : 'rejected',
                manager_notes: managerNote,
                approved_at: new Date().toISOString()
            };

            if (actionType === 'approve') {
                if (!commissionAmount) throw new Error('Komisyon tutarı girilmelidir.');
                updateData.commission = parseFloat(commissionAmount);
            }

            const { error } = await supabase
                .from('sales')
                .update(updateData)
                .eq('id', selectedRequest.id);

            if (error) throw error;

            toast.success(actionType === 'approve' ? 'Satış onaylandı ve prim işlendi!' : 'Satış reddedildi.');

            // Cleanup
            setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
            setSelectedRequest(null);
            setActionType(null);

        } catch (error: any) {
            console.error('Action error:', error);
            toast.error('İşlem başarısız: ' + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div className="p-4 flex justify-center"><img src="/loading-logo.png" alt="Loading" className="w-16 h-8 animate-pulse object-contain" /></div>;

    // Hide completely if no pending sales
    if (requests.length === 0) return null;

    return (
        <div className="mb-8 animate-in slide-in-from-top duration-500">
            <div className="bg-gradient-to-r from-orange-900/40 to-red-900/40 border border-orange-500/30 rounded-xl overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500 animate-pulse"></div>

                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-500/20 p-2 rounded-lg">
                            <AlertCircle className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Bekleyen Satış Onayları</h2>
                            <p className="text-orange-200/70 text-sm">{requests.length} adet yeni satış bildirimi var</p>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-white/5">
                    {requests.map(request => (
                        <div key={request.id} className="p-6 hover:bg-white/5 transition-colors">
                            <div className="flex flex-col md:flex-row md:items-center gap-6">
                                {/* Agent Info */}
                                <div className="flex items-center gap-3 md:w-1/4">
                                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-white/10">
                                        {request.agent.avatar_url ? (
                                            <img src={request.agent.avatar_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{request.agent.full_name}</div>
                                        <div className="text-xs text-gray-400">Temsilci</div>
                                    </div>
                                </div>

                                {/* Lead & Sale Info */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2 text-purple-300">
                                        <Building2 className="w-4 h-4" />
                                        <button
                                            onClick={() => setViewDetailRequest(request)}
                                            className="font-semibold hover:text-white hover:underline transition-colors text-left"
                                        >
                                            {request.lead.business_name}
                                            <span className="ml-2 text-xs bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30 text-purple-200 no-underline inline-block">
                                                <Eye className="w-3 h-3 inline mr-1" />
                                                Detay
                                            </span>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20">
                                            <DollarSign className="w-4 h-4 text-green-400" />
                                            <span className="text-green-400 font-bold text-lg">${request.amount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(request.created_at).toLocaleString('tr-TR')}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 md:w-auto w-full">
                                    <button
                                        onClick={() => handleActionClick(request, 'approve')}
                                        className="flex-1 md:flex-none px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-900/20"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Onayla
                                    </button>
                                    <button
                                        onClick={() => handleActionClick(request, 'reject')}
                                        className="flex-1 md:flex-none px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 hover:text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-red-500/30"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Reddet
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Approval/Rejection Modal */}
            {selectedRequest && actionType && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1e1e2d] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in fade-in zoom-in duration-200">
                        <div className={`p-6 border-b border-white/10 ${actionType === 'approve' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            <h3 className={`text-xl font-bold flex items-center gap-2 ${actionType === 'approve' ? 'text-green-400' : 'text-red-400'}`}>
                                {actionType === 'approve' ? <CheckCircle /> : <XCircle />}
                                {actionType === 'approve' ? 'Satışı Onayla' : 'Satışı Reddet'}
                            </h3>
                            <p className="text-gray-400 text-sm mt-1">
                                {selectedRequest.lead.business_name} - ${selectedRequest.amount.toLocaleString()}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            {actionType === 'approve' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Temsilci Primi (Commission)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                                        <input
                                            type="number"
                                            value={commissionAmount}
                                            onChange={e => setCommissionAmount(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-3 text-white focus:border-green-500 outline-none font-bold"
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Varsayılan olarak %10 önerilir. Değiştirebilirsiniz.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Yönetici Notu {actionType === 'reject' && '(Zorunlu)'}</label>
                                <textarea
                                    value={managerNote}
                                    onChange={e => setManagerNote(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none h-24 resize-none"
                                    placeholder={actionType === 'approve' ? "Opsiyonel not..." : "Reddetme sebebi..."}
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-black/20 border-t border-white/10 flex gap-3 justify-end">
                            <button
                                onClick={() => { setSelectedRequest(null); setActionType(null); }}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={submitAction}
                                disabled={processingId === selectedRequest.id || (actionType === 'reject' && !managerNote)}
                                className={`px-6 py-2 rounded-lg font-bold text-white shadow-lg transition-all flex items-center gap-2 ${actionType === 'approve'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                                    }`}
                            >
                                {processingId === selectedRequest.id && <Loader2 className="w-4 h-4 animate-spin" />}
                                {actionType === 'approve' ? 'Onayla ve Primi İşle' : 'Reddet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Lead Detail Modal */}
            {viewDetailRequest && (
                <LeadDetailModal
                    isOpen={!!viewDetailRequest}
                    onClose={() => setViewDetailRequest(null)}
                    lead={viewDetailRequest.lead}
                />
            )}
        </div>
    );
}
