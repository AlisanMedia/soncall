'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Trash2, MessageSquare, X, CheckSquare
} from 'lucide-react';

interface BulkActionToolbarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onReassign: () => void;
    onDelete: () => void;
    onSms: () => void;
}

export default function BulkActionToolbar({
    selectedCount,
    onClearSelection,
    onReassign,
    onDelete,
    onSms
}: BulkActionToolbarProps) {
    return (
        <AnimatePresence>
            {selectedCount > 0 && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed inset-x-3 bottom-24 z-50 flex flex-col gap-3 rounded-2xl border border-white/20 bg-[#1a1b26] px-4 py-3 shadow-2xl sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-4"
                >
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 sm:justify-start sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
                        <div className="flex items-center gap-2 text-white font-medium">
                            <span className="bg-purple-600 text-white w-6 h-6 rounded flex items-center justify-center text-xs">
                                {selectedCount}
                            </span>
                            <span>Seçildi</span>
                        </div>
                        <button
                            onClick={onClearSelection}
                            className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto">
                        <button
                            onClick={onReassign}
                            className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                        >
                            <Users className="w-4 h-4 text-blue-400" />
                            Ajana Ata
                        </button>

                        <button
                            onClick={onSms}
                            className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                        >
                            <MessageSquare className="w-4 h-4 text-green-400" />
                            SMS Gönder
                        </button>

                        <div className="w-px h-6 bg-white/10 mx-2" />

                        <button
                            onClick={onDelete}
                            className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
                        >
                            <Trash2 className="w-4 h-4" />
                            Sil / İptal
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
