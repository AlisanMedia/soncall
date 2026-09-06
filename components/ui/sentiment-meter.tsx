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
                color: 'ui-meter-fill-neutral',
                bgColor: 'ui-surface-raised',
                textColor: 'ui-tone-muted'
            };
        }

        if (normalizedScore >= 8) {
            return {
                emoji: '🎉',
                label: 'Çok Olumlu',
                color: 'ui-meter-fill-positive',
                bgColor: 'ui-status-success',
                textColor: 'ui-tone-success'
            };
        } else if (normalizedScore >= 6) {
            return {
                emoji: '😊',
                label: 'Olumlu',
                color: 'ui-meter-fill-positive',
                bgColor: 'ui-status-success',
                textColor: 'ui-tone-success'
            };
        } else if (normalizedScore >= 4) {
            return {
                emoji: '😐',
                label: 'Nötr',
                color: 'ui-meter-fill-warning',
                bgColor: 'ui-status-warning',
                textColor: 'ui-tone-warning'
            };
        } else {
            return {
                emoji: '😞',
                label: 'Olumsuz',
                color: 'ui-meter-fill-negative',
                bgColor: 'ui-status-danger',
                textColor: 'ui-tone-danger'
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
            <div className="ui-meter-track">

                {/* Animated fill */}
                <motion.div
                    className={`ui-meter-fill absolute left-0 top-0 ${config.color}`}
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
                        className="absolute inset-0 bg-white/10"
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
