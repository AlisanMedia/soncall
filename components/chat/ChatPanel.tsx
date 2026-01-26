'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Sparkles, MoreVertical, Trash2, Download } from 'lucide-react';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { createClient } from '@/lib/supabase/client';

interface ChatPanelProps {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    leadId?: string;
    receiverId?: string; // For direct messages
    title?: string;
}

export default function ChatPanel({ userId, isOpen, onClose, leadId, receiverId, title }: ChatPanelProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { messages, loading, sendMessage, markAllAsRead, reload } = useRealtimeMessages({
        leadId,
        messageType: leadId ? 'lead_comment' : receiverId ? 'direct' : 'broadcast',
        userId
    });

    const [showMenu, setShowMenu] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const supabase = createClient();

    // Scroll to bottom logic
    const [isAtBottom, setIsAtBottom] = useState(true);

    const scrollToBottom = (instant = false) => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
                behavior: instant ? 'auto' : 'smooth',
                block: 'end'
            });
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 100; // Increased threshold
        setIsAtBottom(isBottom);
    };

    // Auto-scroll on new messages
    useEffect(() => {
        if (isAtBottom || messages.length > 0) {
            const timeoutId = setTimeout(() => {
                scrollToBottom(true);
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [messages, isOpen]);

    // Initial scroll when opening
    useEffect(() => {
        if (isOpen && !loading && messages.length > 0) {
            const timeoutId = setTimeout(() => {
                scrollToBottom(true);
            }, 150);
            return () => clearTimeout(timeoutId);
        }
    }, [isOpen, loading]);

    // Mark messages as read when panel is open
    useEffect(() => {
        if (isOpen) {
            markAllAsRead();
        }
    }, [isOpen]);

    const handleSend = async (message: string) => {
        await sendMessage(message, receiverId);
    };

    const handleBackupChat = () => {
        const chatData = JSON.stringify(messages, null, 2);
        const blob = new Blob([chatData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowMenu(false);
    };

    const handleResetChat = async () => {
        if (!confirm('Bu sohbeti tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;

        setIsResetting(true);
        try {
            const params = new URLSearchParams();
            if (leadId) params.append('leadId', leadId);
            if (receiverId) params.append('receiverId', receiverId);
            const type = leadId ? 'lead_comment' : receiverId ? 'direct' : 'broadcast';
            params.append('type', type);

            const res = await fetch(`/api/messages?${params.toString()}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Chat silinemedi');

            // Reload messages (should be empty now)
            reload();
            setShowMenu(false);
        } catch (error) {
            console.error('Reset failed', error);
            alert('Sohbet silinirken bir hata oluştu.');
        } finally {
            setIsResetting(false);
        }
    };

    // Check if current user is manager to show menu
    const [canManage, setCanManage] = useState(false);
    useEffect(() => {
        const checkRole = async () => {
            const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
            if (['manager', 'admin', 'founder'].includes(data?.role)) {
                setCanManage(true);
            }
        };
        if (isOpen) checkRole();
    }, [isOpen, userId]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-900/80 backdrop-blur-xl shadow-2xl z-50 flex flex-col border-l border-white/10">
            {/* Header */}
            <div className="bg-white/5 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between relative shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg border border-white/10">
                        <Sparkles className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white tracking-wide">{title || 'Messages'}</h3>
                        <p className="text-[10px] text-purple-300/60 uppercase tracking-wider font-medium">
                            {leadId ? 'Lead Chat' : receiverId ? 'Direct Message' : 'Team Broadcast'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {canManage && (
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-purple-200"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>

                            {showMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                    <button
                                        onClick={handleBackupChat}
                                        className="w-full px-4 py-3 text-left text-sm text-purple-200 hover:bg-white/5 flex items-center gap-2 transition-colors border-b border-white/5"
                                    >
                                        <Download className="w-4 h-4" />
                                        Yedekle (JSON)
                                    </button>
                                    <button
                                        onClick={handleResetChat}
                                        disabled={isResetting}
                                        className="w-full px-4 py-3 text-left text-sm text-red-300 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                    >
                                        {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        Sohbeti Temizle
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Messages */}

            <div
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                onScroll={handleScroll}
            >
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <img src="/loading-logo.png" alt="Loading" className="w-16 h-8 animate-pulse object-contain" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Sparkles className="w-12 h-12 text-purple-400/30 mb-2" />
                        <p className="text-purple-300/50">No messages yet</p>
                        <p className="text-xs text-purple-300/30 mt-1">Start a conversation!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => {
                            const isOwn = message.sender_id === userId;
                            const showAvatar = !isOwn && (index === 0 || messages[index - 1].sender_id !== message.sender_id);

                            // Date separator logic
                            const msgDate = new Date(message.created_at).toDateString();
                            const prevDate = index > 0 ? new Date(messages[index - 1].created_at).toDateString() : null;
                            const showDateSeparator = msgDate !== prevDate;

                            return (
                                <div key={message.id}>
                                    {showDateSeparator && (
                                        <div className="flex justify-center my-4">
                                            <span className="text-[10px] bg-white/5 text-white/40 px-2 py-1 rounded-full">
                                                {new Date(message.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                                            </span>
                                        </div>
                                    )}
                                    <MessageBubble
                                        message={message}
                                        isOwnMessage={isOwn}
                                        currentUserId={userId}
                                        showAvatar={showAvatar}
                                    />
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Scroll to bottom button */}
            {!isAtBottom && (
                <button
                    onClick={() => scrollToBottom()}
                    className="absolute bottom-20 right-4 p-2 bg-purple-600 rounded-full shadow-lg hover:bg-purple-700 transition-colors z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m6 9 6 6 6-6" /></svg>
                </button>
            )}

            {/* Input */}
            <MessageInput onSend={handleSend} currentUserId={userId} />
        </div>
    );
}
