'use client';

import { Info } from 'lucide-react';
import { useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SectionInfoProps {
    title?: string;
    text: string;
    className?: string;
}

export function SectionInfo({ title, text, className = '' }: SectionInfoProps) {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipId = useId();

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            <button
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
                className="ui-info-button group"
                aria-label="Info"
                aria-expanded={isVisible}
                aria-describedby={isVisible ? tooltipId : undefined}
            >
                <Info className="w-4 h-4" />
            </button>

            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        id={tooltipId}
                        role="tooltip"
                        className="ui-info-popover absolute right-0 top-8 z-50"
                    >
                        {title && (
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                                <Info className="w-3 h-3 ui-tone-accent" />
                                {title}
                            </h4>
                        )}
                        <p className="text-xs leading-relaxed text-slate-300">
                            {text}
                        </p>

                        {/* Arrow indicator */}
                        <div className="absolute -top-1.5 right-2 h-3 w-3 rotate-45 border-l border-t border-slate-700 bg-[#151d27]" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
