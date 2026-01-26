'use client';

import { motion } from 'framer-motion';
import { Calendar, ExternalLink, Sparkles, Phone, Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SmartActionButton {
    type: 'whatsapp' | 'calendar' | 'call' | 'copy';
    label: string;
    data: string;
    icon?: React.ReactNode;
}

interface SmartActionsProps {
    analysis: {
        suggested_action?: string | null;
        extracted_date?: string | null;
        customer_name?: string | null;
    };
    leadPhone?: string;
    className?: string;
}

export default function SmartActions({ analysis, leadPhone, className = '' }: SmartActionsProps) {
    const [copiedAction, setCopiedAction] = useState(false);

    const actions: SmartActionButton[] = [];

    // WhatsApp button if suggested in action
    if (analysis.suggested_action?.toLowerCase().includes('whatsapp') && leadPhone) {
        actions.push({
            type: 'whatsapp',
            label: 'WhatsApp Gönder',
            data: leadPhone,
            icon: <Sparkles className="w-4 h-4" />
        });
    }

    // Calendar button if date extracted
    if (analysis.extracted_date) {
        actions.push({
            type: 'calendar',
            label: 'Takvime Ekle',
            data: analysis.extracted_date,
            icon: <Calendar className="w-4 h-4" />
        });
    }

    // Call button if phone available
    if (leadPhone) {
        actions.push({
            type: 'call',
            label: 'Hemen Ara',
            data: leadPhone,
            icon: <Phone className="w-4 h-4" />
        });
    }

    // Copy action button
    if (analysis.suggested_action) {
        actions.push({
            type: 'copy',
            label: copiedAction ? 'Kopyalandı' : 'Aksiyonu Kopyala',
            data: analysis.suggested_action,
            icon: copiedAction ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />
        });
    }

    if (actions.length === 0) return null;

    const handleAction = async (action: SmartActionButton) => {
        switch (action.type) {
            case 'whatsapp':
                const message = encodeURIComponent(
                    `Merhaba${analysis.customer_name ? ` ${analysis.customer_name}` : ''}, ArtificAgent hakkında görüştüğümüz konuyla ilgili bilgi paylaşmak istedim.`
                );
                window.open(`https://wa.me/${action.data.replace(/\D/g, '')}?text=${message}`, '_blank');
                toast.success('WhatsApp açıldı');
                break;

            case 'calendar':
                try {
                    const date = new Date(action.data);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');

                    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=ArtificAgent%20Takip%20Görüşmesi${analysis.customer_name ? `%20-%20${encodeURIComponent(analysis.customer_name)}` : ''
                        }&dates=${year}${month}${day}T${hours}${minutes}00/${year}${month}${day}T${hours}${minutes}00&details=${analysis.suggested_action ? encodeURIComponent(analysis.suggested_action) : ''
                        }`;

                    window.open(calendarUrl, '_blank');
                    toast.success('Google Calendar açıldı');
                } catch (e) {
                    toast.error('Tarih formatı hatalı');
                }
                break;

            case 'call':
                window.location.href = `tel:${action.data}`;
                break;

            case 'copy':
                await navigator.clipboard.writeText(action.data);
                setCopiedAction(true);
                toast.success('Aksiyon kopyalandı');
                setTimeout(() => setCopiedAction(false), 2000);
                break;
        }
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">⚡ Hızlı Aksiyonlar</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {actions.map((action, index) => (
                    <motion.button
                        key={index}
                        onClick={() => handleAction(action)}
                        className={`
                            flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
                            text-xs font-medium transition-all
                            ${action.type === 'whatsapp'
                                ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 text-green-300 hover:from-green-500/20 hover:to-emerald-500/20'
                                : action.type === 'calendar'
                                    ? 'bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30 text-purple-300 hover:from-purple-500/20 hover:to-indigo-500/20'
                                    : action.type === 'call'
                                        ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 text-blue-300 hover:from-blue-500/20 hover:to-cyan-500/20'
                                        : 'bg-gradient-to-r from-gray-500/10 to-slate-500/10 border border-gray-500/30 text-gray-300 hover:from-gray-500/20 hover:to-slate-500/20'
                            }
                        `}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {action.icon}
                        {action.label}
                    </motion.button>
                ))}
            </div>
        </div>
    );
}
