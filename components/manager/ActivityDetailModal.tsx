'use client';

import { X, Calendar, User, Phone, Building2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivityItem {
    id: string;
    action: string;
    created_at: string;
    agent_id: string;
    lead_id: string;
    note: string | null;
    action_taken: string | null;
    profiles: {
        full_name: string;
        avatar_url?: string;
    };
    leads: {
        business_name: string;
        phone_number: string;
        status: string;
        potential_level: string;
    };
}

interface ActivityDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    activity: ActivityItem | null;
}

export default function ActivityDetailModal({ isOpen, onClose, activity }: ActivityDetailModalProps) {
    if (!isOpen || !activity) return null;

    const getPotentialColor = (level: string) => {
        switch (level) {
            case 'high': return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            case 'low': return 'bg-red-500/20 text-red-300 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    };

    const getPotentialLabel = (level: string) => {
        switch (level) {
            case 'high': return 'Yüksek';
            case 'medium': return 'Orta';
            case 'low': return 'Düşük';
            default: return 'Değerlendirilmedi';
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#1a1a2e] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
                        <div className="flex items-center gap-4">
                            {activity.profiles.avatar_url ? (
                                <img
                                    src={activity.profiles.avatar_url}
                                    alt={activity.profiles.full_name}
                                    className="w-12 h-12 rounded-full object-cover border-2 border-purple-400/50"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg border-2 border-purple-400/50">
                                    {activity.profiles.full_name.charAt(0)}
                                </div>
                            )}
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {activity.profiles.full_name}
                                </h3>
                                <p className="text-purple-300 text-sm">
                                    Aktivite Detayı
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-6">
                        {/* Lead Info */}
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <h4 className="text-xs text-purple-300/70 uppercase mb-3 font-semibold tracking-wider">İlgili Müşteri / Lead</h4>
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-white font-semibold mb-1">
                                        <Building2 className="w-4 h-4 text-purple-400" />
                                        {activity.leads.business_name}
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                                        <Phone className="w-3 h-3" />
                                        {activity.leads.phone_number}
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded border ${getPotentialColor(activity.leads.potential_level)}`}>
                                    {getPotentialLabel(activity.leads.potential_level)}
                                </span>
                            </div>
                        </div>

                        {/* Activity Note */}
                        <div>
                            <h4 className="text-xs text-purple-300/70 uppercase mb-3 font-semibold tracking-wider flex items-center gap-2">
                                <MessageCircle className="w-3 h-3" />
                                Görüşme Notu & Aksiyon
                            </h4>
                            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
                                <div className="text-white leading-relaxed text-base">
                                    {activity.note ? (
                                        activity.note.split('\n').map((line, i) => (
                                            <p key={i} className="mb-2 last:mb-0">
                                                {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <strong key={j} className="font-bold text-purple-200">{part.slice(2, -2)}</strong>;
                                                    }
                                                    return part;
                                                })}
                                            </p>
                                        ))
                                    ) : (
                                        "Not girilmemiş."
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                    {activity.action_taken && (
                                        <span className="text-xs font-bold text-purple-300 bg-purple-500/20 px-2 py-1 rounded">
                                            {activity.action_taken}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(activity.created_at).toLocaleString('tr-TR')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-white/10 bg-black/20 text-right">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            Kapat
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
