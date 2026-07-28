'use client';

import React, { useEffect, useState } from 'react';
import { X, Clock, User, Phone, MapPin, Sparkles, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getPotentialColor, formatPhoneNumber } from '@/lib/utils';
import type { Lead } from '@/types';

interface LeadProfileModalProps {
    leadId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function LeadProfileModal({ leadId, isOpen, onClose }: LeadProfileModalProps) {
    const [lead, setLead] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        if (isOpen && leadId) {
            loadLeadDetails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, leadId]);

    const loadLeadDetails = async () => {
        setLoading(true);
        try {
            // Load Lead Config
            const { data: leadData } = await supabase
                .from('leads')
                .select(`
                    *,
                    profiles:assigned_to (full_name)
                `)
                .eq('id', leadId)
                .single();

            setLead(leadData);

            // Fetch History (activity + notes combined)
            const { data: activityData } = await supabase
                .from('lead_activity_log')
                .select('id, action, metadata, created_at, profiles:agent_id (full_name)')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false });

            const { data: notesData } = await supabase
                .from('lead_notes')
                .select('id, note, action_taken, created_at, profiles:agent_id (full_name)')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false });

            setActivities(activityData || []);
            setNotes(notesData || []);

        } catch (error) {
            console.error("Error loading lead profile:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Combine and sort events for timeline
    const timelineEvents = [
        ...activities.map(a => ({ type: 'activity', ...a })),
        ...notes.map(n => ({ type: 'note', ...n }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in"
                onClick={onClose}
            />

            {/* Slide-over panel */}
            <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                    </div>
                ) : lead ? (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 bg-black/20 sticky top-0 z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h2 className="text-xl font-bold text-white">{lead.business_name}</h2>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getPotentialColor(lead.potential_level)}`}>
                                            {lead.potential_level === 'not_assessed' ? 'Belirsiz' : lead.potential_level}
                                        </span>
                                    </div>
                                    <div className="text-purple-300 text-sm">{lead.category || 'Sektör Belirtilmemiş'}</div>
                                </div>
                                <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex items-center gap-2 text-gray-300">
                                    <Phone className="w-4 h-4 text-purple-400" />
                                    <span>{formatPhoneNumber(lead.phone_number)}</span>
                                </div>
                                {lead.profiles?.full_name && (
                                    <div className="flex items-center gap-2 text-gray-300">
                                        <User className="w-4 h-4 text-purple-400" />
                                        <span className="truncate">{lead.profiles.full_name}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-gray-300 col-span-2">
                                    <Clock className="w-4 h-4 text-purple-400" />
                                    <span className="text-xs">Sisteme Giriş: {new Date(lead.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Content Scroll */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* AI Summary Banner if exists */}
                            {lead.ai_summary && (
                                <div className="bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-purple-300 font-bold mb-2">
                                        <Sparkles className="w-4 h-4" /> AI Sonuç Özeti
                                    </div>
                                    <p className="text-white text-sm leading-relaxed">
                                        {lead.ai_summary}
                                    </p>
                                </div>
                            )}

                            {/* Info Cards */}
                            {lead.address && (
                                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> Adres</div>
                                    <div className="text-sm text-gray-300">{lead.address}</div>
                                </div>
                            )}

                            {/* Timeline */}
                            <div>
                                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Müşteri Tarihçesi
                                </h3>

                                {timelineEvents.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 text-sm italic bg-white/5 rounded-lg border border-white/5">
                                        Henüz bir işlem veya not bulunmuyor.
                                    </div>
                                ) : (
                                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-purple-500/20 before:to-transparent">

                                        {timelineEvents.map((event: any, i) => (
                                            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">

                                                {/* Icon */}
                                                <div className="flex items-center justify-center w-6 h-6 rounded-full border border-purple-500/30 bg-slate-900 group-[.is-active]:bg-purple-500 text-white shrink-0 z-10 shadow ml-2.5 md:mx-auto">
                                                    {event.type === 'note' ? <MessageCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                </div>

                                                {/* Card */}
                                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2rem)] p-3 rounded-lg border border-white/10 bg-white/5 shadow">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-white text-xs">
                                                            {event.profiles?.full_name || 'Sistem'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500">
                                                            {new Date(event.created_at).toLocaleDateString()} {new Date(event.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                                                        {event.type === 'note' ? event.note : (
                                                            <span className="italic text-gray-400">
                                                                Sistem İşlemi: {event.action}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-red-400 p-6 text-center">
                        Müşteri bilgileri alınamadı veya silinmiş.
                    </div>
                )}
            </div>
        </>
    );
}
