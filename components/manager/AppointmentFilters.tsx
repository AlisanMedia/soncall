'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Filter, Calendar as CalendarIcon, User,
    X, Check, Flame, Zap, AlertCircle
} from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';

interface FilterState {
    dateRange: { start: string; end: string } | null;
    status: string; // 'all', 'confirmed', 'attempted', 'missed', 'pending'
    potential: string; // 'all', 'high', 'medium', 'low'
    agent: string; // 'all' or specific agent ID
}

interface AppointmentFiltersProps {
    isOpen: boolean;
    onClose: () => void;
    filters: FilterState;
    onFilterChange: (newFilters: FilterState) => void;
    agents: { id: string; name: string }[];
}

export default function AppointmentFilters({
    isOpen,
    onClose,
    filters,
    onFilterChange,
    agents
}: AppointmentFiltersProps) {

    const updateFilter = (key: keyof FilterState, value: any) => {
        onFilterChange({ ...filters, [key]: value });
    };

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
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    />

                    {/* Sidebar Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-80 bg-[#1a1b26] border-l border-white/10 z-50 shadow-2xl overflow-y-auto"
                    >
                        <div className="p-6 space-y-8">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Filter className="w-5 h-5 text-purple-400" />
                                    Filtreler
                                </h3>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Status Filter */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-purple-200">Randevu Durumu</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'all', label: 'Tümü' },
                                        { id: 'pending', label: 'Bekliyor' },
                                        { id: 'confirmed', label: 'Teyitli' },
                                        { id: 'attempted', label: 'Denenmiş' },
                                        { id: 'missed', label: 'Kaçırılan' },
                                    ].map(stat => (
                                        <button
                                            key={stat.id}
                                            onClick={() => updateFilter('status', stat.id)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${filters.status === stat.id
                                                    ? 'bg-purple-600 border-purple-500 text-white'
                                                    : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {stat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Potential Filter */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-purple-200">Potansiyel</label>
                                <div className="space-y-2">
                                    {[
                                        { id: 'all', label: 'Tümü', icon: null },
                                        { id: 'high', label: 'Yüksek (Acil)', icon: Flame, color: 'text-red-400' },
                                        { id: 'medium', label: 'Orta', icon: Zap, color: 'text-yellow-400' },
                                        { id: 'low', label: 'Düşük', icon: AlertCircle, color: 'text-blue-400' },
                                    ].map(pot => (
                                        <button
                                            key={pot.id}
                                            onClick={() => updateFilter('potential', pot.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all border ${filters.potential === pot.id
                                                    ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500 text-white'
                                                    : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {pot.icon && <pot.icon className={`w-4 h-4 ${pot.color}`} />}
                                            {pot.label}
                                            {filters.potential === pot.id && <Check className="w-4 h-4 ml-auto text-purple-400" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Agent Filter */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-purple-200">Personel (Agent)</label>
                                <select
                                    value={filters.agent}
                                    onChange={(e) => updateFilter('agent', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    <option value="all">Tüm Personel</option>
                                    {agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Range (Simple Implementation for now) */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-purple-200">Tarih Aralığı</label>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-1">
                                        <span className="text-xs text-zinc-500">Başlangıç</span>
                                        <input
                                            type="date"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, start: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-zinc-500">Bitiş</span>
                                        <input
                                            type="date"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, end: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={() => onFilterChange({ dateRange: null, status: 'all', potential: 'all', agent: 'all' })}
                                className="w-full py-3 text-sm text-zinc-400 hover:text-white border border-dashed border-white/20 hover:border-white/40 rounded-lg transition-all"
                            >
                                Filtreleri Temizle
                            </button>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
