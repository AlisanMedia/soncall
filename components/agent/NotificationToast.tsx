'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { playAchievement, playStreak, playEncouragement } from '@/lib/sounds';

interface NotificationToastProps {
    notification: {
        id: string;
        type: 'milestone' | 'streak' | 'encouragement' | 'achievement';
        message: string;
        icon: string;
        timestamp: string;
    };
    onClose: (id: string) => void;
}

export default function NotificationToast({ notification, onClose }: NotificationToastProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Show animation
        setIsVisible(true);

        // Play sound based on type
        switch (notification.type) {
            case 'milestone':
            case 'achievement':
                playAchievement();
                break;
            case 'streak':
                playStreak();
                break;
            case 'encouragement':
                playEncouragement();
                break;
        }

        // Auto dismiss
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onClose(notification.id), 300); // Wait for exit animation
        }, 5000);

        return () => clearTimeout(timer);
    }, [notification, onClose]);

    const getStyle = () => {
        switch (notification.type) {
            case 'milestone':
                return 'bg-gradient-to-r from-yellow-600 to-orange-600 border-yellow-400/50';
            case 'streak':
                return 'bg-gradient-to-r from-red-600 to-orange-600 border-red-400/50';
            case 'achievement':
                return 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400/50';
            case 'encouragement':
                return 'bg-gradient-to-r from-green-600 to-emerald-600 border-green-400/50';
            default:
                return 'bg-slate-800 border-white/20';
        }
    };

    return (
        <div
            className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                }`}
        >
            <div
                className={`flex items-start gap-4 p-4 rounded-xl shadow-2xl border backdrop-blur-md min-w-[320px] max-w-sm ${getStyle()}`}
            >
                <div className="text-3xl animate-bounce">
                    {notification.icon}
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-white text-lg mb-1 capitalize">
                        {notification.type === 'encouragement' ? 'Harikasın!' : notification.type}
                    </h3>
                    <p className="text-white/90 text-sm leading-snug">
                        {notification.message}
                    </p>
                </div>

                <button
                    onClick={() => {
                        setIsVisible(false);
                        setTimeout(() => onClose(notification.id), 300);
                    }}
                    className="text-white/60 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
