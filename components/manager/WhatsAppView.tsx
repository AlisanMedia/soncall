'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GlassButton } from '@/components/ui/glass-button';
import { Search, Send, Sparkles, Loader2, MessageCircle, User, Phone, CheckCircle2, AlertCircle } from 'lucide-react';
import { standardizePhone } from '@/lib/utils';

interface Lead {
    id: string;
    name: string;
    phone: string;
    category?: string;
    last_contact?: string;
}

export default function WhatsAppView() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [messageText, setMessageText] = useState('');
    const [isCorrecting, setIsCorrecting] = useState(false);
    const [sending, setSending] = useState(false);
    const [loadingLeads, setLoadingLeads] = useState(true);
    const [hasBeenChecked, setHasBeenChecked] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        setLoadingLeads(true);
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('id, name, phone, category, last_contact')
                .order('last_contact', { ascending: false })
                .limit(50);

            if (error) throw error;
            setLeads(data || []);
        } catch (error) {
            console.error('Error fetching leads:', error);
        } finally {
            setLoadingLeads(false);
        }
    };

    const handleAICorrect = async () => {
        if (!messageText.trim() || isCorrecting) return;

        setIsCorrecting(true);
        try {
            const response = await fetch('/api/manager/sms/correct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: messageText,
                    contactName: selectedLead?.name,
                }),
            });

            const data = await response.json();
            if (data.correctedText) {
                setMessageText(data.correctedText);
                setHasBeenChecked(true);
            }
        } catch (error) {
            console.error('AI Correction Error:', error);
        } finally {
            setIsCorrecting(false);
        }
    };

    const handleWhatsAppSend = async () => {
        if (!selectedLead || !messageText.trim() || sending) return;

        setSending(true);
        try {
            const cleanPhone = standardizePhone(selectedLead.phone);
            const encodedText = encodeURIComponent(messageText);
            const waUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

            // Open WhatsApp Web in new tab
            window.open(waUrl, '_blank', 'noreferrer');

            // Log to DB
            await supabase.from('sms_logs').insert({
                sent_to: cleanPhone,
                recipient_name: selectedLead.name,
                message_body: messageText,
                status: 'success',
                direction: 'outbound',
                trigger_type: 'whatsapp_commander',
                provider_response: 'Opened via WhatsApp Web Bridge'
            });

            // Update last contact
            await supabase.from('leads').update({
                last_contact: new Date().toISOString()
            }).eq('id', selectedLead.id);

        } catch (error) {
            console.error('WhatsApp Bridge Error:', error);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!hasBeenChecked) {
                handleAICorrect();
            } else {
                handleWhatsAppSend();
            }
        }
    };

    const filteredLeads = leads.filter(l =>
        l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.phone?.includes(searchTerm)
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left Column: Lead Selection */}
            <div className="lg:col-span-4 space-y-4">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/5">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-purple-400" />
                            Alıcı Seçin
                        </h2>
                        <div className="mt-4 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="İsim veya telefon..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        {loadingLeads ? (
                            <div className="p-10 flex justify-center">
                                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="p-10 text-center text-gray-500">
                                <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                <p>Lead bulunamadı.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {filteredLeads.map((lead) => (
                                    <button
                                        key={lead.id}
                                        onClick={() => setSelectedLead(lead)}
                                        className={`w-full p-4 flex items-center gap-3 transition-all hover:bg-white/5 text-left ${selectedLead?.id === lead.id ? 'bg-purple-500/20 border-r-4 border-purple-500' : ''
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center text-purple-300 font-bold border border-purple-500/30">
                                            {lead.name?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{lead.name}</p>
                                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                                <Phone className="w-2.4 h-2.4" />
                                                {lead.phone}
                                            </p>
                                        </div>
                                        {selectedLead?.id === lead.id && (
                                            <CheckCircle2 className="w-4 h-4 text-purple-400" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: AI Chat & WhatsApp Bridge */}
            <div className="lg:col-span-8">
                {selectedLead ? (
                    <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 h-full flex flex-col overflow-hidden shadow-2xl">
                        {/* Selected Contact Header */}
                        <div className="p-6 border-b border-white/10 bg-[#12121e]/80 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-purple-600/20">
                                    {selectedLead.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white leading-tight">{selectedLead.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-xs text-green-400 font-medium tracking-wide uppercase">WhatsApp’a Hazır</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Kategori</p>
                                <p className="text-sm text-purple-300 font-medium">{selectedLead.category || 'Genel Lead'}</p>
                            </div>
                        </div>

                        {/* Instruction Note */}
                        <div className="flex-1 p-8 flex flex-col justify-center items-center text-center space-y-6">
                            <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center">
                                <Sparkles className="w-10 h-10 text-purple-400" />
                            </div>
                            <div className="max-w-md">
                                <h4 className="text-xl font-bold text-white mb-2">AI Rewrite & WhatsApp Bridge</h4>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Mesajınızı yazın ve **Enter**'a basın. AI mesajınızı stratejik olarak düzeltecek,
                                    ikinci kez **Enter**'a bastığınızda otomatik olarak WhatsApp Web üzerinden gönderecektir.
                                </p>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-8 border-t border-white/5 bg-[#12121e]/50">
                            <div className="flex gap-4 items-center">
                                <div className="flex-1 relative">
                                    <textarea
                                        placeholder="Mesajınızı buraya yazın..."
                                        rows={3}
                                        value={messageText}
                                        onChange={(e) => {
                                            setMessageText(e.target.value);
                                            setHasBeenChecked(false);
                                        }}
                                        onKeyDown={handleKeyDown}
                                        className="w-full bg-[#1a1a26] border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-purple-500 transition-all resize-none shadow-inner"
                                    />
                                    <button
                                        onClick={handleAICorrect}
                                        disabled={!messageText.trim() || isCorrecting}
                                        className="absolute right-4 bottom-4 p-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 transition-all"
                                        title="AI Stratejisi Uygula"
                                    >
                                        {isCorrecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                    </button>
                                </div>

                                <button
                                    onClick={handleWhatsAppSend}
                                    disabled={!messageText.trim() || sending}
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                    title="WhatsApp ile Gönder"
                                >
                                    {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <MessageCircle className="w-6 h-6" />}
                                </button>
                            </div>
                            <div className="mt-4 flex justify-between items-center px-2">
                                <div className="flex gap-4 text-[11px] font-medium text-gray-500">
                                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> 1. Enter: AI Rewrite</span>
                                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 2. Enter: WhatsApp Send</span>
                                </div>
                                {hasBeenChecked && (
                                    <span className="text-[11px] text-purple-400 font-bold flex items-center gap-1 animate-pulse">
                                        <CheckCircle2 className="w-3 h-3" /> AI Stratejisi Hazır
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full bg-white/5 backdrop-blur-sm rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center p-12 text-center group">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                            <MessageCircle className="w-12 h-12 text-gray-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">WhatsApp Commander</h3>
                        <p className="text-gray-500 max-w-sm">
                            Sol taraftaki listeden bir lead seçerek stratejik WhatsApp iletişiminizi başlatabilirsiniz.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
