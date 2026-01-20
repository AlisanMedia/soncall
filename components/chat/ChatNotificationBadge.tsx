'use client';

import { useEffect, useState } from 'react';

interface ChatNotificationBadgeProps {
    userId: string;
}

export default function ChatNotificationBadge({ userId }: ChatNotificationBadgeProps) {
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        loadUnreadCount();
        // Poll every 30 seconds
        const interval = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [userId]);

    const loadUnreadCount = async () => {
        try {
            const response = await fetch('/api/messages/unread');
            const data = await response.json();
            if (response.ok) {
                setUnreadCount(data.unread || 0);
            }
        } catch (err) {
            console.error('Failed to load unread count:', err);
        }
    };

    if (unreadCount === 0) return null;

    return (
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
        </div>
    );
}
