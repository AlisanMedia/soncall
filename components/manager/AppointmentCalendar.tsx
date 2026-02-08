'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, ChevronLeft, ChevronRight, Clock, Phone,
    Sparkles, Filter, Search, User, Zap, TrendingUp
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AppointmentFilters from './AppointmentFilters';
import GhostBusterPanel from './GhostBusterPanel';
import HeatmapView from './HeatmapView';
import BulkActionToolbar from './BulkActionToolbar';

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
    status?: string;
    call_status?: string;
    call_count?: number;
    last_call_at?: string | null;
}

type ViewMode = 'week' | 'month';

export default function AppointmentCalendar() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode | 'heatmap'>('week');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [agentFilter, setAgentFilter] = useState<string>('all');

    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<any>({
        dateRange: null,
        status: 'all',
        potential: 'all',
        agent: 'all'
    });

    // [INTEGRATION]
    // ... inside AppointmentCalendar component
    const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
    const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
    const [reassignAgentId, setReassignAgentId] = useState('');

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedAppointments);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedAppointments(newSelection);
    };

    const clearSelection = () => setSelectedAppointments(new Set());

    const handleBulkAction = async (action: 'reassign' | 'delete' | 'sms', payload?: any) => {
        if (action === 'delete') {
            if (!confirm('Seçili randevuları silmek/iptal etmek istediğinize emin misiniz?')) return;
        }

        if (action === 'sms') {
            // Placeholder for SMS integration
            alert('Toplu SMS gönderimi yakında eklenecek!');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/manager/appointments/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    appointmentIds: Array.from(selectedAppointments),
                    payload
                })
            });

            const data = await res.json();
            if (data.success) {
                // simple success notification
                // If we had toast, we'd use it here. For now alert or console.
                // alert('İşlem başarılı!');
                clearSelection();
                if (action === 'reassign') setIsReassignModalOpen(false);
                loadAppointments(); // Reload data
            } else {
                alert('Hata: ' + data.error);
            }
        } catch (error) {
            console.error('Bulk action error:', error);
            alert('Bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

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

    // Modified loadAppointments to use state filters
    const loadAppointments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.agent !== 'all') params.append('agent', filters.agent);
            if (filters.status !== 'all') params.append('status', filters.status);
            if (filters.potential !== 'all') params.append('potential', filters.potential);
            if (filters.dateRange?.start) params.append('start', filters.dateRange.start);
            if (filters.dateRange?.end) params.append('end', filters.dateRange.end);

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

    // Trigger reload when filters change
    useEffect(() => {
        loadAppointments();
    }, [filters]);

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
            <GhostBusterPanel
                appointments={appointments}
                onReassign={(id) => {
                    setSelectedAppointments(new Set([id]));
                    setIsReassignModalOpen(true);
                }}
                onReschedule={() => alert('Yeniden planlama yakında eklenecek!')}
            />
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
                        {(['week', 'month', 'heatmap'] as const).map(mode => (
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
                                <span className="relative z-10 capitalize">
                                    {mode === 'week' ? 'Hafta' : mode === 'month' ? 'Ay' : 'Isı Haritası'}
                                </span>
                            </motion.button>
                        ))}
                    </div>

                    {/* Date Navigation */}
// ... keeping date navigation same ...
                </div>
            </div>

            {/* Filters & Search - Keeping same */}
// ...

            <AppointmentFilters
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                filters={filters}
                onFilterChange={setFilters}
                agents={uniqueAgents}
            />

            <BulkActionToolbar
                selectedCount={selectedAppointments.size}
                onClearSelection={clearSelection}
                onReassign={() => setIsReassignModalOpen(true)}
                onSms={() => handleBulkAction('sms')}
                onDelete={() => handleBulkAction('delete')}
            />

            {/* Calendar Grid & Views */}
            {viewMode === 'heatmap' ? (
                <HeatmapView appointments={appointments} />
            ) : loading ? (
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
                                            <div key={apt.id} className="relative group">
                                                {/* Selection Checkbox (Visible on hover or selected) */}
                                                <div
                                                    className={`absolute top-2 right-2 z-20 transition-opacity ${selectedAppointments.has(apt.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedAppointments.has(apt.id)}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            toggleSelection(apt.id);
                                                        }}
                                                        className="w-4 h-4 rounded border-white/30 bg-black/50 checked:bg-purple-600 focus:ring-purple-500 cursor-pointer"
                                                    />
                                                </div>
                                                <AppointmentCard
                                                    appointment={apt}
                                                    index={aptIndex}
                                                    onClick={() => setSelectedAppointment(apt)}
                                                    isSelected={selectedAppointments.has(apt.id)}
                                                />
                                            </div>
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

            {/* Reassign Modal */}
            <AnimatePresence>
                {isReassignModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#1a1b26] border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
                        >
                            <button
                                onClick={() => setIsReassignModalOpen(false)}
                                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x w-5 h-5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>

                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-400" />
                                Toplu Atama
                            </h3>

                            <p className="text-zinc-400 mb-6 text-sm">
                                Seçili {selectedAppointments.size} randevuyu atamak istediğiniz personeli seçin.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-purple-200 block mb-2">Personel Seç</label>
                                    <select
                                        value={reassignAgentId}
                                        onChange={(e) => setReassignAgentId(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="">Seçim Yapın...</option>
                                        {uniqueAgents.map(age => (
                                            <option key={age.id} value={age.id}>{age.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        onClick={() => setIsReassignModalOpen(false)}
                                        className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction('reassign', { agentId: reassignAgentId })}
                                        disabled={!reassignAgentId}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                    >
                                        {loading ? 'Atanıyor...' : 'Onayla ve Ata'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Appointment Card Component
function AppointmentCard({ appointment, index, onClick, isSelected }: {
    appointment: Appointment;
    index: number;
    onClick: () => void;
    isSelected?: boolean;
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
                className={`p-3 rounded-lg backdrop-blur-sm border relative overflow-hidden transition-all ${isSelected ? 'border-purple-500 ring-1 ring-purple-500' : 'border-white/20'
                    }`}
                style={{
                    background: isSelected
                        ? `linear-gradient(135deg, ${appointment.agent_color.from}40, ${appointment.agent_color.to}40)`
                        : `linear-gradient(135deg, ${appointment.agent_color.from}15, ${appointment.agent_color.to}15)`
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
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            WhatsApp
                        </motion.a>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
