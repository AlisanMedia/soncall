'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { AlertCircle, Phone, Flame, Zap, TrendingDown } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/utils';
import type { Lead } from '@/types';

// Extended Lead type for this component
export interface KanbanLead extends Lead {
    profiles?: { full_name: string };
    analysis_cache?: {
        summary?: string;
        potential_level?: string;
        sentiment?: string
    };
}

// Map database potential_level to columns
const COLUMNS = {
    'not_assessed': { id: 'not_assessed', title: 'Belirsiz (İşlenmemiş)', color: 'border-slate-500', headerBg: 'bg-slate-500/20', icon: AlertCircle },
    'low': { id: 'low', title: 'Soğuk', color: 'border-red-500', headerBg: 'bg-red-500/20', icon: TrendingDown },
    'medium': { id: 'medium', title: 'Ilık', color: 'border-yellow-500', headerBg: 'bg-yellow-500/20', icon: Zap },
    'high': { id: 'high', title: 'Sıcak', color: 'border-green-500', headerBg: 'bg-green-500/20', icon: Flame },
};

interface LeadKanbanBoardProps {
    leads: KanbanLead[];
    onLeadMove: (leadId: string, newLevel: string) => Promise<void>;
    onLeadClick: (lead: KanbanLead) => void;
    isLoading: boolean;
}

export default function LeadKanbanBoard({ leads, onLeadMove, onLeadClick, isLoading }: LeadKanbanBoardProps) {
    const [columns, setColumns] = useState<Record<string, KanbanLead[]>>({
        'not_assessed': [],
        'low': [],
        'medium': [],
        'high': [],
    });

    useEffect(() => {
        // Group leads by potential_level
        const grouped = {
            'not_assessed': leads.filter(l => !l.potential_level || l.potential_level === 'not_assessed'),
            'low': leads.filter(l => l.potential_level === 'low'),
            'medium': leads.filter(l => l.potential_level === 'medium'),
            'high': leads.filter(l => l.potential_level === 'high'),
        };
        setColumns(grouped);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leads]);

    const handleDragEnd = async (result: DropResult) => {
        const { source, destination, draggableId } = result;

        // Dropped outside the list or no change
        if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
            return;
        }

        const sourceColumn = source.droppableId;
        const destColumn = destination.droppableId;

        // Optimistic UI update
        const newColumns = { ...columns };
        const [movedItem] = newColumns[sourceColumn].splice(source.index, 1);

        // Update item's level optimistically
        const updatedItem = { ...movedItem, potential_level: destColumn as any };
        newColumns[destColumn].splice(destination.index, 0, updatedItem);

        setColumns(newColumns);

        // API Call
        if (sourceColumn !== destColumn) {
            try {
                await onLeadMove(draggableId, destColumn);
            } catch (error) {
                // Revert on error is handled by parent refetching
                console.error("Failed to move lead", error);
            }
        }
    };

    if (isLoading) {
        return <div className="p-12 text-center text-purple-300 animate-pulse">Panolar Yükleniyor...</div>;
    }

    return (
        <div className="flex min-h-[65vh] items-start gap-3 overflow-x-auto pb-4 sm:gap-4 md:min-h-[70vh]">
            <DragDropContext onDragEnd={handleDragEnd}>
                {Object.values(COLUMNS).map((column) => (
                    <div key={column.id} className={`flex h-full max-h-[70vh] w-[82vw] flex-shrink-0 flex-col rounded-xl border bg-black/20 sm:w-80 md:max-h-[75vh] ${column.color}/30`}>
                        {/* Header */}
                            <div className={`flex items-center justify-between rounded-t-xl border-b p-3 ${column.headerBg} ${column.color}/20`}>
                            <div className="min-w-0 flex items-center gap-2">
                                <column.icon className={`w-5 h-5 text-${column.color.split('-')[1]}-400`} />
                                <h3 className="truncate text-sm font-bold text-white">{column.title}</h3>
                            </div>
                            <span className="bg-black/40 text-white text-xs px-2 py-1 rounded-full">
                                {columns[column.id]?.length || 0}
                            </span>
                        </div>

                        {/* Droppable Area */}
                        <Droppable droppableId={column.id}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`flex-1 p-3 overflow-y-auto space-y-3 transition-colors ${
                                        snapshot.isDraggingOver ? 'bg-white/5' : ''
                                    }`}
                                    style={{ minHeight: '150px' }}
                                >
                                    {columns[column.id]?.map((lead, index) => (
                                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    onClick={() => onLeadClick(lead)}
                                                    className={`bg-slate-800/80 border border-white/10 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-purple-400/50 transition-all ${
                                                        snapshot.isDragging ? 'shadow-2xl shadow-purple-500/20 scale-105 z-50 ring-2 ring-purple-500' : 'shadow-md'
                                                    }`}
                                                >
                                                    <div className="mb-2 flex items-start justify-between">
                                                        <h4 className="min-w-0 truncate pr-2 text-sm font-bold text-white">{lead.business_name}</h4>
                                                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300 shrink-0">
                                                            {lead.status === 'pending' ? 'Bekliyor' : lead.status === 'appointment' ? 'Randevu' : 'Arandı'}
                                                        </span>
                                                    </div>

                                                    <div className="text-xs text-purple-200 mb-2 truncate">
                                                        {lead.category || 'Kategori Yok'}
                                                    </div>

                                                    <div className="mb-2 flex min-w-0 items-center gap-1 text-xs text-gray-400">
                                                        <Phone className="w-3 h-3" />
                                                        <span className="truncate">{formatPhoneNumber(lead.phone_number)}</span>
                                                    </div>

                                                    {lead.profiles?.full_name && (
                                                        <div className="flex items-center justify-between text-[10px] mt-3 pt-2 border-t border-white/10 text-gray-400">
                                                            <span>Agent: <span className="text-purple-300">{lead.profiles.full_name}</span></span>
                                                            <span className="opacity-50">{new Date(lead.created_at).toLocaleDateString('tr-TR')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </DragDropContext>
        </div>
    );
}
