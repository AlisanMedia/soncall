'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Clock, Phone, MapPin, AlertTriangle,
    CheckCircle2, XCircle, ChevronRight, Target,
    Zap, Rocket, Shield, Timer
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GlassButton } from '@/components/ui/glass-button';
import { GlowingEffect } from '@/components/ui/glowing-effect';

import MissionDetailModal from './MissionDetailModal';

interface Appointment {
    id: string;
    business_name: string;
    phone_number: string;
    appointment_date: string; // ISO string
    potential_level: 'high' | 'medium' | 'low';
    notes: string;
    status: 'won' | 'interviewed' | 'attempted' | 'missed' | 'pending';
    urgencyScore: number;
    last_call_at: string | null;
    call_count?: number;
}

interface AgentScheduleProps {
    agentId: string;
}

export default function AgentSchedule({ agentId }: AgentScheduleProps) {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [nextMission, setNextMission] = useState<Appointment | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'warning' | 'critical'>('normal');
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const router = useRouter();

    useEffect(() => {
        fetchAppointments();
        const interval = setInterval(fetchAppointments, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [agentId]);

    useEffect(() => {
        if (!nextMission) return;

        const timer = setInterval(() => {
            const now = new Date();
            const target = new Date(nextMission.appointment_date);
            const diff = target.getTime() - now.getTime();

            if (diff < 0) {
                // Mission Overdue
                setTimeLeft('GÖREV ZAMANI GEÇTİ');
                setUrgencyLevel('critical');
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

                if (diff < 15 * 60 * 1000) { // < 15 mins
                    setUrgencyLevel('critical');
                } else if (diff < 60 * 60 * 1000) { // < 1 hour
                    setUrgencyLevel('warning');
                } else {
                    setUrgencyLevel('normal');
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [nextMission]);

    const fetchAppointments = async () => {
        try {
            const res = await fetch('/api/agent/appointments');
            const data = await res.json();
            if (data.success) {
                setAppointments(data.appointments);

                // Find next mission: 
                // Priorities:
                // 1. Missed (Overdue)
                // 2. Pending (Upcoming)
                // Exclude 'won' and 'interviewed' (assuming interviewed means done for the moment unless user actively revisits)
                // Actually, backend sorts by urgencyScore where missed is top priority.
                const actionable = data.appointments.filter((a: Appointment) =>
                    a.status === 'missed' || a.status === 'pending' || a.status === 'attempted'
                );

                setNextMission(actionable[0] || null);
            }
        } catch (error) {
            console.error('Failed to load schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLockAndLoad = (appointment: Appointment) => {
        localStorage.setItem(`agent_${agentId}_current_lead`, appointment.id);
        window.location.reload();
    };

    const openMissionDetail = (apt: Appointment) => {
        setSelectedApt(apt);
        setIsModalOpen(true);
    };

    if (loading) return <div className="p-8 text-center text-purple-300 animate-pulse">Operasyon verileri yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* HERO MISSION CARD */}
            {nextMission ? (
                <div className={`relative overflow-hidden rounded-2xl border-2 p-6 transition-all duration-500 ${urgencyLevel === 'critical' || nextMission.status === 'missed' ? 'bg-red-950/40 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' :
                    urgencyLevel === 'warning' ? 'bg-amber-950/40 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' :
                        'bg-emerald-950/40 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                    }`}>
                    <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} borderWidth={3} />

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        {/* Timer Section */}
                        <div className="text-center md:text-left">
                            <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
                                <Target className={`w-5 h-5 ${urgencyLevel === 'critical' || nextMission.status === 'missed' ? 'text-red-400 animate-pulse' :
                                    urgencyLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400'
                                    }`} />
                                <span className={`text-sm font-bold tracking-widest uppercase ${urgencyLevel === 'critical' || nextMission.status === 'missed' ? 'text-red-400' :
                                    urgencyLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400'
                                    }`}>
                                    {nextMission.status === 'missed' ? '🚨 KRİTİK: GECİKMİŞ GÖREV' : 'SIRADAKİ HEDEF'}
                                </span>
                            </div>
                            <div className="text-5xl md:text-6xl font-black font-mono tracking-tighter text-white tabular-nums">
                                {nextMission.status === 'missed' ? 'GECİKTİ' : timeLeft}
                            </div>
                            <div className="text-sm text-purple-200 mt-2 font-medium">
                                Operasyon Saati: {new Date(nextMission.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>

                        {/* Mission Details */}
                        <div
                            onClick={() => openMissionDetail(nextMission)}
                            className="flex-1 bg-black/40 rounded-xl p-4 border border-white/10 backdrop-blur-sm w-full md:w-auto cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <h3 className="text-2xl font-bold text-white mb-2">{nextMission.business_name}</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-purple-200">
                                    <Phone className="w-4 h-4" />
                                    <span>{nextMission.phone_number}</span>
                                </div>
                                {nextMission.potential_level === 'high' && (
                                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                        <Zap className="w-4 h-4 fill-emerald-400" />
                                        <span>YÜKSEK POTANSİYEL</span>
                                    </div>
                                )}
                                <div className="text-xs text-purple-300 mt-2 p-2 bg-white/5 rounded border border-white/5 line-clamp-2">
                                    📝 "{nextMission.notes}"
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="w-full md:w-auto">
                            <GlassButton
                                onClick={() => handleLockAndLoad(nextMission)}
                                className={`w-full md:w-auto min-w-[200px] h-16 text-lg font-bold group ${urgencyLevel === 'critical' || nextMission.status === 'missed' ? '[&>.glass-button]:!bg-red-600 hover:[&>.glass-button]:!bg-red-500' :
                                    urgencyLevel === 'warning' ? '[&>.glass-button]:!bg-amber-600 hover:[&>.glass-button]:!bg-amber-500' :
                                        '[&>.glass-button]:!bg-emerald-600 hover:[&>.glass-button]:!bg-emerald-500'
                                    }`}
                                contentClassName="flex items-center justify-center gap-3"
                            >
                                <Rocket className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                <span>HEDEFE KİLİTLEN & ARA</span>
                            </GlassButton>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                    <Shield className="w-16 h-16 text-emerald-500/50 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white">Tüm Görevler Tamamlandı</h3>
                    <p className="text-purple-300 mt-2">Bölge temiz. Yeni emirler bekleniyor.</p>
                </div>
            )}

            {/* TIMELINE */}
            <div className="grid gap-4 mt-8">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-400" />
                    Görev Günlüğü
                </h3>

                <div className="space-y-3">
                    {appointments.map((apt, index) => (
                        <motion.div
                            key={apt.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => openMissionDetail(apt)}
                            className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${apt.status === 'won' ? 'bg-green-500/10 border-green-500/30' :
                                apt.status === 'missed' ? 'bg-red-500/10 border-red-500/30' :
                                    apt.status === 'interviewed' ? 'bg-blue-500/10 border-blue-500/30' :
                                        apt.id === nextMission?.id ? 'bg-purple-500/20 border-purple-500/50 ring-1 ring-purple-500/50' :
                                            'bg-white/5 border-white/10 hover:bg-white/10'
                                }`}
                        >
                            {/* Time Column */}
                            <div className="flex flex-col items-center min-w-[60px]">
                                <span className={`text-lg font-bold ${apt.status === 'missed' ? 'text-red-400' : 'text-white'}`}>
                                    {new Date(apt.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className={`text-[10px] uppercase font-bold tracking-wider ${apt.status === 'won' ? 'text-green-400' :
                                    apt.status === 'interviewed' ? 'text-blue-400' :
                                        apt.status === 'missed' ? 'text-red-400' : 'text-purple-300'
                                    }`}>
                                    {apt.status === 'won' ? 'SATIŞ' :
                                        apt.status === 'interviewed' ? 'GÖRÜŞÜLDÜ' :
                                            apt.status === 'missed' ? 'BAŞARISIZ' : 'BEKLİYOR'}
                                </span>
                            </div>

                            {/* Divider Line */}
                            <div className={`w-1 self-stretch rounded-full ${apt.status === 'won' ? 'bg-green-500' :
                                apt.status === 'interviewed' ? 'bg-blue-500' :
                                    apt.status === 'missed' ? 'bg-red-500' :
                                        'bg-white/10'
                                }`} />

                            {/* Content */}
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h4 className={`text-lg font-semibold ${apt.status === 'missed' ? 'text-zinc-500 line-through' : 'text-white'}`}>
                                        {apt.business_name}
                                    </h4>
                                    {apt.potential_level === 'high' && (
                                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-[10px] rounded border border-yellow-500/30 font-bold">
                                            VIP
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-purple-300/60 line-clamp-1">{apt.notes}</p>
                            </div>

                            {/* Status Icon */}
                            <div className="flex items-center">
                                {apt.status === 'won' ? (
                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                ) : apt.status === 'missed' ? (
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                ) : apt.status === 'interviewed' ? (
                                    <Phone className="w-6 h-6 text-blue-500" />
                                ) : (
                                    <div className="p-2 rounded-lg bg-white/5 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors">
                                        <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <MissionDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                appointment={selectedApt}
                onAction={(apt) => {
                    handleLockAndLoad(apt);
                    setIsModalOpen(false);
                }}
            />
        </div>
    );
}
