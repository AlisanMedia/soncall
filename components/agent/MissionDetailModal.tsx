import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Phone, Clock, FileText,
    History, ArrowRight, Shield, Target, Zap
} from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';
import { GlowingEffect } from '@/components/ui/glowing-effect';

export interface MissionAppointment {
    id: string;
    lead_id?: string;
    agent_id?: string;
    appointment_date: string;
    status?: string;
    notes?: string | null;
    created_at?: string;
    business_name?: string | null;
    phone_number?: string | null;
    potential_level?: string | null;
    call_count?: number | null;
    last_call_at?: string | null;
    sdr_id?: string | null;
    closer_id?: string | null;
    meeting_url?: string | null;
    meeting_status?: string | null;
    task_type?: 'appointment' | 'callback';
    callback_at?: string | null;
    callback_reason?: string | null;
}

interface MissionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: MissionAppointment | null;
    onAction: (apt: MissionAppointment) => void;
}

export default function MissionDetailModal({ isOpen, onClose, appointment, onAction }: MissionDetailModalProps) {
    if (!appointment) return null;
    const isCallback = appointment.task_type === 'callback';

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div role="dialog" aria-modal="true" aria-labelledby="mission-detail-title" aria-describedby="mission-detail-date" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl pointer-events-auto">
                            <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} borderWidth={2} />

                            {/* Header */}
                            <div className="relative p-6 border-b border-white/10 bg-white/5">
                                <button
                                    onClick={onClose}
                                    type="button"
                                    aria-label="Görev detaylarını kapat"
                                    className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-300/70 sm:right-4 sm:top-4"
                                >
                                    <X className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </button>

                                <div className="pr-8">
                                    <h2 id="mission-detail-title" className="mb-1 flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
                                        <Target className="h-5 w-5 shrink-0 text-purple-400" aria-hidden="true" />
                                        {isCallback ? 'Tekrar Arama Detayı' : 'Görev Detayları'}
                                    </h2>
                                    <p id="mission-detail-date" className="text-sm text-gray-400">
                                        {new Date(appointment.appointment_date).toLocaleDateString('tr-TR', {
                                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="space-y-6 overflow-y-auto p-4 sm:p-6">
                                {/* Lead Info */}
                                <div className="space-y-4">
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                        <h3 className="text-lg font-bold text-white mb-2">{appointment.business_name}</h3>
                                        <div className="flex items-center gap-2 text-purple-200">
                                            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                                            <span className="font-mono">{appointment.phone_number}</span>
                                        </div>
                                        {appointment.meeting_url && !isCallback && (
                                            <a
                                                href={appointment.meeting_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                                            >
                                                Google Meet Linki
                                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                            </a>
                                        )}
                                        {appointment.potential_level === 'high' && (
                                            <div className="flex items-center gap-2 text-emerald-400 font-bold mt-2 text-sm">
                                                <Zap className="h-3 w-3 fill-emerald-400" aria-hidden="true" />
                                                <span>YÜKSEK POTANSİYEL</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Notes */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-gray-400 uppercase tracking-wider font-bold">
                                            <FileText className="h-4 w-4" aria-hidden="true" />
                                            İstihbarat Notları
                                        </div>
                                        <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-yellow-100/90 text-sm leading-relaxed">
                                            {isCallback && appointment.callback_reason
                                                ? appointment.callback_reason
                                                : appointment.notes || "Not bulunmuyor."}
                                        </div>
                                    </div>

                                    {/* History Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                            <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase mb-1">
                                                <History className="h-3 w-3" aria-hidden="true" />
                                                Arama Geçmişi
                                            </div>
                                            <div className="text-2xl font-bold text-white">
                                                {appointment.call_count || 0} <span className="text-sm font-normal text-gray-400">kez</span>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                            <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase mb-1">
                                                <Clock className="h-3 w-3" aria-hidden="true" />
                                                Son Temas
                                            </div>
                                            <div className="text-sm font-medium text-white mt-1">
                                                {appointment.last_call_at
                                                    ? new Date(appointment.last_call_at).toLocaleDateString('tr-TR')
                                                    : "Henüz Aranmadı"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-6">
                                <GlassButton
                                    onClick={() => onAction(appointment)}
                                    className="w-full h-14 text-lg font-bold group [&>.glass-button]:!bg-emerald-600 hover:[&>.glass-button]:!bg-emerald-500"
                                    contentClassName="flex items-center justify-center gap-3"
                                >
                                    <Shield className="h-5 w-5" aria-hidden="true" />
                                    <span>{isCallback ? 'LEADİ AÇ VE ARA' : 'OPERASYONU BAŞLAT'}</span>
                                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                                </GlassButton>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
