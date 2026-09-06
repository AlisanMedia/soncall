// Original component inspired by voice input concept
// Created with unique pulse animation and recording visualization

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Mic } from "lucide-react"; // Added Mic icon for better UX

interface PulseVoiceRecorderProps {
    isRecording?: boolean;
    onToggle?: () => void;
    duration?: number; // Accept duration from parent if controlled, or manage internally if simple
}

export const PulseVoiceRecorder = ({ isRecording, onToggle, duration: externalDuration }: PulseVoiceRecorderProps) => {
    // If controlled, use props; otherwise (for demo), use internal state.
    // Actually, for integration, we likely want controlled mode.
    // But let's keep the internal logic for the 'animation' part or just rely on props.
    // I will make it accept 'isRecording' prop primarily.

    const isControlled = isRecording !== undefined || onToggle !== undefined;
    const [uncontrolledRecording, setUncontrolledRecording] = useState(false);
    const [timer, setTimer] = useState(0);
    const internalRecording = isControlled ? Boolean(isRecording) : uncontrolledRecording;

    useEffect(() => {
        if (!internalRecording || externalDuration !== undefined) return;

        // If not controlled duration, use internal timer
        const interval = setInterval(() => {
            setTimer(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [internalRecording, externalDuration]);

    const currentDuration = externalDuration !== undefined ? externalDuration : internalRecording ? timer : 0;

    const handleClick = () => {
        // If onToggle provided, call it. Otherwise toggle internal (demo mode).
        if (onToggle) {
            onToggle();
        } else {
            setTimer(0);
            setUncontrolledRecording(prev => !prev);
        }
    };

    const formatTime = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center">
                {/* Animated pulse rings */}
                {internalRecording && (
                    <>
                        {[0, 1, 2].map((index) => (
                            <div
                                key={index}
                                className={cn(
                                    "absolute inset-0 rounded-full border border-red-400/30",
                                    "animate-ping"
                                )}
                                style={{
                                    animationDelay: `${index * 0.4}s`,
                                    animationDuration: '2s',
                                    width: '100%',
                                    height: '100%'
                                }}
                            />
                        ))}
                    </>
                )}

                {/* Main record button */}
                <button
                    onClick={handleClick}
                    className={cn(
                        "relative z-10 w-16 h-16 rounded-full transition-all duration-300",
                        "flex items-center justify-center",
                        internalRecording
                            ? "bg-red-500 hover:bg-red-400 shadow-md scale-105"
                            : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] shadow-md"
                    )}
                >
                    {internalRecording ? (
                        <div className="w-6 h-6 bg-white rounded-sm" />
                    ) : (
                        <Mic className="w-8 h-8 text-white" />
                    )}
                </button>
            </div>

            {/* Duration display */}
            <div className={cn(
                "text-xl font-mono font-bold transition-all duration-300",
                internalRecording ? "text-red-300 opacity-100" : "text-slate-500 opacity-70"
            )}>
                {formatTime(currentDuration)}
            </div>
        </div>
    );
};
