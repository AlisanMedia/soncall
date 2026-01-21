'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Eye, Loader2, Calendar, Phone, Building2, X } from 'lucide-react';

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
        } finally {
            setLoading(false);
        }
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
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
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

            {/* Lead Detail Modal */}
            {selectedLead && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
                    <div className="bg-[#1a1a2e] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
                            <div>
                                <h3 className="text-xl font-bold text-white">{selectedLead.business_name}</h3>
                                <p className="text-purple-300 text-sm mt-1 flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    {selectedLead.phone_number}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLead(null)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
                            {/* Lead Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-xl">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Kategori</div>
                                    <div className="text-white">{selectedLead.category || '-'}</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Adres</div>
                                    <div className="text-white truncate">{selectedLead.address || '-'}</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Durum</div>
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getStatusColor(selectedLead.status)}`}>
                                        {getStatusLabel(selectedLead.status)}
                                    </span>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Potansiyel</div>
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPotentialColor(selectedLead.potential_level)}`}>
                                        {getPotentialLabel(selectedLead.potential_level)}
                                    </span>
                                </div>
                            </div>

                            {/* Notes History */}
                            <div>
                                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-purple-400" />
                                    Görüşme Notları
                                </h4>
                                <div className="space-y-3">
                                    {selectedLead.lead_notes && selectedLead.lead_notes.length > 0 ? (
                                        selectedLead.lead_notes.map((note, i) => (
                                            <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5">
                                                <p className="text-gray-300 text-sm mb-2 whitespace-pre-wrap">{note.note}</p>
                                                {note.action_taken && (
                                                    <p className="text-purple-400 text-xs mb-2">
                                                        Aksiyon: {note.action_taken}
                                                    </p>
                                                )}
                                                <div className="text-xs text-gray-500">
                                                    {new Date(note.created_at).toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-6 text-gray-500 italic text-sm bg-white/5 rounded-xl">
                                            Henüz not eklenmemiş.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/20 text-right">
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
        </div>
    );
}
