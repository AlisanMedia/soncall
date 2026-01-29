
'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, ShieldAlert, ArrowRightLeft, CheckSquare, Square } from 'lucide-react';
import TransferModal from './TransferModal';
import StuckLeadsPanel from './StuckLeadsPanel';
import { createClient } from '@/lib/supabase/client';
import { SectionInfo } from '@/components/ui/section-info';
import type { Profile } from '@/types';

// Simplified type for this view
interface ManagedLead {
    id: string;
    business_name: string;
    phone_number: string;
    status: string;
    assigned_to: string | null;
    created_at: string;
    category: string; // Added field
    batch_id: string; // Added field for context
    profiles?: { full_name: string }; // Agent
}

export default function LeadManagementView() {
    const [leads, setLeads] = useState<ManagedLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
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
        loadData();
    }, [agentFilter, statusFilter, categoryFilter, dateFilter]);

    const loadData = async () => {
        setLoading(true);
        // Load Agents (and Admins who might take calls)
        // Load Agents (and Admins who might take calls) - Use Backend API to bypass RLS
        try {
            const { agents } = await fetch('/api/manager/team/list-all').then(res => res.json());
            if (agents) setAgents(agents);
        } catch (e) {
            console.error('Failed to load agents', e);
        }

        // Load Unique Categories
        // Fetch from dedicated endpoint to get ALL categories, not just from the 500 loaded leads
        try {
            const { data: catData } = await fetch('/api/manager/leads/categories').then(res => res.json());
            if (catData?.categories) {
                setCategories(catData.categories);
            }
        } catch (e) {
            console.error('Failed to load categories', e);
        }

        // Load Leads
        let query = supabase
            .from('leads')
            .select(`
                id, business_name, phone_number, status, assigned_to, created_at, category, batch_id,
                profiles:assigned_to (full_name)
            `);

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

        if (leadsData) {
            setLeads(leadsData as any);
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Top Stats / Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StuckLeadsPanel onActionComplete={loadData} />

                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-white">Hızlı Filtre</h3>
                        <SectionInfo text="Belirli bir satış temsilcisine atanmış veya havuzda bekleyen leadleri buradan filtreleyebilirsiniz." />
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <select
                                className="bg-black/20 border border-white/10 rounded-lg p-2 text-white flex-1"
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
                                className="bg-black/20 border border-white/10 rounded-lg p-2 text-white flex-1"
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
                        <div className="flex gap-2">
                            <select
                                className="bg-black/20 border border-white/10 rounded-lg p-2 text-white flex-1"
                                value={categoryFilter}
                                onChange={e => { setCategoryFilter(e.target.value); setSelectedLeads([]); }}
                            >
                                <option value="all">Tüm Sektörler</option>
                                {categories.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <select
                                className="bg-black/20 border border-white/10 rounded-lg p-2 text-white flex-1"
                                value={dateFilter}
                                onChange={e => { setDateFilter(e.target.value); setSelectedLeads([]); }}
                            >
                                <option value="all">Tüm Zamanlar</option>
                                <option value="today">Bugün</option>
                                <option value="yesterday">Dün</option>
                                <option value="this_week">Son 7 Gün</option>
                            </select>
                            <button
                                onClick={loadData}
                                className="px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 whitespace-nowrap"
                            >
                                Yenile
                            </button>
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
                    <button
                        onClick={() => handleEmergencyRevoke(agentFilter)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all"
                    >
                        TÜMÜNÜ GERİ ÇEK (REVOKE)
                    </button>
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {/* Batch Actions Bar */}
                {selectedLeads.length > 0 && (
                    <div className="bg-purple-600 p-3 flex items-center justify-between animate-in slide-in-from-top-2">
                        <span className="text-white font-bold ml-2">{selectedLeads.length} lead seçildi</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTransferModalOpen(true)}
                                className="bg-white text-purple-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-gray-100 flex items-center gap-2"
                            >
                                <ArrowRightLeft className="w-4 h-4" /> Transfer Et
                            </button>
                            <button onClick={() => setSelectedLeads([])} className="text-purple-200 hover:text-white px-3 text-sm">İptal</button>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-purple-200 text-xs uppercase">
                            <tr>
                                <th className="p-4 w-10">
                                    <button onClick={toggleSelectAll}>
                                        {selectedLeads.length > 0 && selectedLeads.length === leads.length
                                            ? <CheckSquare className="w-5 h-5 text-purple-400" />
                                            : <Square className="w-5 h-5 text-gray-500" />}
                                    </button>
                                </th>
                                <th className="p-4">
                                    <div className="flex items-center gap-2">
                                        İşletme
                                        <SectionInfo text="Müşterinin ticari ünvanı veya kayıtlı adı." />
                                    </div>
                                </th>
                                <th className="p-4">
                                    <div className="flex items-center gap-2">
                                        Sektör
                                        <SectionInfo text="Leadin ait olduğu sektör kategorisi." />
                                    </div>
                                </th>
                                <th className="p-4">
                                    <div className="flex items-center gap-2">
                                        Mevcut Agent
                                        <SectionInfo text="Bu leadin şu anda atandığı satış temsilcisi. 'Havuzda' ise kimseye atanmamıştır." />
                                    </div>
                                </th>
                                <th className="p-4">
                                    <div className="flex items-center gap-2">
                                        Durum
                                        <SectionInfo text="Leadin anlık durumu (Örn: Beklemede, Arandı, Randevu)." />
                                    </div>
                                </th>
                                <th className="p-4">
                                    <div className="flex items-center gap-2">
                                        Oluşturma
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
                                    <tr key={lead.id} className={`hover:bg-white/5 transition-colors ${selectedLeads.includes(lead.id) ? 'bg-purple-500/10' : ''}`}>
                                        <td className="p-4">
                                            <button onClick={() => toggleSelect(lead.id)}>
                                                {selectedLeads.includes(lead.id)
                                                    ? <CheckSquare className="w-5 h-5 text-purple-400" />
                                                    : <Square className="w-5 h-5 text-gray-500" />}
                                            </button>
                                        </td>
                                        <td className="p-4 text-white font-medium">
                                            <div>{lead.business_name}</div>
                                            <div className="text-xs text-purple-300 sm:hidden">{lead.category}</div>
                                        </td>
                                        <td className="p-4 text-gray-300 hidden sm:table-cell">
                                            <span className="bg-white/10 px-2 py-1 rounded text-xs">{lead.category || 'Belirsiz'}</span>
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            {lead.profiles?.full_name || <span className="text-gray-500 italic">Havuzda</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded text-xs">{lead.status}</span>
                                        </td>
                                        <td className="p-4 text-gray-500 text-sm">
                                            {new Date(lead.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
