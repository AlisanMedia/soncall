'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface SentimentMeterProps {
    score: number | null | undefined;
    className?: string;
}

export default function SentimentMeter({ score, className = '' }: SentimentMeterProps) {
    const normalizedScore = score ? Math.max(0, Math.min(10, score)) : 0;
    const percentage = (normalizedScore / 10) * 100;

    const config = useMemo(() => {
        if (!score) {
            return {
                emoji: '❓',
                label: 'Belirlenemedi',
                color: 'from-gray-400 to-gray-500',
                bgColor: 'bg-gray-500/10',
                textColor: 'text-gray-400'
            };
        }

        if (normalizedScore >= 8) {
            return {
                emoji: '🎉',
                label: 'Çok Olumlu',
                color: 'from-green-400 via-emerald-500 to-green-600',
                bgColor: 'bg-green-500/10',
                textColor: 'text-green-400'
            };
        } else if (normalizedScore >= 6) {
            return {
                emoji: '😊',
                label: 'Olumlu',
                color: 'from-lime-400 via-green-500 to-emerald-500',
                bgColor: 'bg-lime-500/10',
                textColor: 'text-lime-400'
            };
        } else if (normalizedScore >= 4) {
            return {
                emoji: '😐',
                label: 'Nötr',
                color: 'from-yellow-400 via-amber-500 to-orange-500',
                bgColor: 'bg-yellow-500/10',
                textColor: 'text-yellow-400'
            };
        } else {
            return {
                emoji: '😞',
                label: 'Olumsuz',
                color: 'from-orange-400 via-red-500 to-red-600',
                bgColor: 'bg-red-500/10',
                textColor: 'text-red-400'
            };
        }
    }, [score, normalizedScore]);

    if (!score) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} border border-gray-500/20 ${className}`}>
                <span className="text-lg">{config.emoji}</span>
                <span className="text-xs text-gray-400">Duygu skoru belirlenemedi</span>
            </div>
        );
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <motion.span
                        className="text-2xl"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    >
                        {config.emoji}
                    </motion.span>
                    <div>
                        <p className={`text-xs font-semibold ${config.textColor}`}>
                            {config.label}
                        </p>
                        <p className="text-xs text-gray-400">Duygu Analizi</p>
                    </div>
                </div>
                <motion.div
                    className={`text-xl font-bold ${config.textColor}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    {normalizedScore}/10
                </motion.div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                {/* Background gradient markers */}
                <div className="absolute inset-0 flex">
                    <div className="flex-1 bg-gradient-to-r from-red-500/10 to-orange-500/10" />
                    <div className="flex-1 bg-gradient-to-r from-orange-500/10 to-yellow-500/10" />
                    <div className="flex-1 bg-gradient-to-r from-yellow-500/10 to-lime-500/10" />
                    <div className="flex-1 bg-gradient-to-r from-lime-500/10 to-green-500/10" />
                </div>

                {/* Animated fill */}
                <motion.div
                    className={`absolute top-0 left-0 h-full bg-gradient-to-r ${config.color} shadow-lg`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{
                        duration: 1,
                        ease: 'easeOut',
                        delay: 0.3
                    }}
                >
                    {/* Shine effect */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        initial={{ x: '-100%' }}
                        animate={{ x: '200%' }}
                        transition={{
                            duration: 1.5,
                            delay: 0.5,
                            repeat: Infinity,
                            repeatDelay: 3
                        }}
                    />
                </motion.div>

                {/* Score marker */}
                <motion.div
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-white shadow-lg rounded-full"
                    initial={{ left: 0 }}
                    animate={{ left: `calc(${percentage}% - 2px)` }}
                    transition={{
                        duration: 1,
                        ease: 'easeOut',
                        delay: 0.3
                    }}
                />
            </div>

            {/* Emoji scale */}
            <div className="flex justify-between text-xs px-1">
                <span className="opacity-50">😞</span>
                <span className="opacity-50">😐</span>
                <span className="opacity-50">😊</span>
                <span className="opacity-50">🎉</span>
            </div>
        </div>
    );
}
