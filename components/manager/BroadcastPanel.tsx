'use client';

import { useState } from 'react';
import { Send, Loader2, X } from 'lucide-react';

interface BroadcastPanelProps {
    managerId: string;
    onClose?: () => void;
}

export default function BroadcastPanel({ managerId, onClose }: BroadcastPanelProps) {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSend = async () => {
        if (!message.trim() || sending) return;

        setSending(true);
        setSuccess(false);

        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message.trim(),
                    messageType: 'broadcast',
                    mentions: []
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to send broadcast');
            }

            setMessage('');
            setSuccess(true);

            // Auto-close after success
            setTimeout(() => {
                onClose?.();
            }, 2000);

        } catch (err) {
            console.error('Broadcast error:', err);
            alert('Failed to send broadcast message');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    📢 Broadcast Message
                </h3>
                <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-full">
                        All Agents
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your announcement here..."
                rows={5}
                disabled={sending}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none disabled:opacity-50"
            />

            <div className="flex items-center justify-between">
                <p className="text-xs text-purple-300/70">
                    This message will be sent to all active agents
                </p>
                <button
                    onClick={handleSend}
                    disabled={!message.trim() || sending}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {sending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                        </>
                    ) : success ? (
                        <>
                            ✓ Sent!
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            Send Broadcast
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
