'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface ProgressStep {
    label: string;
    status: 'complete' | 'active' | 'pending';
    icon: string;
}

interface UploadProgressProps {
    steps: ProgressStep[];
    className?: string;
}

export default function UploadProgress({ steps, className = '' }: UploadProgressProps) {
    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between">
                {steps.map((step, index) => (
                    <div key={index} className="flex flex-col items-center flex-1 relative">
                        {/* Connection Line */}
                        {index < steps.length - 1 && (
                            <div className="absolute top-5 left-1/2 w-full h-0.5 bg-white/10">
                                <motion.div
                                    className="h-full bg-[var(--color-accent)]"
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: step.status === 'complete' ? '100%' : '0%'
                                    }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        )}

                        {/* Icon Circle */}
                        <motion.div
                            className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${step.status === 'complete'
                                    ? 'border-emerald-400/60 bg-emerald-500/20'
                                    : step.status === 'active'
                                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                                        : 'border-white/20 bg-white/5'
                                }`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
                        >
                            {step.status === 'complete' ? (
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: 'spring', stiffness: 200 }}
                                >
                                    <CheckCircle2 className="w-5 h-5 text-white" />
                                </motion.div>
                            ) : step.status === 'active' ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                >
                                    <Loader2 className="w-5 h-5 text-white" />
                                </motion.div>
                            ) : (
                                <span className="text-base">{step.icon}</span>
                            )}
                        </motion.div>

                        {/* Label */}
                        <motion.p
                            className={`text-xs mt-2 text-center font-medium transition-colors ${step.status === 'complete'
                                    ? 'text-emerald-300'
                                    : step.status === 'active'
                                        ? 'text-blue-200'
                                        : 'text-slate-500'
                                }`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 + 0.2 }}
                        >
                            {step.label}
                        </motion.p>

                        {/* Active pulse */}
                        {step.status === 'active' && (
                            <motion.div
                                className="absolute left-1/2 top-0 h-10 w-10 -translate-x-1/2 rounded-full bg-blue-400/20"
                                animate={{
                                    scale: [1, 1.5, 1],
                                    opacity: [0.5, 0, 0.5]
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: 'easeInOut'
                                }}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
