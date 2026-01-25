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

export const PulseVoiceRecorder = ({ isRecording = false, onToggle, duration: externalDuration }: PulseVoiceRecorderProps) => {
    // If controlled, use props; otherwise (for demo), use internal state.
    // Actually, for integration, we likely want controlled mode.
    // But let's keep the internal logic for the 'animation' part or just rely on props.
    // I will make it accept 'isRecording' prop primarily.

    const [internalRecording, setInternalRecording] = useState(false);
    const [timer, setTimer] = useState(0);

    // Sync prop if provided
    useEffect(() => {
        if (isRecording !== undefined) {
            setInternalRecording(isRecording);
        }
    }, [isRecording]);

    useEffect(() => {
        if (!internalRecording) {
            setTimer(0);
            return;
        }

        // If not controlled duration, use internal timer
        if (externalDuration === undefined) {
            const interval = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [internalRecording, externalDuration]);

    const currentDuration = externalDuration !== undefined ? externalDuration : timer;

    const handleClick = () => {
        // If onToggle provided, call it. Otherwise toggle internal (demo mode).
        if (onToggle) {
            onToggle();
        } else {
            setInternalRecording(prev => !prev);
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
                                    "absolute inset-0 rounded-full border border-red-500/30",
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
                            ? "bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)] scale-110"
                            : "bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/30"
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
                internalRecording ? "text-red-400 opacity-100" : "text-gray-500 opacity-50"
            )}>
                {formatTime(currentDuration)}
            </div>
        </div>
    );
};
