import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { playActivityNotification } from '@/lib/sounds';

export interface Message {
    id: string;
    sender_id: string;
    receiver_id: string | null;
    lead_id: string | null;
    message: string;
    message_type: 'direct' | 'broadcast' | 'lead_comment';
    mentions: string[];
    read_at: string | null;
    created_at: string;
    sender?: {
        id: string;
        full_name: string;
        role: string;
        avatar_url?: string;
    };
    receiver?: {
        id: string;
        full_name: string;
        role: string;
        avatar_url?: string;
    };
}

interface UseRealtimeMessagesOptions {
    leadId?: string;
    messageType?: 'direct' | 'broadcast' | 'lead_comment';
    userId?: string;
}

export function useRealtimeMessages(options: UseRealtimeMessagesOptions = {}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    // Load initial messages
    const loadMessages = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (options.leadId) params.append('leadId', options.leadId);
            if (options.messageType) params.append('type', options.messageType);
            params.append('limit', '50');

            const response = await fetch(`/api/messages?${params.toString()}`);
            const data = await response.json();

            if (response.ok) {
                setMessages(data.messages.reverse()); // Reverse to show oldest first
            } else {
                setError(data.message || 'Failed to load messages');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load messages');
        } finally {
            setLoading(false);
        }
    }, [options.leadId, options.messageType]);

    useEffect(() => {
        loadMessages();
    }, [loadMessages]);

    // Set up real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('realtime-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                async (payload) => {
                    const newMessage = payload.new as Message;

                    // Filter based on options
                    if (options.leadId && newMessage.lead_id !== options.leadId) {
                        return;
                    }

                    if (options.messageType && newMessage.message_type !== options.messageType) {
                        return;
                    }

                    // 1. Fetch sender details with RETRY logic
                    // Sometimes realtime triggers before the profile is fully queryable
                    let senderProfile = null;
                    if (newMessage.sender_id) {
                        // Try up to 3 times to fetch the profile
                        for (let i = 0; i < 3; i++) {
                            const { data } = await supabase
                                .from('profiles')
                                .select('id, full_name, role, avatar_url')
                                .eq('id', newMessage.sender_id)
                                .single();

                            if (data) {
                                senderProfile = data;
                                break; // Found it!
                            }
                            // Wait 500ms before retrying
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }

                    // 2. Attach sender profile to message
                    if (senderProfile) {
                        newMessage.sender = senderProfile;
                    } else {
                        // Use a generic placeholder but FORCE role as 'agent' so "Duyuru" badge never shows
                        newMessage.sender = {
                            id: newMessage.sender_id,
                            full_name: '...', // Loading indicator instead of 'Unknown'
                            role: 'agent' // CRITICAL: identified as agent to hide Broadcast badge
                        };
                    }

                    // 3. Update State
                    setMessages((prev) => {
                        // Avoid duplicates
                        if (prev.some((m) => m.id === newMessage.id)) {
                            return prev;
                        }
                        return [...prev, newMessage];
                    });

                    // If profile was missing, try fetching one last time in background and update state again
                    if (!senderProfile && newMessage.sender_id) {
                        setTimeout(async () => {
                            const { data } = await supabase
                                .from('profiles')
                                .select('id, full_name, role, avatar_url')
                                .eq('id', newMessage.sender_id)
                                .single();

                            if (data) {
                                setMessages((currentMessages) =>
                                    currentMessages.map(msg =>
                                        msg.id === newMessage.id ? { ...msg, sender: data } : msg
                                    )
                                );
                            }
                        }, 2000);
                    }

                    // Play sound if message is for current user
                    if (options.userId && newMessage.sender_id !== options.userId) {
                        playActivityNotification();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [options.leadId, options.messageType, options.userId]);

    // Send message function
    const sendMessage = async (messageText: string, receiverId?: string) => {
        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageText,
                    receiverId,
                    leadId: options.leadId,
                    messageType: options.messageType || 'direct',
                    mentions: [] // TODO: Parse @mentions from messageText
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to send message');
            }

            // Immediately add to local state
            setMessages((prev) => [...prev, data.message]);

            return data.message;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    // Mark message as read
    const markAsRead = async (messageId: string) => {
        try {
            await fetch(`/api/messages/${messageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_read' }),
            });
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    // Mark all messages as read
    const markAllAsRead = async () => {
        try {
            await fetch('/api/messages', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_all_read' }),
            });
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    return {
        messages,
        loading,
        error,
        sendMessage,
        markAsRead,
        markAllAsRead,
        reload: loadMessages
    };
}
