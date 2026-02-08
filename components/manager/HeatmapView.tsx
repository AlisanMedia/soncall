'use client';

import { motion } from 'framer-motion';

interface HeatmapViewProps {
    appointments: any[];
}

export default function HeatmapView({ appointments }: HeatmapViewProps) {
    // Generate Heatmap Data
    // X-Axis: Hours (09:00 - 18:00)
    // Y-Axis: Days (Mon - Sat)

    const hours = Array.from({ length: 10 }, (_, i) => i + 9); // 9 to 18
    const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    const matrix = days.map(day => {
        return hours.map(hour => {
            // Count appointments for this day/hour
            const count = appointments.filter(apt => {
                const date = new Date(apt.appointment_date);
                const aptDay = date.toLocaleDateString('tr-TR', { weekday: 'long' });
                const aptHour = date.getHours();
                return aptDay === day && aptHour === hour;
            }).length;
            return count;
        });
    });

    // Find max for scaling opacity
    const maxCount = Math.max(...matrix.flat(), 1);

    return (
        <div className="bg-[#1a1b26] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Randevu Yoğunluk Haritası
            </h3>

            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Header Hours */}
                    <div className="flex mb-2">
                        <div className="w-24 shrink-0" />
                        {hours.map(h => (
                            <div key={h} className="flex-1 text-center text-xs text-zinc-500 font-mono">
                                {h}:00
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    {days.map((day, dIndex) => (
                        <div key={day} className="flex items-center mb-2">
                            <div className="w-24 shrink-0 text-sm text-zinc-400 font-medium">
                                {day}
                            </div>
                            {hours.map((_, hIndex) => {
                                const value = matrix[dIndex][hIndex];
                                const intensity = value / maxCount;

                                return (
                                    <div key={hIndex} className="flex-1 p-0.5">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ delay: dIndex * 0.05 + hIndex * 0.01 }}
                                            className="h-8 rounded md:rounded-lg flex items-center justify-center text-xs font-bold text-white/90 relative group cursor-default"
                                            style={{
                                                backgroundColor: value > 0
                                                    ? `rgba(249, 115, 22, ${0.2 + intensity * 0.8})` // Orange base
                                                    : 'rgba(255, 255, 255, 0.03)'
                                            }}
                                        >
                                            {value > 0 && <span>{value}</span>}

                                            {/* Tooltip */}
                                            {value > 0 && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                    {day} {hours[hIndex]}:00 - {value} Randevu
                                                </div>
                                            )}
                                        </motion.div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 text-xs text-zinc-500">
                <span>Az Yoğun</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded bg-orange-500/20" />
                    <div className="w-3 h-3 rounded bg-orange-500/50" />
                    <div className="w-3 h-3 rounded bg-orange-500/80" />
                    <div className="w-3 h-3 rounded bg-orange-500" />
                </div>
                <span>Çok Yoğun</span>
            </div>
        </div>
    );
}
