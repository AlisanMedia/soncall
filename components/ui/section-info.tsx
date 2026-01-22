'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SectionInfoProps {
    title?: string;
    text: string;
    className?: string;
}

export function SectionInfo({ title, text, className = '' }: SectionInfoProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            <button
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors group"
                aria-label="Info"
            >
                <Info className="w-4 h-4 text-purple-300/50 group-hover:text-purple-300 transition-colors" />
            </button>

            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-8 z-50 w-72 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4"
                    >
                        {title && (
                            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                <Info className="w-3 h-3 text-purple-400" />
                                {title}
                            </h4>
                        )}
                        <p className="text-xs text-purple-200 leading-relaxed">
                            {text}
                        </p>

                        {/* Arrow indicator */}
                        <div className="absolute -top-1.5 right-2 w-3 h-3 bg-slate-900 border-l border-t border-white/10 transform rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
