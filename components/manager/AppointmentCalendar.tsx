'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, ChevronLeft, ChevronRight, Clock, Phone,
    Sparkles, Filter, Search, User, Zap, TrendingUp
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Appointment {
    id: string;
    appointment_date: string;
    business_name: string;
    phone_number: string;
    potential_level: 'high' | 'medium' | 'low';
    agent_id: string;
    agent_name: string;
    agent_avatar: string | null;
    agent_color: { from: string; to: string };
    is_urgent: boolean;
    is_today: boolean;
    time_until: string;
    notes: string | null;
}

type ViewMode = 'week' | 'month';

export default function AppointmentCalendar() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [agentFilter, setAgentFilter] = useState<string>('all');

    const supabase = createClient();

    useEffect(() => {
        loadAppointments();

        // Real-time subscription
        const channel = supabase
            .channel('appointments')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'leads',
                filter: 'appointment_date=not.is.null'
            }, () => {
                loadAppointments();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [agentFilter]);

    const loadAppointments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (agentFilter !== 'all') params.append('agent', agentFilter);

            const res = await fetch(`/api/manager/appointments?${params}`);
            const data = await res.json();

            if (data.success) {
                setAppointments(data.appointments);
            }
        } catch (error) {
            console.error('Failed to load appointments:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter appointments by search
    const filteredAppointments = appointments.filter(apt =>
        apt.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.agent_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group by date for week view
    const appointmentsByDate = filteredAppointments.reduce((acc, apt) => {
        const date = new Date(apt.appointment_date).toDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(apt);
        return acc;
    }, {} as Record<string, Appointment[]>);

    // Get unique agents for filter
    const uniqueAgents = Array.from(new Set(appointments.map(a => a.agent_id)))
        .map(id => {
            const apt = appointments.find(a => a.agent_id === id);
            return { id, name: apt!.agent_name, color: apt!.agent_color };
        });

    // Get month days (including padding)
    const getMonthDays = () => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Start date (Monday of the first week)
        const start = new Date(firstDay);
        // Adjust invalid day 0 (Sunday) to 7 for calculation if needed, but standard logic:
        // Day: 0(Sun), 1(Mon)...
        // We want Mon(1) as start.
        // If start is Su(0), offset -6. If Mon(1), offset 0.
        // Formula: (day + 6) % 7 is 0 for Mon, 6 for Sun.
        // We want to subtract that count from date.

        const day = start.getDay(); // 0 is Sunday
        const diff = day === 0 ? 6 : day - 1; // 1(Mon)->0, 0(Sun)->6
        start.setDate(start.getDate() - diff);

        // We need 5 or 6 weeks (35 or 42 days). Let's do fixed 35 or dynamic.
        // Easier to just fill until we reach end of calendar block.
        // Let's generate 35 days (5 weeks) which handles most months,
        // or 42 (6 weeks) to be safe.
        // Previous render code uses 35 for loading state, let's use 35-42.

        const days = [];
        const current = new Date(start);

        // 42 days to ensure full coverage
        for (let i = 0; i < 42; i++) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    };

    // Get week days
    const getWeekDays = () => {
        const start = new Date(selectedDate);
        start.setDate(start.getDate() - start.getDay() + 1); // Monday

        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            return day;
        });
    };

    const weekDays = getWeekDays();
    const today = new Date().toDateString();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
                        <Calendar className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Randevu Takvimi</h2>
                        <p className="text-purple-300 text-sm">
                            {filteredAppointments.length} randevu ·
                            <span className="text-red-400 ml-1">
                                {filteredAppointments.filter(a => a.is_urgent).length} acil
                            </span>
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    {/* View Switcher */}
                    <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                        {(['week', 'month'] as ViewMode[]).map(mode => (
                            <motion.button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${viewMode === mode
                                    ? 'text-white'
                                    : 'text-purple-300 hover:text-white'
                                    }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {viewMode === mode && (
                                    <motion.div
                                        layoutId="viewMode"
                                        className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-md"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10">
                                    {mode === 'week' ? 'Hafta' : 'Ay'}
                                </span>
                            </motion.button>
                        ))}
                    </div>

                    {/* Date Navigation */}
                    <div className="flex items-center gap-2">
                        <motion.button
                            onClick={() => {
                                const newDate = new Date(selectedDate);
                                newDate.setDate(newDate.getDate() - 7);
                                setSelectedDate(newDate);
                            }}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <ChevronLeft className="w-5 h-5 text-purple-300" />
                        </motion.button>

                        <motion.button
                            onClick={() => setSelectedDate(new Date())}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors text-sm font-medium text-white"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Bugün
                        </motion.button>

                        <motion.button
                            onClick={() => {
                                const newDate = new Date(selectedDate);
                                newDate.setDate(newDate.getDate() + 7);
                                setSelectedDate(newDate);
                            }}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <ChevronRight className="w-5 h-5 text-purple-300" />
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-wrap gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="w-5 h-5 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="İşletme veya agent ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                </div>

                {/* Agent Filter */}
                <select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                    <option value="all">Tüm Agentlar</option>
                    {uniqueAgents.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                </select>
            </div>

            {/* Calendar Grid */}
            {loading ? (
                <div className="grid grid-cols-7 gap-3">
                    {Array.from({ length: viewMode === 'week' ? 7 : 35 }).map((_, i) => (
                        <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10 h-32 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className={`grid gap-3 ${viewMode === 'week' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-7'}`}>
                    {(viewMode === 'week' ? weekDays : getMonthDays()).map((day, index) => {
                        const dateStr = day.toDateString();
                        const dayAppointments = appointmentsByDate[dateStr] || [];
                        const isToday = dateStr === today;
                        const isSelectedMonth = day.getMonth() === selectedDate.getMonth();

                        return (
                            <motion.div
                                key={dateStr + index}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.01 }}
                                className={`
                                    bg-white/5 rounded-xl border relative group overflow-hidden
                                    ${viewMode === 'week' ? 'min-h-[300px] p-4' : 'min-h-[120px] p-2'}
                                    ${isToday ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-white/10'}
                                    ${!isSelectedMonth && viewMode === 'month' ? 'opacity-30' : 'opacity-100'}
                                `}
                            >
                                {/* Day Header */}
                                <div className={`flex items-center justify-between mb-2 ${viewMode === 'week' ? '' : 'text-xs'}`}>
                                    <span className={`font-medium ${isToday ? 'text-purple-300' : 'text-purple-200'}`}>
                                        {viewMode === 'week' ? day.toLocaleDateString('tr-TR', { weekday: 'short' }) : ''}
                                    </span>
                                    <span className={`font-bold ${isToday ? 'text-white' : 'text-purple-100'} ${viewMode === 'week' ? 'text-2xl' : 'text-sm'}`}>
                                        {day.getDate()}
                                    </span>
                                </div>

                                {/* Appointments List */}
                                <div className="space-y-1.5 overflow-y-auto max-h-[220px] custom-scrollbar">
                                    {dayAppointments.map((apt, aptIndex) => (
                                        viewMode === 'week' ? (
                                            <AppointmentCard
                                                key={apt.id}
                                                appointment={apt}
                                                index={aptIndex}
                                                onClick={() => setSelectedAppointment(apt)}
                                            />
                                        ) : (
                                            // Month View Compact Dot/Item
                                            <div
                                                key={apt.id}
                                                onClick={() => setSelectedAppointment(apt)}
                                                className="cursor-pointer text-[10px] p-1.5 rounded bg-white/10 hover:bg-white/20 border border-white/5 truncate flex items-center gap-1 transition-colors"
                                                style={{ borderLeftColor: apt.agent_color.from, borderLeftWidth: 3 }}
                                            >
                                                <span className="truncate flex-1">{apt.business_name}</span>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredAppointments.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12"
                >
                    <Calendar className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-40" />
                    <p className="text-purple-300 text-lg">Randevu bulunmuyor</p>
                    <p className="text-purple-400 text-sm mt-1">
                        AI henüz randevu tespit etmedi veya filtreleriniz sonuç döndürmedi
                    </p>
                </motion.div>
            )}

            {/* Appointment Modal */}
            <AnimatePresence>
                {selectedAppointment && (
                    <AppointmentModal
                        appointment={selectedAppointment}
                        onClose={() => setSelectedAppointment(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Appointment Card Component
function AppointmentCard({ appointment, index, onClick }: {
    appointment: Appointment;
    index: number;
    onClick: () => void
}) {
    const time = new Date(appointment.appointment_date).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.1 }}
            onClick={onClick}
            className="relative group cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            <div
                className="p-3 rounded-lg backdrop-blur-sm border border-white/20 relative overflow-hidden"
                style={{
                    background: `linear-gradient(135deg, ${appointment.agent_color.from}15, ${appointment.agent_color.to}15)`
                }}
            >
                {/* Gradient Bar */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{
                        background: `linear-gradient(to bottom, ${appointment.agent_color.from}, ${appointment.agent_color.to})`
                    }}
                />

                {/* Urgent Badge */}
                {appointment.is_urgent && (
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute top-2 right-2"
                    >
                        <Zap className="w-4 h-4 text-red-400" />
                    </motion.div>
                )}

                {/* Content */}
                <div className="relativ pl-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3 h-3 text-purple-300" />
                        <span className="text-xs font-semibold text-white">{time}</span>
                    </div>

                    <div className="text-sm font-medium text-white truncate mb-1">
                        {appointment.business_name}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-300">{appointment.agent_name.split(' ')[0]}</span>
                        {appointment.potential_level === 'high' && (
                            <TrendingUp className="w-3 h-3 text-green-400" />
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// Appointment Modal Component
function AppointmentModal({ appointment, onClose }: {
    appointment: Appointment;
    onClose: () => void
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                transition={{ type: 'spring', damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-lg w-full border border-white/20 shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg"
                            style={{
                                background: `linear-gradient(135deg, ${appointment.agent_color.from}, ${appointment.agent_color.to})`
                            }}
                        >
                            {appointment.business_name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">{appointment.business_name}</h3>
                            <p className="text-sm text-purple-300">{appointment.agent_name}</p>
                        </div>
                    </div>

                    {appointment.is_urgent && (
                        <span className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-xs font-semibold">
                            ACİL
                        </span>
                    )}
                </div>

                {/* Details */}
                <div className="space-y-4">
                    <div>
                        <div className="text-sm text-purple-400 mb-1">Randevu Zamanı</div>
                        <div className="text-white font-semibold">
                            {new Date(appointment.appointment_date).toLocaleString('tr-TR', {
                                dateStyle: 'full',
                                timeStyle: 'short'
                            })}
                        </div>
                        <div className="text-sm text-purple-300 mt-1">{appointment.time_until}</div>
                    </div>

                    <div>
                        <div className="text-sm text-purple-400 mb-1">Telefon</div>
                        <div className="text-white">{appointment.phone_number}</div>
                    </div>

                    {appointment.notes && (
                        <div>
                            <div className="text-sm text-purple-400 mb-1">AI Notu</div>
                            <div className="text-sm text-purple-200 bg-white/5 rounded-lg p-3 border border-white/10 max-h-32 overflow-y-auto">
                                {appointment.notes}
                            </div>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-4">
                        <motion.a
                            href={`tel:${appointment.phone_number}`}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-300 font-semibold transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Phone className="w-4 h-4" />
                            Ara
                        </motion.a>

                        <motion.a
                            href={`https://wa.me/+90${appointment.phone_number.replace(/\D/g, '')}`}
                            target="_blank"
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-300 font-semibold transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Sparkles className="w-4 h-4" />
                            WhatsApp
                        </motion.a>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
