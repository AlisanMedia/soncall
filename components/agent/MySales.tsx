'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DollarSign, TrendingUp, Package, Calendar, Building2, CheckCircle, Clock, XCircle } from 'lucide-react';

interface SaleItem {
    id: string;
    amount: number;
    commission: number;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    approved_at: string | null;
    manager_notes: string | null;
    lead: {
        business_name: string;
        phone_number: string;
    };
}

interface SalesStats {
    total_sales: number;
    approved_sales: number;
    pending_sales: number;
    rejected_sales: number;
    total_revenue: number;
    total_commission: number;
    approved_revenue: number;
    approved_commission: number;
}

export default function MySales() {
    const [sales, setSales] = useState<SaleItem[]>([]);
    const [stats, setStats] = useState<SalesStats>({
        total_sales: 0,
        approved_sales: 0,
        pending_sales: 0,
        rejected_sales: 0,
        total_revenue: 0,
        total_commission: 0,
        approved_revenue: 0,
        approved_commission: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('sales')
            .select(`
                id,
                amount,
                commission,
                status,
                created_at,
                approved_at,
                manager_notes,
                lead:leads!sales_lead_id_fkey(business_name, phone_number)
            `)
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Sales load error:', error);
            setLoading(false);
            return;
        }

        setSales(data || []);

        // Calculate stats
        const newStats: SalesStats = {
            total_sales: data?.length || 0,
            approved_sales: data?.filter(s => s.status === 'approved').length || 0,
            pending_sales: data?.filter(s => s.status === 'pending').length || 0,
            rejected_sales: data?.filter(s => s.status === 'rejected').length || 0,
            total_revenue: data?.reduce((sum, s) => sum + parseFloat(String(s.amount)), 0) || 0,
            total_commission: data?.reduce((sum, s) => sum + parseFloat(String(s.commission || 0)), 0) || 0,
            approved_revenue: data?.filter(s => s.status === 'approved').reduce((sum, s) => sum + parseFloat(String(s.amount)), 0) || 0,
            approved_commission: data?.filter(s => s.status === 'approved').reduce((sum, s) => sum + parseFloat(String(s.commission || 0)), 0) || 0,
        };

        setStats(newStats);
        setLoading(false);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Onaylandı
                    </span>
                );
            case 'pending':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Onay Bekliyor
                    </span>
                );
            case 'rejected':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-xs font-medium">
                        <XCircle className="w-3 h-3" />
                        Reddedildi
                    </span>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <img src="/loading-logo.png" alt="Loading" className="w-16 h-8 animate-pulse object-contain" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-5 border border-purple-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-200 text-sm font-medium">Toplam Satış</p>
                            <p className="text-3xl font-bold text-white mt-1">{stats.total_sales}</p>
                        </div>
                        <Package className="w-10 h-10 text-purple-400" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-5 border border-green-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-200 text-sm font-medium">Onaylandı</p>
                            <p className="text-3xl font-bold text-white mt-1">{stats.approved_sales}</p>
                        </div>
                        <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-5 border border-blue-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-200 text-sm font-medium">Toplam Ciro</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats.approved_revenue.toLocaleString()}₺</p>
                        </div>
                        <TrendingUp className="w-10 h-10 text-blue-400" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl p-5 border border-yellow-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-yellow-200 text-sm font-medium">Kazandığım Prim</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats.approved_commission.toLocaleString()}₺</p>
                        </div>
                        <DollarSign className="w-10 h-10 text-yellow-400" />
                    </div>
                </div>
            </div>

            {/* Sales List */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                <div className="flex items-center gap-2 mb-6">
                    <Package className="w-6 h-6 text-purple-400" />
                    <h2 className="text-xl font-bold text-white">Satış Geçmişim</h2>
                </div>

                {sales.length === 0 ? (
                    <div className="text-center py-12 text-purple-300">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Henüz satış kaydınız bulunmuyor.</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {sales.map((sale) => (
                            <div
                                key={sale.id}
                                className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-500/20 rounded-lg">
                                            <Building2 className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-semibold">{sale.lead.business_name}</h3>
                                            <p className="text-sm text-purple-300">{sale.lead.phone_number}</p>
                                        </div>
                                    </div>
                                    {getStatusBadge(sale.status)}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                    <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
                                        <p className="text-xs text-blue-300 mb-1">Satış Tutarı</p>
                                        <p className="text-lg font-bold text-blue-200">{parseFloat(String(sale.amount)).toLocaleString()}₺</p>
                                    </div>
                                    <div className="bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/20">
                                        <p className="text-xs text-yellow-300 mb-1">Prim</p>
                                        <p className="text-lg font-bold text-yellow-200">+{parseFloat(String(sale.commission || 0)).toLocaleString()}₺</p>
                                    </div>
                                    <div className="bg-purple-500/10 rounded-lg p-2 border border-purple-500/20">
                                        <p className="text-xs text-purple-300 mb-1">Tarih</p>
                                        <p className="text-sm font-semibold text-purple-200">
                                            {new Date(sale.created_at).toLocaleDateString('tr-TR')}
                                        </p>
                                    </div>
                                    {sale.approved_at && (
                                        <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/20">
                                            <p className="text-xs text-green-300 mb-1">Onay Tarihi</p>
                                            <p className="text-sm font-semibold text-green-200">
                                                {new Date(sale.approved_at).toLocaleDateString('tr-TR')}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {sale.manager_notes && (
                                    <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                                        <p className="text-xs text-purple-300 mb-1">Yönetici Notu:</p>
                                        <p className="text-sm text-white">{sale.manager_notes}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pending vs Approved Summary */}
            {stats.pending_sales > 0 && (
                <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30 flex items-center gap-3">
                    <Clock className="w-8 h-8 text-yellow-400 flex-shrink-0" />
                    <div>
                        <p className="text-yellow-200 font-semibold">
                            {stats.pending_sales} satışınız onay bekliyor
                        </p>
                        <p className="text-yellow-300 text-sm">
                            Toplam {(stats.total_revenue - stats.approved_revenue).toLocaleString()}₺ ciro onay süreci
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
