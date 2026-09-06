'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Info, CheckCircle } from 'lucide-react';

export type ToastType = 'error' | 'warning' | 'info' | 'success';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

export default function ErrorToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Simple event listener pattern to trigger toasts globally
    useEffect(() => {
        const handleToast = (event: Event) => {
            const { message, type = 'error' } = (event as CustomEvent<{ message: string; type?: ToastType }>).detail;
            const id = Math.random().toString(36).substring(2, 9);

            setToasts(prev => [...prev, { id, message, type }]);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 5000);
        };

        window.addEventListener('show-toast', handleToast);
        return () => window.removeEventListener('show-toast', handleToast);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'error': return <AlertTriangle className="w-5 h-5 ui-tone-danger" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 ui-tone-warning" />;
            case 'success': return <CheckCircle className="w-5 h-5 ui-tone-success" />;
            default: return <Info className="w-5 h-5 ui-tone-info" />;
        }
    };

    const getStyle = (type: ToastType) => {
        switch (type) {
            case 'error': return 'ui-status-danger';
            case 'warning': return 'ui-status-warning';
            case 'success': return 'ui-status-success';
            default: return 'ui-status-info';
        }
    };

    return (
        <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-3 pointer-events-none" aria-live="polite">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: -50, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.5 }}
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-md ${getStyle(toast.type)}`}
                    >
                        {getIcon(toast.type)}
                        <p className="flex-1 text-sm text-white font-medium">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none"
                            aria-label="Bildirimi kapat"
                        >
                            <X className="w-4 h-4 text-white/50" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// Helper funtion to trigger toast from anywhere
export const showToast = (message: string, type: ToastType = 'error') => {
    const event = new CustomEvent('show-toast', { detail: { message, type } });
    window.dispatchEvent(event);
};
