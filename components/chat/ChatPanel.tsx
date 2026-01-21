'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, MessageCircle } from 'lucide-react';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

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
    const { messages, loading, sendMessage, markAllAsRead } = useRealtimeMessages({
        leadId,
        messageType: leadId ? 'lead_comment' : receiverId ? 'direct' : 'broadcast',
        userId
    });

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
        // If we were at bottom, or if this is the initial load (messages just arrived)
        if (isAtBottom || messages.length > 0) {
            // Small timeout to ensure DOM is rendered
            const timeoutId = setTimeout(() => {
                scrollToBottom(true); // Instance scroll avoids "jumping" feel on load
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [messages, isOpen]); // Added isOpen dependency check

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 shadow-2xl z-50 flex flex-col border-l border-white/20">
            {/* Header */}
            <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-white">{title || 'Messages'}</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* Messages */}
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
                        <MessageCircle className="w-12 h-12 text-purple-400/30 mb-2" />
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
                    onClick={scrollToBottom}
                    className="absolute bottom-20 right-4 p-2 bg-purple-600 rounded-full shadow-lg hover:bg-purple-700 transition-colors z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m6 9 6 6 6-6" /></svg>
                </button>
            )}

            {/* Input */}
            <MessageInput onSend={handleSend} />
        </div>
    );
}
