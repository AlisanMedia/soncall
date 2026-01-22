'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Eye, Loader2, Calendar, Phone, Building2, X, Edit2, Save, XCircle, Plus, DollarSign, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface Lead {
    id: string;
    business_name: string;
    phone_number: string;
    address: string | null;
    category: string | null;
    status: string;
    potential_level: string;
    processed_at: string | null;
    created_at: string;
    lead_notes: Array<{
        note: string;
        action_taken: string | null;
        created_at: string;
    }>;
}

export default function LeadHistoryView() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [potentialFilter, setPotentialFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');

    // Edit & Action States
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Lead>>({});
    const [newNote, setNewNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Sale Modal States
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [saleAmount, setSaleAmount] = useState('');
    const [isSubmittingSale, setIsSubmittingSale] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        loadLeads();
    }, [statusFilter, potentialFilter, dateFilter]);

    const loadLeads = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();

            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (potentialFilter !== 'all') params.append('potential_level', potentialFilter);

            // Date filters
            if (dateFilter !== 'all') {
                const now = new Date();
                let dateFrom = new Date();

                switch (dateFilter) {
                    case 'today':
                        dateFrom.setHours(0, 0, 0, 0);
                        break;
                    case 'week':
                        dateFrom.setDate(now.getDate() - 7);
                        break;
                    case 'month':
                        dateFrom.setMonth(now.getMonth() - 1);
                        break;
                }

                params.append('date_from', dateFrom.toISOString());
            }

            const response = await fetch(`/api/agent/leads?${params.toString()}`);
            const data = await response.json();

            if (response.ok) {
                setLeads(data.leads || []);
            }
        } catch (error) {
            console.error('Error loading leads:', error);
            toast.error('Leadler yüklenirken hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = () => {
        if (selectedLead) {
            setEditForm({
                status: selectedLead.status,
                potential_level: selectedLead.potential_level
            });
            setIsEditing(true);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditForm({});
    };

    const handleSaveLead = async () => {
        if (!selectedLead) return;
        setIsSaving(true);
        try {
            // Update Lead Basic Info
            const { error } = await supabase
                .from('leads')
                .update({
                    status: editForm.status,
                    potential_level: editForm.potential_level
                })
                .eq('id', selectedLead.id);

            if (error) throw error;

            toast.success('Lead bilgileri güncellendi');

            // Update local state
            setSelectedLead(prev => prev ? ({ ...prev, ...editForm } as Lead) : null);
            setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...editForm } as Lead : l));
            setIsEditing(false);

        } catch (error: any) {
            console.error('Update error:', error);
            toast.error('Güncelleme başarısız: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddNote = async () => {
        if (!selectedLead || !newNote.trim()) return;
        setIsSaving(true);

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Oturum bulunamadı');

            // Insert into lead_notes table (separate table, not a column in leads)
            const { data: insertedNote, error } = await supabase
                .from('lead_notes')
                .insert({
                    lead_id: selectedLead.id,
                    agent_id: user.id,
                    note: newNote,
                    action_taken: 'Manual Update'
                })
                .select()
                .single();

            if (error) throw error;

            toast.success('Not eklendi');
            setNewNote('');

            // Update local state with new note
            const newNoteObj = {
                note: insertedNote.note,
                action_taken: insertedNote.action_taken,
                created_at: insertedNote.created_at
            };

            setSelectedLead(prev => prev ? ({ ...prev, lead_notes: [...(prev.lead_notes || []), newNoteObj] }) : null);
            setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, lead_notes: [...(l.lead_notes || []), newNoteObj] } : l));

        } catch (error: any) {
            console.error('Note add error:', error);
            toast.error('Not eklenemedi: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReportSale = async () => {
        if (!selectedLead || !saleAmount || isNaN(Number(saleAmount))) {
            toast.error('Geçerli bir tutar giriniz');
            return;
        }

        setIsSubmittingSale(true);
        try {
            // Get Current User ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Oturum bulunamadı');

            const amount = parseFloat(saleAmount);

            // 1. Insert into Sales table
            const { error: saleError } = await supabase
                .from('sales')
                .insert({
                    lead_id: selectedLead.id,
                    agent_id: user.id, // Profile ID usually matches User ID in Supabase Auth
                    amount: amount,
                    status: 'pending'
                });

            if (saleError) throw saleError;

            // 2. Auto-update lead status to "won" or similar if desired? 
            // Let's keep it manual or update strictly to 'sale_pending' if you have that status.
            // For now just insert sale.

            // Celebration!
            triggerConfetti();
            toast.success('Satış raporlandı! Yönetici onayı bekleniyor. 💸');

            setShowSaleModal(false);
            setSaleAmount('');

        } catch (error: any) {
            console.error('Sale report error:', error);
            toast.error('Satış raporlanamadı: ' + error.message);
        } finally {
            setIsSubmittingSale(false);
        }
    };

    const triggerConfetti = () => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 60 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti?.({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti?.({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    const filteredLeads = leads.filter(lead =>
        lead.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone_number.includes(searchTerm)
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'appointment': return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'contacted': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'not_interested': return 'bg-red-500/20 text-red-300 border-red-500/30';
            case 'callback': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'appointment': return 'Randevu';
            case 'contacted': return 'Ulaşıldı';
            case 'not_interested': return 'İlgilenmiyor';
            case 'callback': return 'Geri Arama';
            case 'pending': return 'Beklemede';
            default: return status;
        }
    };

    const getPotentialColor = (level: string) => {
        switch (level) {
            case 'high': return 'bg-green-500/20 text-green-300';
            case 'medium': return 'bg-yellow-500/20 text-yellow-300';
            case 'low': return 'bg-red-500/20 text-red-300';
            default: return 'bg-gray-500/20 text-gray-300';
        }
    };

    const getPotentialLabel = (level: string) => {
        switch (level) {
            case 'high': return 'Yüksek';
            case 'medium': return 'Orta';
            case 'low': return 'Düşük';
            default: return 'Değerlendirilmedi';
        }
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Lead Geçmişi</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/50" />
                        <input
                            type="text"
                            placeholder="İşletme adı veya telefon ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-purple-300/30 focus:outline-none focus:border-purple-500/50"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="all">Tüm Durumlar</option>
                        <option value="appointment">Randevu</option>
                        <option value="contacted">Ulaşıldı</option>
                        <option value="not_interested">İlgilenmiyor</option>
                        <option value="callback">Geri Arama</option>
                        <option value="pending">Beklemede</option>
                    </select>

                    {/* Potential Filter */}
                    <select
                        value={potentialFilter}
                        onChange={(e) => setPotentialFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="all">Tüm Potansiyeller</option>
                        <option value="high">Yüksek</option>
                        <option value="medium">Orta</option>
                        <option value="low">Düşük</option>
                    </select>

                    {/* Date Filter */}
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="all">Tüm Zamanlar</option>
                        <option value="today">Bugün</option>
                        <option value="week">Son 7 Gün</option>
                        <option value="month">Son 30 Gün</option>
                    </select>
                </div>
            </div>

            {/* Results */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <img src="/loading-logo.png" alt="Loading" className="w-16 h-8 animate-pulse object-contain" />
                    </div>
                ) : filteredLeads.length === 0 ? (
                    <div className="text-center py-12 text-purple-300">
                        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Kayıt bulunamadı.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-purple-200 text-sm">
                                <tr>
                                    <th className="p-4">İşletme</th>
                                    <th className="p-4">Telefon</th>
                                    <th className="p-4">Durum</th>
                                    <th className="p-4">Potansiyel</th>
                                    <th className="p-4">İşlenme Tarihi</th>
                                    <th className="p-4 text-right">Detay</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLeads.map(lead => (
                                    <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-white font-medium">{lead.business_name}</td>
                                        <td className="p-4 text-purple-200">{lead.phone_number}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(lead.status)}`}>
                                                {getStatusLabel(lead.status)}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPotentialColor(lead.potential_level)}`}>
                                                {getPotentialLabel(lead.potential_level)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-400 text-sm">
                                            {lead.processed_at
                                                ? new Date(lead.processed_at).toLocaleDateString('tr-TR', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })
                                                : '-'
                                            }
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedLead(lead)}
                                                className="p-1 hover:bg-white/10 rounded text-purple-300 hover:text-white transition-colors"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Lead Detail & Edit Modal */}
            {selectedLead && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden" onClick={() => setSelectedLead(null)}>
                    <div className="bg-[#1a1a2e] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5 shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    {selectedLead.business_name}
                                    {isEditing && <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">DÜZENLENİYOR</span>}
                                </h3>
                                <p className="text-purple-300 text-sm mt-1 flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    {selectedLead.phone_number}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isEditing ? (
                                    <>
                                        <button
                                            onClick={() => setShowSaleModal(true)}
                                            className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] border border-green-500/50"
                                            title="Satış Bildir"
                                        >
                                            <Trophy className="w-5 h-5" />
                                            <span className="hidden sm:inline font-bold">Satış Yapıldı</span>
                                        </button>
                                        <button
                                            onClick={handleEditClick}
                                            className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg transition-colors border border-white/10"
                                            title="Düzenle"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleSaveLead}
                                            disabled={isSaving}
                                            className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition-colors border border-purple-500"
                                            title="Kaydet"
                                        >
                                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2 rounded-lg transition-colors border border-red-500/30"
                                            title="İptal"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => setSelectedLead(null)}
                                    className="text-gray-400 hover:text-white transition-colors ml-2"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">

                            {/* Lead Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Kategori</div>
                                    <div className="text-white">{selectedLead.category || '-'}</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Adres</div>
                                    <div className="text-white truncate">{selectedLead.address || '-'}</div>
                                </div>

                                <div className={`p-4 rounded-xl border transition-all ${isEditing ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-white/5 border-white/5'}`}>
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Durum</div>
                                    {isEditing ? (
                                        <select
                                            value={editForm.status}
                                            onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-purple-500 outline-none"
                                        >
                                            <option value="appointment">Randevu</option>
                                            <option value="contacted">Ulaşıldı</option>
                                            <option value="not_interested">İlgilenmiyor</option>
                                            <option value="callback">Geri Arama</option>
                                            <option value="pending">Beklemede</option>
                                        </select>
                                    ) : (
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getStatusColor(selectedLead.status)}`}>
                                            {getStatusLabel(selectedLead.status)}
                                        </span>
                                    )}
                                </div>

                                <div className={`p-4 rounded-xl border transition-all ${isEditing ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-white/5 border-white/5'}`}>
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Potansiyel</div>
                                    {isEditing ? (
                                        <select
                                            value={editForm.potential_level}
                                            onChange={e => setEditForm({ ...editForm, potential_level: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-purple-500 outline-none"
                                        >
                                            <option value="high">Yüksek</option>
                                            <option value="medium">Orta</option>
                                            <option value="low">Düşük</option>
                                            <option value="unknown">Değerlendirilmedi</option>
                                        </select>
                                    ) : (
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPotentialColor(selectedLead.potential_level)}`}>
                                            {getPotentialLabel(selectedLead.potential_level)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Notes History */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-purple-400" />
                                        Görüşme Notları
                                    </h4>
                                </div>

                                {/* Add Note - Always visible */}
                                <div className="flex gap-2 items-start">
                                    <textarea
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        placeholder="Yeni not ekle..."
                                        className="flex-1 bg-black/20 border border-white/10 rounded-lg p-3 text-white text-sm placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all resize-none min-h-[60px]"
                                    />
                                    <button
                                        onClick={handleAddNote}
                                        disabled={!newNote.trim() || isSaving}
                                        className="p-3 bg-purple-600/20 hover:bg-purple-600 hover:text-white text-purple-400 rounded-lg border border-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Notu Kaydet"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {selectedLead.lead_notes && selectedLead.lead_notes.length > 0 ? (
                                        [...selectedLead.lead_notes].reverse().map((note, i) => (
                                            <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                                <p className="text-gray-200 text-sm mb-2 whitespace-pre-wrap leading-relaxed">{note.note}</p>
                                                <div className="flex items-center justify-between mt-2">
                                                    {note.action_taken && (
                                                        <span className="text-purple-400/70 text-[10px] uppercase font-bold tracking-wider bg-purple-500/10 px-2 py-0.5 rounded">
                                                            {note.action_taken}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-gray-500 font-mono ml-auto">
                                                        {new Date(note.created_at).toLocaleString('tr-TR')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-6 text-gray-500 italic text-sm bg-white/5 rounded-xl border border-white/5 border-dashed">
                                            Henüz not eklenmemiş.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/20 text-right shrink-0">
                            <button
                                onClick={() => setSelectedLead(null)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sale Report Modal */}
            {showSaleModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-gradient-to-br from-purple-900 to-slate-900 border border-purple-500/30 w-full max-w-sm rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.2)] overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg animate-bounce">
                                <DollarSign className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Tebrikler! 🎉</h3>
                            <p className="text-purple-200 text-sm mb-6">
                                Harika bir haber! Bu satışın tutarı nedir?
                            </p>

                            <div className="relative mb-6">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                                <input
                                    type="number"
                                    value={saleAmount}
                                    onChange={e => setSaleAmount(e.target.value)}
                                    className="w-full bg-black/40 border border-green-500/30 rounded-xl py-3 pl-10 pr-4 text-white text-xl font-bold text-center focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>

                            <button
                                onClick={handleReportSale}
                                disabled={isSubmittingSale || !saleAmount}
                                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSubmittingSale ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" /> Kaydediliyor...
                                    </span>
                                ) : (
                                    "✨ Satışı Bildir"
                                )}
                            </button>

                            <button
                                onClick={() => setShowSaleModal(false)}
                                disabled={isSubmittingSale}
                                className="mt-4 text-sm text-gray-400 hover:text-white underline-offset-4 hover:underline"
                            >
                                Vazgeç
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
