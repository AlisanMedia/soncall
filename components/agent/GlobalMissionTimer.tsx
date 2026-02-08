"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, AlertTriangle, Crosshair, ArrowRight, Loader2 } from 'lucide-react';
import MissionDetailModal from './MissionDetailModal'; // Reusing the detail modal

interface Appointment {
    id: string;
    lead_id: string;
    agent_id: string;
    appointment_date: string;
    status: 'pending' | 'completed' | 'cancelled' | 'missed' | 'won' | 'interviewed' | 'attempted';
    notes?: string;
    created_at: string;
    business_name?: string;
    phone_number?: string;
    call_count?: number;
    last_call_at?: string;
}

export function GlobalMissionTimer() {
    const [nextMission, setNextMission] = useState<Appointment | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [urgency, setUrgency] = useState<'normal' | 'preparation' | 'combat' | 'critical'>('normal');
    const [isVisible, setIsVisible] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchNextMission = useCallback(async () => {
        try {
            const res = await fetch('/api/agent/appointments');
            const data = await res.json();

            if (data.appointments && data.appointments.length > 0) {
                // Filter for actionable items just like the schedule
                const actionable = data.appointments.filter((a: Appointment) =>
                    a.status === 'missed' || a.status === 'pending' || a.status === 'attempted'
                );

                if (actionable.length > 0) {
                    setNextMission(actionable[0]);
                } else {
                    setNextMission(null);
                }
            } else {
                setNextMission(null);
            }
        } catch (error) {
            console.error("Failed to fetch mission for HUD:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch and periodic polling (every minute to keep it lightweight)
    useEffect(() => {
        fetchNextMission();
        const interval = setInterval(fetchNextMission, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, [fetchNextMission]);

    // Timer logic
    useEffect(() => {
        if (!nextMission) {
            setIsVisible(false);
            return;
        }

        const calculateTime = () => {
            const now = new Date().getTime();
            const target = new Date(nextMission.appointment_date).getTime();
            const diff = target - now;

            // Visibility Logic
            // If missed (negative diff) -> Always Visible (Critical)
            // If < 15 mins -> Visible (Combat)
            // If < 30 mins -> Visible (Preparation)
            // If > 30 mins -> Hidden

            const minutesLeft = Math.floor(diff / (1000 * 60));

            if (diff < 0) {
                // Overdue
                setUrgency('critical');
                setIsVisible(true);
                setTimeLeft('GÖREV ZAMANI GEÇTİ');
            } else if (minutesLeft < 15) {
                setUrgency('combat');
                setIsVisible(true);

                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${m}dk ${s}sn`);
            } else if (minutesLeft < 30) {
                setUrgency('preparation');
                setIsVisible(true);

                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeLeft(`${m}dk`);
            } else {
                setUrgency('normal');
                setIsVisible(false); // Hide if far future
            }
        };

        const timerInterval = setInterval(calculateTime, 1000);
        calculateTime(); // Immediate cal

        return () => clearInterval(timerInterval);
    }, [nextMission]);

    if (!isVisible && !loading) return null;

    // HUD Styles based on urgency
    const getStyles = () => {
        switch (urgency) {
            case 'critical':
                return {
                    container: 'bg-red-500/20 border-red-500 text-red-100 animate-pulse',
                    icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
                    label: 'KRİTİK GÖREV'
                };
            case 'combat':
                return {
                    container: 'bg-red-500/10 border-red-500/50 text-red-100',
                    icon: <Crosshair className="w-4 h-4 text-red-400 animate-pulse" />,
                    label: 'OPERASYON BAŞLIYOR'
                };
            case 'preparation':
                return {
                    container: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-100',
                    icon: <Timer className="w-4 h-4 text-yellow-400" />,
                    label: 'HAZIRLIK'
                };
            default:
                return {
                    container: 'hidden',
                    icon: null,
                    label: ''
                };
        }
    };

    const styles = getStyles();

    return (
        <>
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="hidden md:block absolute left-1/2 transform -translate-x-1/2 top-4 z-50 cursor-pointer"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <div className={`px-4 py-2 rounded-full border backdrop-blur-md flex items-center gap-3 shadow-xl hover:scale-105 transition-transform ${styles.container}`}>
                            {styles.icon}
                            <div className="flex flex-col items-center leading-none">
                                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">{styles.label}</span>
                                <span className="font-mono font-bold text-sm min-w-[60px] text-center">{timeLeft}</span>
                            </div>
                            <div className="w-[1px] h-6 bg-white/20 mx-1" />
                            <div className="flex items-center gap-1 text-xs font-semibold opacity-90 max-w-[150px] truncate">
                                <span>{nextMission?.business_name}</span>
                                <ArrowRight className="w-3 h-3" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reuse the modal we built */}
            <MissionDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                appointment={nextMission}
                onAction={(apt: any) => {
                    // Start operation logic (same as schedule)
                    window.location.href = `/agent/dashboard?mode=work&leadId=${apt.lead_id}`;
                }}
            />
        </>
    );
}
