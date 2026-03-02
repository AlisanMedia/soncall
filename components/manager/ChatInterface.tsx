
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Send, Search, MessageSquare, Phone, User, CheckCheck, Clock, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { standardizePhone } from '@/lib/utils';

interface Contact {
    id: string;
    full_name: string;
    phone_number: string;
    title?: string;
    avatar_url?: string;
}

interface Message {
    id: string;
    contact_id?: string;
    sent_to: string; // Phone number
    recipient_name?: string;
    message_body: string;
    direction: 'inbound' | 'outbound';
    status: 'success' | 'failed' | 'pending';
    created_at: string;
}

export default function ChatInterface() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [messageText, setMessageText] = useState('');
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // AI Correction State
    const [isCorrecting, setIsCorrecting] = useState(false);
    const [suggestedText, setSuggestedText] = useState<string | null>(null);
    const [hasBeenChecked, setHasBeenChecked] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    // Fetch contacts on mount
    useEffect(() => {
        fetchContacts();
    }, []);

    // Use centralized standardizePhone instead of local normalization
    const normalizeForMatching = (phone: string) => standardizePhone(phone);

    // Fetch messages when contact selected
    useEffect(() => {
        if (selectedContact) {
            const normalizedPhone = normalizeForMatching(selectedContact.phone_number);
            fetchMessages(normalizedPhone);

            // Subscribe to new messages for this contact (Realtime)
            const channel = supabase
                .channel(`sms_chat_${normalizedPhone}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sms_logs',
                    filter: `sent_to=eq.${normalizedPhone}`
                }, (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages(prev => {
                        // Check for duplicates
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [newMsg, ...prev];
                    });
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [selectedContact]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchContacts = async () => {
        try {
            setLoadingContacts(true);
            const res = await fetch('/api/manager/contacts');
            const data = await res.json();
            if (data.contacts) {
                setContacts(data.contacts);
            }
        } catch (error) {
            console.error('Contacts error:', error);
        } finally {
            setLoadingContacts(false);
        }
    };

    const fetchMessages = async (normalizedPhone: string) => {
        try {
            setLoadingMessages(true);

            const { data, error } = await supabase
                .from('sms_logs')
                .select('*')
                .eq('sent_to', normalizedPhone)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            if (data) {
                setMessages(data);
            }
        } catch (error) {
            console.error('Messages error:', error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
        console.log('handleSendMessage triggered');
        if (e) e.preventDefault();
        const content = (overrideText || messageText).trim();
        if (!content || !selectedContact) {
            console.log('Missing content or selection', { content, selectedContact });
            return;
        }

        const normalizedPhone = normalizeForMatching(selectedContact.phone_number);
        console.log('Sending message to:', normalizedPhone);

        // Optimistic UI: Add the message to the list immediately
        const tempId = crypto.randomUUID();
        const tempMessage: Message = {
            id: tempId,
            sent_to: normalizedPhone,
            recipient_name: selectedContact.full_name,
            message_body: content,
            direction: 'outbound',
            status: 'pending',
            created_at: new Date().toISOString()
        };

        setMessages(prev => [tempMessage, ...prev]);
        setMessageText('');


        setSending(true);
        try {
            const res = await fetch('/api/manager/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: normalizedPhone,
                    message: content
                })
            });

            const data = await res.json();

            if (data.success) {
                // Update the status of the optimistic message
                setMessages(prev => prev.map(m =>
                    m.id === tempId ? { ...m, status: 'success', id: data.messageId || m.id } : m
                ));
            } else {
                // Mark as failed
                setMessages(prev => prev.map(m =>
                    m.id === tempId ? { ...m, status: 'failed' } : m
                ));
                toast.error('Mesaj gönderilemedi: ' + (data.message || data.error || 'Bilinmeyen hata'));
            }
        } catch (error) {
            setMessages(prev => prev.map(m =>
                m.id === tempId ? { ...m, status: 'failed' } : m
            ));
            toast.error('Gönderim hatası: Sistemsel bir sorun oluştu');
        } finally {
            setSending(false);
            setHasBeenChecked(false);
        }
    };

    const handleAICorrect = async () => {
        const text = messageText.trim();
        if (!text || isCorrecting) return null;

        setIsCorrecting(true);
        setSuggestedText(null);
        try {
            const res = await fetch('/api/manager/sms/correct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    contactName: selectedContact?.full_name
                })
            });
            const data = await res.json();
            if (data.message) {
                // Return the text directly instead of just setting suggestedText
                setHasBeenChecked(true);
                return data.message;
            } else {
                toast.error('Düzeltme hizmeti şu an yoğun, lütfen tekrar deneyin.');
                return null;
            }
        } catch (error) {
            toast.error('AI servisine erişilemedi');
            return null;
        } finally {
            setIsCorrecting(false);
        }
    };

    const applySuggestion = () => {
        if (suggestedText) {
            setMessageText(suggestedText);
            setSuggestedText(null);
        }
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();

            // Step 1: Handle correction if not checked
            if (!hasBeenChecked && messageText.trim()) {
                const corrected = await handleAICorrect();
                if (corrected) {
                    setMessageText(corrected);
                    // Don't send yet, wait for second Enter
                }
                return;
            }

            // Step 2: Second Enter (or already checked) -> Send
            handleSendMessage();
        }
    };

    const filteredContacts = contacts.filter(c =>
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    const [expandedMsgIds, setExpandedMsgIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedMsgIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Auto-sync every 15 seconds to simulate real-time
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isSyncing && !sending) {
                // Silent sync (don't show loader globally, maybe just small indicator or background)
                fetch('/api/manager/sms/sync', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.count > 0 && selectedContact) {
                            // Only refresh messages if we found new ones and have a contact open
                            fetchMessages(normalizeForMatching(selectedContact.phone_number));
                            toast.success(`${data.count} yeni mesaj geldi!`);
                        }
                    })
                    .catch(e => console.error('Auto-sync failed', e));
            }
        }, 30000); // Increased to 30 seconds to reduce load

        return () => clearInterval(interval);
    }, [selectedContact, isSyncing, sending]);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/manager/sms/sync', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success(`${data.count} yeni mesaj yüklendi.`);
                // Refresh contacts to see new messages indicator if implemented, or just re-fetch currently open chat
                if (selectedContact) {
                    fetchMessages(normalizeForMatching(selectedContact.phone_number));
                }
            } else {
                toast.error('Senkronizasyon başarısız: ' + (data.error || 'Daha sonra tekrar deneyin'));
            }
        } catch (e) {
            toast.error('Bağlantı hatası');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex bg-[#0f0f1a]/90 backdrop-blur-xl border border-purple-500/30 rounded-3xl shadow-[0_0_30px_rgba(147,51,234,0.3)] h-[700px] overflow-hidden relative transition-all duration-300 hover:shadow-[0_0_50px_rgba(147,51,234,0.4)] hover:border-purple-500/50">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

            {/* LEFT SIDEBAR: CONTACT LIST */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-black/20 backdrop-blur-sm z-10">
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-bold text-lg flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 font-mono text-[8px]">
                                MSG-V2
                            </div>
                            Mesajlar
                            <span className="text-[8px] text-gray-500 ml-2">v0.0.9</span>
                        </h2>
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={`p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all ${isSyncing ? 'animate-spin text-purple-500' : ''}`}
                            title="Mesajları Senkronize Et"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="relative group">
                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-purple-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Kişi Ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:bg-white/10 focus:border-purple-500/30 transition-all placeholder:text-gray-600"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                    {loadingContacts ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
                    ) : (
                        filteredContacts.map(contact => (
                            <div
                                key={contact.id}
                                onClick={() => setSelectedContact(contact)}
                                className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-200 ${selectedContact?.id === contact.id ? 'bg-purple-600/10 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'hover:bg-white/5 border border-transparent'}`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${selectedContact?.id === contact.id ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/30' : 'bg-gradient-to-br from-gray-700 to-gray-600'}`}>
                                    {contact.full_name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-semibold truncate ${selectedContact?.id === contact.id ? 'text-white' : 'text-gray-300'}`}>{contact.full_name}</div>
                                    <div className="text-xs text-gray-500 truncate mt-0.5">{contact.title || contact.phone_number}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT SIDE: CHAT AREA */}
            <div className="flex-1 flex flex-col relative z-0">
                {selectedContact ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-20 px-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02] backdrop-blur-sm sticky top-0 z-20">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                                    {selectedContact.full_name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-white text-lg">{selectedContact.full_name}</div>
                                    <div className="text-xs text-purple-300/80 flex items-center gap-1.5 font-medium tracking-wide">
                                        <Phone className="w-3 h-3" />
                                        {selectedContact.phone_number}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Messages List (Scrollable) */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar flex flex-col-reverse relative">
                            <div ref={messagesEndRef} />
                            {loadingMessages ? (
                                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-20">
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-500/50">
                                        <MessageSquare className="w-10 h-10" />
                                    </div>
                                    <p className="text-gray-400">Henüz mesaj yok. İlk mesajı gönderin! 👋</p>
                                </div>
                            ) : (
                                messages.map((msg, index) => {
                                    const isOutbound = msg.direction === 'outbound';
                                    const isSuccess = msg.status === 'success';
                                    const lines = msg.message_body?.split('\n').filter(Boolean) || [];
                                    const isExpanded = expandedMsgIds.has(msg.id);
                                    const hasMultipleLines = lines.length > 1;

                                    return (
                                        <div key={msg.id} className={`flex mb-6 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] group relative ${isOutbound ? 'items-end' : 'items-start'} flex flex-col`}>

                                                <div
                                                    onClick={() => hasMultipleLines && toggleExpand(msg.id)}
                                                    className={`px-6 py-4 rounded-3xl text-[15px] leading-relaxed shadow-lg backdrop-blur-sm border transition-all duration-300 hover:scale-[1.01] ${hasMultipleLines ? 'cursor-pointer' : ''} ${isOutbound
                                                        ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-none border-purple-500/30 shadow-[0_4px_20px_rgba(124,58,237,0.25)] hover:shadow-[0_8px_25px_rgba(124,58,237,0.4)]'
                                                        : 'bg-[#1e1e2d] text-gray-200 rounded-bl-none border-white/5 shadow-black/20 hover:bg-[#252535]'
                                                        }`}>
                                                    {hasMultipleLines && !isExpanded ? (
                                                        <div className="flex items-center justify-between gap-4">
                                                            <p className="font-light tracking-wide truncate">{lines[0]}</p>
                                                            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full shrink-0">Devamı...</span>
                                                        </div>
                                                    ) : (
                                                        <p className="whitespace-pre-wrap font-light tracking-wide">{msg.message_body}</p>
                                                    )}
                                                </div>

                                                <div className={`flex items-center gap-1.5 mt-2 px-1 text-[11px] font-medium opacity-60 ${isOutbound ? 'text-purple-200' : 'text-gray-500'}`}>
                                                    <span>{formatTime(msg.created_at)}</span>
                                                    {isOutbound && (
                                                        isSuccess
                                                            ? <CheckCheck className="w-3.5 h-3.5 text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]" />
                                                            : msg.status === 'failed'
                                                                ? <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                                                : <Clock className="w-3.5 h-3.5" />
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-6 border-t border-white/5 bg-[#12121e]/50 backdrop-blur-md z-20">
                            <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-4 items-center relative">
                                <div className="flex-1 relative group">
                                    {/* AI Suggestion UI removed per user request for "direct" correction */}
                                    <input
                                        type="text"
                                        placeholder="Bir şeyler yazın..."
                                        className="w-full bg-[#1a1a26] border border-white/10 rounded-2xl px-6 py-4 pr-16 text-white focus:outline-none focus:border-purple-500 focus:bg-[#1f1f2e] transition-all shadow-inner focus:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                                        value={messageText}
                                        onChange={(e) => {
                                            setMessageText(e.target.value);
                                            if (suggestedText) setSuggestedText(null);
                                            setHasBeenChecked(false);
                                        }}
                                        onKeyDown={handleKeyDown}
                                        disabled={sending}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAICorrect}
                                        disabled={!messageText.trim() || isCorrecting || sending}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 transition-all"
                                        title="AI ile Düzelt"
                                    >
                                        {isCorrecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={sending || !messageText.trim()}
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 bg-gradient-to-br from-purple-600 to-indigo-600 shadow-purple-600/30 hover:shadow-purple-600/50"
                                >
                                    {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                                </button>
                            </form>

                            <div className="text-center mt-3 text-[10px] text-gray-600">
                                <span>Enter: Gönder</span> • <span>Shift + Enter: Yeni Satır</span>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-900/5 pointer-events-none" />
                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-white/5">
                            <MessageSquare className="w-10 h-10 text-gray-500 opacity-50" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">Sohbet Başlatın</h3>
                        <p className="max-w-xs mx-auto text-gray-400 leading-relaxed">
                            Mesajlaşmak için soldaki listeden bir kişi seçin veya yeni bir kişi ekleyin.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
