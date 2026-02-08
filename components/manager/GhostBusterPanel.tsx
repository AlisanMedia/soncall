'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ghost, Phone, CalendarX, UserX, Clock, AlertTriangle } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';

interface GhostAppointment {
    id: string;
    business_name: string;
    phone_number: string;
    agent_name: string;
    appointment_date: string;
    time_since: string;
}

interface GhostBusterPanelProps {
    appointments: any[];
    onReassign: (id: string) => void;
    onReschedule: (id: string) => void;
}

export default function GhostBusterPanel({ appointments, onReassign, onReschedule }: GhostBusterPanelProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Filter "Ghost" appointments:
    // Defined as: Status is 'pending' AND Date was > 24 hours ago AND No call logs
    // (In this mockup we rely on 'call_status' === 'missed' from API)
    const ghosts = appointments.filter(apt => apt.call_status === 'missed');

    if (ghosts.length === 0) return null;

    return (
        <div className="mb-8">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-2xl overflow-hidden"
            >
                <div
                    className="p-4 flex items-center justify-between cursor-pointer bg-red-500/5 hover:bg-red-500/10 transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg animate-pulse">
                            <Ghost className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-200">Hayalet Avcısı (Ghostbuster)</h3>
                            <p className="text-red-300/70 text-sm">
                                {ghosts.length} randevu zamanı geçmiş ve aranmamış!
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-red-400 bg-red-950/50 px-2 py-1 rounded">
                            ACİL MÜDAHALE
                        </span>
                    </div>
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 space-y-3 bg-black/20">
                                {ghosts.map((apt, i) => (
                                    <motion.div
                                        key={apt.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/30 transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-lg font-bold text-red-200">
                                                {apt.business_name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-white">{apt.business_name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                    <span className="text-red-300">{apt.agent_name}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(apt.appointment_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button
                                                title="Başka Ajana Ata (Yakında)"
                                                className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white"
                                            >
                                                <UserX className="w-4 h-4" />
                                            </button>
                                            <button
                                                title="Yeniden Planla (Yakında)"
                                                className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white"
                                            >
                                                <CalendarX className="w-4 h-4" />
                                            </button>
                                            <a
                                                href={`tel:${apt.phone_number}`}
                                                title="Hemen Ara"
                                                className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30"
                                            >
                                                <Phone className="w-4 h-4" />
                                            </a>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
