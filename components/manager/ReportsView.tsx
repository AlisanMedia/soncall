
'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Download, Loader2, Eye, FileText, Calendar, Clock, List, FileAudio, Play, Pause } from 'lucide-react';
import ScheduledReportsManager from './ScheduledReportsManager';

interface Lead {
    id: string;
    business_name: string;
    phone_number: string;
    address: string | null;
    category: string | null;
    status: string;
    potential_level: string;
    created_at: string;
    processed_at: string | null;
    assigned_to: string | null;
    profiles: {
        full_name: string;
    } | null;
    notes: Array<{
        note: string;
        action_taken: string | null;
        created_at: string;
        profiles: {
            full_name: string;
        };
    }>;
    latest_note: {
        note: string;
        created_at: string;
    } | null;
    call_logs?: Array<{
        id: string;
        audio_url: string;
        transcription?: string;
        summary?: string;
        created_at: string;
    }>;
}

interface ReportsViewProps {
    managerId?: string;
}

export default function ReportsView({ managerId }: ReportsViewProps) {
    const [activeTab, setActiveTab] = useState<'leads' | 'scheduled'>('leads');

    // Lead Report Stats
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [agentFilter, setAgentFilter] = useState('all');

    useEffect(() => {
        if (activeTab === 'leads') {
            loadLeads();
        }
    }, [statusFilter, agentFilter, activeTab]);

    const loadLeads = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (agentFilter !== 'all') params.append('agentId', agentFilter);

            const response = await fetch(`/api/manager/leads?${params.toString()}`);
            const data = await response.json();

            if (data.leads) {
                setLeads(data.leads);
            }
        } catch (error) {
            console.error('Error loading leads:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const headers = ['Business Name', 'Phone', 'Status', 'Agent', 'Processed At', 'Latest Note'];
        const csvContent = [
            headers.join(','),
            ...leads.map(lead => [
                `"${lead.business_name}"`,
                `"${lead.phone_number}"`,
                lead.status,
                `"${lead.profiles?.full_name || 'Unassigned'}"`,
                lead.processed_at || '',
                `"${lead.latest_note?.note?.replace(/"/g, '""') || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `leads_report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const filteredLeads = leads.filter(lead =>
        lead.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone_number.includes(searchTerm) ||
        lead.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                        Raporlar ve Analizler
                    </h2>
                    <p className="text-purple-300/60 text-sm mt-1">
                        Detaylı lead listeleri ve otomatik rapor yönetimi
                    </p>
                </div>

                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                    <button
                        onClick={() => setActiveTab('leads')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'leads'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-purple-300 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <List className="w-4 h-4" />
                        Lead Listesi
                    </button>
                    <button
                        onClick={() => setActiveTab('scheduled')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'scheduled'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-purple-300 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Clock className="w-4 h-4" />
                        Planlı Raporlar
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">

                {activeTab === 'scheduled' ? (
                    managerId ? (
                        <ScheduledReportsManager managerId={managerId} />
                    ) : (
                        <div className="text-center py-8 text-purple-300">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                            Yükleniyor...
                        </div>
                    )
                ) : (
                    /* Existing Lead List View */
                    <div className="space-y-6">
                        {/* Filters */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/50" />
                                <input
                                    type="text"
                                    placeholder="İşletme adı, telefon veya agent ara..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-purple-300/30 focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                            </div>

                            <div className="flex gap-2">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                                >
                                    <option value="all">Tüm Durumlar</option>
                                    <option value="appointment">Randevu Alındı</option>
                                    <option value="contacted">Ulaşıldı</option>
                                    <option value="not_interested">İlgilenmiyor</option>
                                    <option value="pending">Beklemede</option>
                                </select>

                                <button
                                    onClick={handleExport}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-xl border border-green-500/30 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Excel/CSV</span>
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-purple-300/60 text-sm">
                                        <th className="py-3 px-4 font-medium">İşletme</th>
                                        <th className="py-3 px-4 font-medium">Telefon</th>
                                        <th className="py-3 px-4 font-medium">Durum</th>
                                        <th className="py-3 px-4 font-medium">Agent</th>
                                        <th className="py-3 px-4 font-medium">Son İşlem</th>
                                        <th className="py-3 px-4 font-medium text-right">Detay</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-white/5">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-purple-300/50">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Veriler yükleniyor...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredLeads.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-purple-300/50">
                                                Kayıt bulunamadı.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLeads.map(lead => (
                                            <tr key={lead.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="py-3 px-4 text-white font-medium">{lead.business_name}</td>
                                                <td className="py-3 px-4 text-purple-200">{lead.phone_number}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${lead.status === 'appointment' ? 'bg-green-500/20 text-green-300' :
                                                        lead.status === 'contacted' ? 'bg-blue-500/20 text-blue-300' :
                                                            lead.status === 'not_interested' ? 'bg-red-500/20 text-red-300' :
                                                                'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                        {lead.status === 'appointment' ? 'Randevu' :
                                                            lead.status === 'contacted' ? 'Ulaşıldı' :
                                                                lead.status === 'not_interested' ? 'İlgilenmiyor' : 'Beklemede'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-purple-200">
                                                    {lead.profiles?.full_name || <span className="text-gray-500 italic">Atanmamış</span>}
                                                </td>
                                                <td className="py-3 px-4 text-gray-400">
                                                    {lead.processed_at ? new Date(lead.processed_at).toLocaleDateString('tr-TR') : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => setSelectedLead(lead)}
                                                        className="p-1 hover:bg-white/10 rounded text-purple-300 hover:text-white transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Lead Modal (Existing) */}
            {selectedLead && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
                    <div className="bg-[#1a1a2e] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/10 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-white">{selectedLead.business_name}</h3>
                                <p className="text-purple-300 text-sm mt-1">{selectedLead.phone_number}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${selectedLead.status === 'appointment' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                {selectedLead.status}
                            </span>
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
                            </div>

                            {/* Notes History */}
                            <div>
                                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-purple-400" />
                                    Görüşme Notları
                                </h4>
                                <div className="space-y-3">
                                    {selectedLead.notes && selectedLead.notes.length > 0 ? (
                                        selectedLead.notes.map((note, i) => (
                                            <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5">
                                                <p className="text-gray-300 text-sm mb-2">{note.note}</p>
                                                <div className="flex justify-between items-center text-xs text-gray-500">
                                                    <span>{note.profiles?.full_name}</span>
                                                    <span>{new Date(note.created_at).toLocaleString('tr-TR')}</span>
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

                        {/* Call Recordings */}
                        <div className="mt-6">
                            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                <FileAudio className="w-4 h-4 text-purple-400" />
                                Ses Kayıtları
                            </h4>
                            <div className="space-y-3">
                                {selectedLead.call_logs && selectedLead.call_logs.length > 0 ? (
                                    selectedLead.call_logs.map((log) => (
                                        <div key={log.id} className="bg-white/5 p-4 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs text-purple-300">
                                                    {new Date(log.created_at).toLocaleString('tr-TR')}
                                                </span>
                                            </div>
                                            <audio
                                                controls
                                                src={log.audio_url}
                                                className="w-full h-8 mb-2"
                                            />
                                            {log.summary && (
                                                <div className="text-xs text-gray-400 bg-black/20 p-2 rounded mt-2">
                                                    <strong className="text-purple-300 block mb-1">AI Özeti:</strong>
                                                    {log.summary}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-gray-500 italic text-sm bg-white/5 rounded-xl">
                                        Ses kaydı bulunmuyor.
                                    </div>
                                )}
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
            )
            }
        </div >
    );
}
