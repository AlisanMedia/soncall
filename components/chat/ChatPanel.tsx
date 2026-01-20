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

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageCircle className="w-12 h-12 text-purple-400/30 mb-2" />
                        <p className="text-purple-300/50">No messages yet</p>
                        <p className="text-xs text-purple-300/30 mt-1">Start a conversation!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwnMessage={message.sender_id === userId}
                                currentUserId={userId}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <MessageInput onSend={handleSend} />
        </div>
    );
}
