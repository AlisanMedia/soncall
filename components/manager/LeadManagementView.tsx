
'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, ArrowRightLeft, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';

import TransferModal from './TransferModal';
import { GlassButton } from '@/components/ui/glass-button';
import StuckLeadsPanel from './StuckLeadsPanel';
import { createClient } from '@/lib/supabase/client';
import { SectionInfo } from '@/components/ui/section-info';
import LeadKanbanBoard, { KanbanLead } from './LeadKanbanBoard';
import LeadProfileModal from '../crm/LeadProfileModal';
import type { Profile } from '@/types';
import * as XLSX from 'xlsx';

export default function LeadManagementView({ selectedMarketId }: { selectedMarketId?: string | null }) {
    const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
    const [leads, setLeads] = useState<KanbanLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

    const [agentFilter, setAgentFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all'); // all, today, yesterday, this_week
    const [agents, setAgents] = useState<Profile[]>([]);
    const [categories, setCategories] = useState<string[]>([]); // Unique categories from DB or current set

    // Modal State
    const [isTransferModalOpen, setTransferModalOpen] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        loadMetadata();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMarketId]);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentFilter, statusFilter, categoryFilter, dateFilter, selectedMarketId]);

    const loadMetadata = async () => {
        try {
            const [agentsRes, categoriesRes] = await Promise.all([
                fetch(`/api/manager/team/list-all${selectedMarketId ? `?marketId=${encodeURIComponent(selectedMarketId)}` : ''}`),
                fetch(`/api/manager/leads/categories${selectedMarketId ? `?marketId=${encodeURIComponent(selectedMarketId)}` : ''}`),
            ]);

            if (agentsRes.ok) {
                const agentsData = await agentsRes.json();
                if (agentsData.agents) setAgents(agentsData.agents);
            }

            if (categoriesRes.ok) {
                const categoriesData = await categoriesRes.json();
                const nextCategories = categoriesData.categories || categoriesData.data?.categories || [];
                setCategories(nextCategories);
            }
        } catch (e) {
            console.error('Failed to load lead metadata', e);
        }
    };

    const loadData = async () => {
        setLoading(true);
        // Load Leads
        let query = supabase
            .from('leads')
            .select(`
                id, business_name, phone_number, status, assigned_to, created_at, category, batch_id, potential_level, ai_summary,
                profiles:assigned_to (full_name)
            `);

        if (selectedMarketId) {
            query = query.eq('market_id', selectedMarketId);
        }

        // Apply Status Filter
        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        // Apply Agent Filter
        if (agentFilter !== 'all') {
            if (agentFilter === 'unassigned') {
                query = query.is('assigned_to', null);
            } else {
                query = query.eq('assigned_to', agentFilter);
            }
        }

        // Apply Category Filter
        if (categoryFilter !== 'all') {
            if (categoryFilter === 'Belirsiz') {
                query = query.or('category.is.null,category.eq.""');
            } else {
                query = query.eq('category', categoryFilter);
            }
        }

        // Apply Date Filter
        const now = new Date();
        if (dateFilter === 'today') {
            const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            query = query.gte('created_at', startOfDay);
        } else if (dateFilter === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
            const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();
            query = query.gte('created_at', startOfYesterday).lte('created_at', endOfYesterday);
        } else if (dateFilter === 'this_week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte('created_at', weekAgo.toISOString());
        }

        const { data: leadsData, error } = await query.order('created_at', { ascending: false }).limit(500);

        if (error) {
            setLeads([]);
            setLoading(false);
            toast.error("Veri çekilirken hata oluştu!");
            return;
        }

        if (!error) {
            setLeads((leadsData || []) as unknown as KanbanLead[]);
        }
        setLoading(false);
    };

    const toggleSelect = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedLeads.length === leads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(leads.map(l => l.id));
        }
    };

    const handleLeadMove = async (leadId: string, newLevel: string) => {
        try {
            const { error } = await supabase
                .from('leads')
                .update({ potential_level: newLevel })
                .eq('id', leadId);

            if (error) throw error;
            toast.success('Müşteri durumu güncellendi');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Güncelleme başarısız';
            console.error('Update error:', error);
            toast.error('Güncelleme başarısız: ' + message);
            loadData(); // Revert optimistic update
        }
    };

    const exportToExcel = () => {
        const dataToExport = leads
            .filter(l => selectedLeads.length === 0 || selectedLeads.includes(l.id))
            .map(l => ({
                'İşletme Adı': l.business_name,
                'Telefon': l.phone_number,
                'Durum': l.status === 'pending' ? 'Beklemede' : l.status === 'appointment' ? 'Randevu' : 'Arandı',
                'Potansiyel': l.potential_level === 'high' ? 'Sıcak' : l.potential_level === 'medium' ? 'Ilık' : l.potential_level === 'low' ? 'Soğuk' : 'Belirsiz',
                'Sektör': l.category || 'Belirtilmemiş',
                'Temsilci': l.profiles?.full_name || 'Havuzda',
                'Kayıt Tarihi': new Date(l.created_at).toLocaleDateString('tr-TR')
            }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Musteriler");
        XLSX.writeFile(wb, `Soncall_CRM_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleEmergencyRevoke = async (agentId: string) => {
        if (!confirm('DİKKAT: Bu işlem agent üzerindeki TÜM bekleyen leadleri havuza geri alacak. Emin misiniz?')) return;

        const res = await fetch('/api/leads/revoke', {
            method: 'POST',
            body: JSON.stringify({ agentId })
        });
        const data = await res.json();
        if (data.success) {
            alert(data.message);
            loadData();
        } else {
            alert(data.error);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`${selectedLeads.length} adet lead kalıcı olarak silinecek. Bu işlem geri alınamaz! Emin misiniz?`)) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('leads')
                .delete()
                .in('id', selectedLeads);

            if (error) throw error;

            toast.success(`${selectedLeads.length} lead başarıyla silindi.`);
            setSelectedLeads([]);
            loadData();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Silme işlemi başarısız';
            console.error('Delete error:', error);
            toast.error('Silme işlemi başarısız: ' + message);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">

            {/* View Toggle & Export */}
            <div className="flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5">
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('kanban')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            viewMode === 'kanban' ? 'bg-purple-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        Kanban Pano (Satış Hunisi)
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            viewMode === 'table' ? 'bg-purple-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        Veri Tablosu (Liste)
                    </button>
                </div>

                <GlassButton
                    onClick={exportToExcel}
                    className="[&>.glass-button]:!bg-emerald-600 hover:[&>.glass-button]:!bg-emerald-500"
                    contentClassName="!px-4 !py-2 text-white text-sm font-bold"
                >
                    {selectedLeads.length > 0 ? 'Seçilenleri Export Et' : 'Excel Export'}
                </GlassButton>
            </div>

            {/* Top Stats / Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StuckLeadsPanel onActionComplete={loadData} />

                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-white">Hızlı Filtre</h3>
                        <SectionInfo text="Belirli bir satış temsilcisine atanmış veya havuzda bekleyen leadleri buradan filtreleyebilirsiniz." />
                    </div>
                    <div className="flex flex-col gap-2 sm:gap-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select
                                className="bg-black/20 border border-white/10 rounded-lg p-3 sm:p-2 text-white text-sm flex-1 touch-target"
                                value={agentFilter}
                                onChange={e => { setAgentFilter(e.target.value); setSelectedLeads([]); }}
                            >
                                <option value="all">Tüm Agentlar</option>
                                <option value="unassigned">Atanmamış (Havuz)</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.full_name}</option>
                                ))}
                            </select>
                            <select
                                className="bg-black/20 border border-white/10 rounded-lg p-3 sm:p-2 text-white text-sm flex-1 touch-target"
                                value={statusFilter}
                                onChange={e => { setStatusFilter(e.target.value); setSelectedLeads([]); }}
                            >
                                <option value="all">Tüm Durumlar</option>
                                <option value="pending">Beklemede</option>
                                <option value="called">Arandı</option>
                                <option value="appointment">Randevu</option>
                                <option value="completed">Tamamlandı</option>
                                <option value="rejected">Reddedildi</option>
                                <option value="unreachable">Ulaşılamadı</option>
                            </select>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select
                                className="bg-black/20 border border-white/10 rounded-lg p-3 sm:p-2 text-white text-sm flex-1 touch-target"
                                value={categoryFilter}
                                onChange={e => { setCategoryFilter(e.target.value); setSelectedLeads([]); }}
                            >
                                <option value="all">Tüm Sektörler (Kategoriler)</option>
                                {categories.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <select
                                className="bg-black/20 border border-white/10 rounded-lg p-3 sm:p-2 text-white text-sm flex-1 touch-target"
                                value={dateFilter}
                                onChange={e => { setDateFilter(e.target.value); setSelectedLeads([]); }}
                            >
                                <option value="all">Tüm Zamanlar</option>
                                <option value="today">Bugün</option>
                                <option value="yesterday">Dün</option>
                                <option value="this_week">Son 7 Gün</option>
                            </select>
                            <GlassButton
                                onClick={loadData}
                                className="[&>.glass-button]:!bg-white/10 hover:[&>.glass-button]:!bg-white/20"
                                contentClassName="!px-4 !py-3 sm:!py-2 text-white text-sm"
                            >
                                Yenile
                            </GlassButton>
                        </div>
                    </div>
                </div>
            </div>

            {/* Emergency Action Bar (Only visible if specific agent selected) */}
            {agentFilter !== 'all' && agentFilter !== 'unassigned' && (
                <div className="bg-red-900/20 border border-red-500/20 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-red-200">
                        <ShieldAlert className="w-5 h-5" />
                        <span className="font-semibold">{agents.find(a => a.id === agentFilter)?.full_name}</span> üzerindeki yetkiler
                        <SectionInfo text="Seçili temsilcinin üzerindeki TÜM bekleyen leadleri tek tıkla havuza geri alır. Acil durumlar içindir." />
                    </div>
                    <GlassButton
                        onClick={() => handleEmergencyRevoke(agentFilter)}
                        className="[&>.glass-button]:!bg-red-600 hover:[&>.glass-button]:!bg-red-700 shadow-lg"
                        contentClassName="!px-4 !py-2 text-white text-sm font-bold"
                    >
                        TÜMÜNÜ GERİ ÇEK (REVOKE)
                    </GlassButton>
                </div>
            )}

            {/* CRM Views */}
            {viewMode === 'kanban' ? (
                <LeadKanbanBoard
                    leads={leads}
                    isLoading={loading}
                    onLeadMove={handleLeadMove}
                    onLeadClick={(lead) => setActiveLeadId(lead.id)}
                />
            ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {/* Batch Actions Bar */}
                {selectedLeads.length > 0 && (
                    <div className="bg-purple-600 p-3 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-in slide-in-from-top-2">
                        <span className="text-white font-bold ml-2 text-sm">{selectedLeads.length} lead seçildi</span>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <GlassButton
                                onClick={() => setTransferModalOpen(true)}
                                className="flex-1 sm:flex-none [&>.glass-button]:!bg-white hover:[&>.glass-button]:!bg-gray-100"
                                contentClassName="text-purple-600 !px-4 !py-2 font-bold text-sm flex items-center justify-center gap-2"
                            >
                                <ArrowRightLeft className="w-4 h-4" /> Transfer Et
                            </GlassButton>
                            <GlassButton
                                onClick={() => setSelectedLeads([])}
                                className="hover:[&>.glass-button]:!bg-white/5"
                                contentClassName="text-purple-200 hover:text-white !px-3 !py-2 text-sm"
                            >
                                İptal
                            </GlassButton>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-purple-200 text-[10px] sm:text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="p-2 sm:p-4 w-10">
                                    <button onClick={toggleSelectAll} className="touch-target p-1">
                                        {selectedLeads.length > 0 && selectedLeads.length === leads.length
                                            ? <CheckSquare className="w-5 h-5 text-purple-400" />
                                            : <Square className="w-5 h-5 text-gray-500" />}
                                    </button>
                                </th>
                                <th className="p-2 sm:p-4 text-left">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        İşletme
                                        <span className="hidden sm:inline"><SectionInfo text="Müşterinin ticari ünvanı veya kayıtlı adı." /></span>
                                    </div>
                                </th>
                                <th className="p-2 sm:p-4 hidden sm:table-cell text-left">
                                    <div className="flex items-center gap-2">
                                        Sektör
                                        <SectionInfo text="Leadin ait olduğu sektör kategorisi." />
                                    </div>
                                </th>
                                <th className="p-2 sm:p-4 text-left">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">Mevcut</span> Agent
                                        <span className="hidden sm:inline"><SectionInfo text="Bu leadin şu anda atandığı satış temsilcisi. 'Havuzda' ise kimseye atanmamıştır." /></span>
                                    </div>
                                </th>
                                <th className="p-2 sm:p-4 text-left">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        Durum
                                        <span className="hidden sm:inline"><SectionInfo text="Leadin anlık durumu (Örn: Beklemede, Arandı, Randevu)." /></span>
                                    </div>
                                </th>
                                <th className="p-2 sm:p-4 hidden md:table-cell text-left">
                                    <div className="flex items-center gap-2">
                                        Tarih
                                        <SectionInfo text="Leadin sisteme ilk yüklendiği tarih." />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Yükleniyor...</td></tr>
                            ) : leads.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Gösterilecek lead bulunamadı.</td></tr>
                            ) : (
                                leads.map(lead => (
                                    <tr
                                        key={lead.id}
                                        className={`hover:bg-white/10 transition-colors text-xs sm:text-sm cursor-pointer ${selectedLeads.includes(lead.id) ? 'bg-purple-500/10' : ''}`}
                                        onClick={(e) => {
                                            // Only open modal if not clicking checkbox
                                            const target = e.target as HTMLElement;
                                            if (!target.closest('button')) {
                                                setActiveLeadId(lead.id);
                                            }
                                        }}
                                    >
                                        <td className="p-2 sm:p-4">
                                            <button onClick={() => toggleSelect(lead.id)} className="touch-target p-1">
                                                {selectedLeads.includes(lead.id)
                                                    ? <CheckSquare className="w-5 h-5 text-purple-400" />
                                                    : <Square className="w-5 h-5 text-gray-500" />}
                                            </button>
                                        </td>
                                        <td className="p-2 sm:p-4 text-white font-medium">
                                            <div className="truncate max-w-[120px] sm:max-w-none">{lead.business_name}</div>
                                            <div className="text-xs text-purple-300 sm:hidden truncate">{lead.category || 'Belirsiz'}</div>
                                        </td>
                                        <td className="p-2 sm:p-4 text-gray-300 hidden sm:table-cell">
                                            <span className="bg-white/10 px-2 py-1 rounded text-xs">{lead.category || 'Belirsiz Sektör'}</span>
                                        </td>
                                        <td className="p-2 sm:p-4 text-gray-300 text-xs sm:text-sm">
                                            {lead.profiles?.full_name || <span className="text-gray-500 italic">Havuzda</span>}
                                        </td>
                                        <td className="p-2 sm:p-4">
                                            <span className="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded text-[10px] sm:text-xs whitespace-nowrap">{lead.status}</span>
                                        </td>
                                        <td className="p-2 sm:p-4 text-gray-500 text-xs sm:text-sm hidden md:table-cell">
                                            {new Date(lead.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            <LeadProfileModal
                isOpen={!!activeLeadId}
                leadId={activeLeadId}
                onClose={() => setActiveLeadId(null)}
            />

            <TransferModal
                isOpen={isTransferModalOpen}
                onClose={() => setTransferModalOpen(false)}
                selectedLeadsCount={selectedLeads.length}
                leadIds={selectedLeads}
                onSuccess={() => {
                    setSelectedLeads([]);
                    loadData();
                }}
            />
        </div>
    );
}
