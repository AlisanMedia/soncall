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
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1b26] border border-white/20 rounded-2xl shadow-2xl z-50 px-6 py-4 flex items-center gap-6"
                >
                    <div className="flex items-center gap-4 border-r border-white/10 pr-6">
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

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onReassign}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                            <Users className="w-4 h-4 text-blue-400" />
                            Ajana Ata
                        </button>

                        <button
                            onClick={onSms}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                            <MessageSquare className="w-4 h-4 text-green-400" />
                            SMS Gönder
                        </button>

                        <div className="w-px h-6 bg-white/10 mx-2" />

                        <button
                            onClick={onDelete}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/20 rounded-lg text-red-300 hover:text-red-200 text-sm font-medium transition-colors"
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
