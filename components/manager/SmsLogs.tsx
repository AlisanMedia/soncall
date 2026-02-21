
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, MessageSquare, Search, Phone, CheckCircle2, XCircle, Clock, Plus, Sparkles, Send, X, Users, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';
import { SectionInfo } from '@/components/ui/section-info';
import { toast } from 'sonner';
import Contacts from './Contacts';
import ChatInterface from './ChatInterface';

interface SmsLog {
    id: string;
    sent_to: string;
    message_body: string;
    status: 'success' | 'failed' | 'pending';
    provider_response: string | null;
    trigger_type: string | null;
    created_at: string;
    lead_id: string | null;
    recipient_name: string | null;
}

interface Agent {
    id: string;
    full_name: string;
    phone_number: string | null;
}

export default function SmsLogs() {
    // Tabs State
    const [activeTab, setActiveTab] = useState<'logs' | 'chat' | 'contacts'>('logs');

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-fit">
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'logs' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Clock className="w-4 h-4" />
                    SMS Geçmişi
                </button>
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <MessageCircle className="w-4 h-4" />
                    Sohbet
                </button>
                <button
                    onClick={() => setActiveTab('contacts')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'contacts' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Users className="w-4 h-4" />
                    Kişiler
                </button>
            </div>

            {/* Content Area */}
            <div className={`animate-in fade-in duration-300 ${activeTab === 'logs' ? 'block' : 'hidden'}`}>
                <LogsContent />
            </div>

            <div className={`animate-in fade-in duration-300 ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
                {activeTab === 'chat' && <ChatInterface />}
            </div>

            <div className={`animate-in fade-in duration-300 ${activeTab === 'contacts' ? 'block' : 'hidden'}`}>
                {activeTab === 'contacts' && <Contacts />}
            </div>
        </div>
    );
}

// Sub-component for existing Logs functionality
function LogsContent() {
    const [logs, setLogs] = useState<SmsLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 50;
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Send Message Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiContext, setAiContext] = useState('');

    const supabase = createClient();

    useEffect(() => {
        fetchLogs(0, true);
    }, [searchTerm]);

    useEffect(() => {
        if (isModalOpen && agents.length === 0) {
            fetchAgents();
        }
    }, [isModalOpen]);

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/manager/team/list-all');
            const data = await res.json();
            if (data.agents) {
                const validAgents = data.agents.filter((a: Agent) => a.phone_number && a.phone_number.length > 5);
                setAgents(validAgents);
            }
        } catch (error) {
            console.error('Error fetching agents:', error);
            toast.error('Personel listesi yüklenirken hata oluştu');
        }
    };

    const fetchLogs = async (offset: number, reset: boolean = false) => {
        try {
            if (reset) {
                setLoading(true);
            }

            let query = supabase
                .from('sms_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .range(offset, offset + LIMIT - 1);

            if (searchTerm) {
                query = query.or(`sent_to.ilike.%${searchTerm}%,message_body.ilike.%${searchTerm}%,recipient_name.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('SMS Logs error:', error);
                toast.error('Loglar yüklenirken hata oluştu: ' + error.message);
                return;
            }

            if (data) {
                if (reset) {
                    setLogs(data);
                } else {
                    setLogs(prev => [...prev, ...data]);
                }

                if (data.length < LIMIT) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchLogs(nextPage * LIMIT);
    };

    const toggleAgentSelection = (agentId: string) => {
        setSelectedAgentIds(prev =>
            prev.includes(agentId)
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedAgentIds.length === agents.length) {
            setSelectedAgentIds([]);
        } else {
            setSelectedAgentIds(agents.map(a => a.id));
        }
    };

    const handleGenerateAi = async () => {
        if (selectedAgentIds.length === 0) {
            toast.warning('Lütfen en az bir personel seçin');
            return;
        }

        const agent = agents.find(a => a.id === selectedAgentIds[0]);
        const nameContext = selectedAgentIds.length > 1 ? 'Takım' : agent?.full_name || 'Personel';

        setIsGenerating(true);
        try {
            const res = await fetch('/api/manager/sms/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentName: nameContext,
                    context: aiContext || 'Günlük motivasyon'
                })
            });
            const data = await res.json();

            if (data.message) {
                setMessageText(data.message);
                toast.success('Mesaj oluşturuldu ✨');
            } else {
                toast.error('Mesaj oluşturulamadı');
            }
        } catch (error) {
            console.error(error);
            toast.error('AI servisine erişilemedi');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSend = async () => {
        if (selectedAgentIds.length === 0 || !messageText) {
            toast.warning('Lütfen personel seçin ve mesaj yazın');
            return;
        }

        const recipients = agents
            .filter(a => selectedAgentIds.includes(a.id))
            .map(a => ({
                phone: a.phone_number,
                name: a.full_name
            }))
            .filter(r => r.phone);

        if (recipients.length === 0) {
            toast.error('Seçilen personellerin geçerli telefon numarası yok');
            return;
        }

        setIsSending(true);
        try {
            const res = await fetch('/api/manager/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients: recipients,
                    message: messageText
                })
            });

            const data = await res.json();

            if (data.success) {
                toast.success(`${data.stats.sent} mesaj başarıyla gönderildi`);
                setIsModalOpen(false);
                setMessageText('');
                setAiContext('');
                setSelectedAgentIds([]);
                setTimeout(() => fetchLogs(0, true), 1000);
            } else {
                toast.error('Gönderim hatası: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (error) {
            console.error(error);
            toast.error('Gönderim sırasında hata oluştu');
        } finally {
            setIsSending(false);
        }
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusIcon = (status: string) => {
        if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-400" />;
        if (status === 'failed') return <XCircle className="w-4 h-4 text-red-400" />;
        return <Clock className="w-4 h-4 text-yellow-400" />;
    };

    return (
        <div className="space-y-6 relative">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-purple-400" />
                        <h2 className="text-xl font-bold text-white">SMS Geçmişi</h2>
                        <SectionInfo text="Tüm SMS kayıtlarını inceleyin veya yeni mesaj gönderin." />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative hidden md:block">
                            <Search className="w-4 h-4 text-purple-300 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Tel, İsim veya Mesaj Ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-black/20 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/50 w-64 transition-all"
                            />
                        </div>

                        <GlassButton onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600/50 hover:bg-purple-600/70 text-white">
                            <Plus className="w-4 h-4" />
                            Yeni Mesaj
                        </GlassButton>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-purple-100">
                        <thead className="text-xs uppercase bg-white/5 text-purple-200">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">Durum</th>
                                <th className="px-4 py-3">Tarih</th>
                                <th className="px-4 py-3">Alıcı / Telefon</th>
                                <th className="px-4 py-3">Mesaj</th>
                                <th className="px-4 py-3 rounded-tr-lg">Tip</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-purple-300">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-purple-300">
                                        Kayıt bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => {
                                    const isExpanded = expandedLogId === log.id;
                                    const lines = log.message_body?.split('\n').filter(Boolean) || [];
                                    const title = lines[0] || log.message_body || '-';
                                    const hasMore = lines.length > 1;

                                    return (
                                        <tr
                                            key={log.id}
                                            className={`hover:bg-white/5 transition-colors ${hasMore ? 'cursor-pointer' : ''}`}
                                            onClick={() => hasMore && setExpandedLogId(isExpanded ? null : log.id)}
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(log.status)}
                                                    <span className={`capitalize ${log.status === 'success' ? 'text-green-300' :
                                                        log.status === 'failed' ? 'text-red-300' : 'text-yellow-300'
                                                        }`}>
                                                        {log.status === 'success' ? 'Başarılı' :
                                                            log.status === 'failed' ? 'Hata' : 'Beklemede'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-purple-300 font-mono text-xs">
                                                {formatTime(log.created_at)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-medium text-sm">{log.recipient_name || '-'}</span>
                                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                                        <Phone className="w-3 h-3" />
                                                        <span>{log.sent_to}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 max-w-md">
                                                <div className="flex items-start gap-2">
                                                    <div className="flex-1">
                                                        <p className="text-white text-sm font-medium">{title}</p>
                                                        {isExpanded && hasMore && (
                                                            <p className="text-gray-400 text-sm mt-2 whitespace-pre-line border-t border-white/10 pt-2">
                                                                {lines.slice(1).join('\n')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {hasMore && (
                                                        <span className="text-purple-400 mt-0.5 shrink-0">
                                                            {isExpanded
                                                                ? <ChevronUp className="w-4 h-4" />
                                                                : <ChevronDown className="w-4 h-4" />}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {(() => {
                                                    const type = log.trigger_type || 'system';
                                                    const colors: Record<string, string> = {
                                                        sales: 'bg-green-500/10 text-green-300 border-green-500/20',
                                                        motivation: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
                                                        manual: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
                                                        bulk: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
                                                        system: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
                                                        '5h_reminder': 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
                                                        '1h_reminder': 'bg-red-500/10 text-red-300 border-red-500/20'
                                                    };
                                                    const colorClass = colors[type] || colors.system;
                                                    return (
                                                        <span className={`${colorClass} px-2 py-0.5 rounded text-xs border capitalize`}>
                                                            {type.replace('_', ' ')}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {hasMore && !loading && logs.length > 0 && (
                    <div className="mt-4 text-center">
                        <GlassButton onClick={loadMore} className="text-xs px-4 py-2">
                            Daha Fazla Yükle
                        </GlassButton>
                    </div>
                )}
            </div>

            {/* SEND MESSAGE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 z-10 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-6 pb-2 shrink-0">
                            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-purple-400" />
                                Toplu SMS Gönder
                            </h3>
                            <p className="text-sm text-gray-400">Birden fazla personel seçip mesaj gönderebilirsiniz.</p>
                        </div>

                        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-5">
                            {/* Agent Selector */}
                            <div className="space-y-2">
                                <label className="flex items-center justify-between text-sm font-medium text-gray-300">
                                    <span>Alıcı Listesi ({selectedAgentIds.length} Seçili)</span>
                                    <button
                                        onClick={toggleSelectAll}
                                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        {selectedAgentIds.length === agents.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                                    </button>
                                </label>

                                <div className="bg-black/30 border border-white/10 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                    {agents.map(agent => (
                                        <label
                                            key={agent.id}
                                            className="flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer transition-colors group"
                                            onClick={() => toggleAgentSelection(agent.id)}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedAgentIds.includes(agent.id)
                                                ? 'bg-purple-600 border-purple-600'
                                                : 'border-gray-500 group-hover:border-gray-400'
                                                }`}>
                                                {selectedAgentIds.includes(agent.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm text-gray-200">{agent.full_name}</div>
                                                <div className="text-xs text-gray-500">{agent.phone_number}</div>
                                            </div>
                                        </label>
                                    ))}
                                    {agents.length === 0 && (
                                        <div className="text-center py-4 text-xs text-gray-500">
                                            Listelenecek uygun personel bulunamadı.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* AI Context Input */}
                            <div>
                                <label className="block text-sm font-medium text-purple-300 mb-1.5 flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    AI İpucu (Opsiyonel)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Örn: Hafta sonu satışı için tebrik et"
                                        className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
                                        value={aiContext}
                                        onChange={(e) => setAiContext(e.target.value)}
                                    />
                                    <button
                                        onClick={handleGenerateAi}
                                        disabled={isGenerating || selectedAgentIds.length === 0}
                                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
                                    >
                                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        Oluştur
                                    </button>
                                </div>
                            </div>

                            {/* Message Body */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">Mesaj İçeriği</label>
                                <textarea
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 min-h-[120px] resize-none text-sm leading-relaxed"
                                    placeholder="Mesajınızı buraya yazın..."
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                />
                                <div className="text-right text-xs text-gray-500 mt-1">
                                    {messageText.length} / 160 karakter
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 pt-2 shrink-0 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={isSending || !messageText || selectedAgentIds.length === 0}
                                className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                            >
                                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {selectedAgentIds.length > 1 ? `${selectedAgentIds.length} Kişiye Gönder` : 'Gönder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
