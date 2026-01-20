'use client';

import { Message } from '@/hooks/useRealtimeMessages';
import { formatDistanceToNow } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
    message: Message;
    isOwnMessage: boolean;
    currentUserId: string;
}

export default function MessageBubble({ message, isOwnMessage, currentUserId }: MessageBubbleProps) {
    const isBroadcast = message.message_type === 'broadcast';

    return (
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                {/* Sender name (only for other's messages) */}
                {!isOwnMessage && (
                    <div className="flex items-center gap-2 mb-1 px-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                            {message.sender?.full_name?.charAt(0) || '?'}
                        </div>
                        <span className="text-xs text-purple-200 font-medium">
                            {message.sender?.full_name || 'Unknown'}
                        </span>
                        {isBroadcast && (
                            <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full">
                                Duyuru
                            </span>
                        )}
                    </div>
                )}

                {/* Message bubble */}
                <div
                    className={`rounded-2xl px-4 py-2.5 ${isOwnMessage
                            ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white'
                            : isBroadcast
                                ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-100'
                                : 'bg-white/10 border border-white/20 text-white'
                        }`}
                >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                </div>

                {/* Timestamp and read status */}
                <div className="flex items-center gap-1.5 mt-1 px-2">
                    <span className="text-xs text-purple-300/60">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                    {isOwnMessage && (
                        <span className="text-purple-300/60">
                            {message.read_at ? (
                                <CheckCheck className="w-3 h-3 text-blue-400" />
                            ) : (
                                <Check className="w-3 h-3" />
                            )}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
