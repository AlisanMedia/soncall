'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Lead, PotentialLevel } from '@/types';
import {
    Phone, MapPin, Globe, Star, MessageCircle, Calendar,
    ArrowRight, Loader2, CheckCircle2, AlertCircle, Flame, Zap, TrendingDown, Wand2
} from 'lucide-react';
import { getWhatsAppUrl, formatPhoneNumber } from '@/lib/utils';
import { playLeadTransition, playAppointment, playWhatsApp, playVictory, playError } from '@/lib/sounds';
import VoiceRecorder from './VoiceRecorder';

interface LeadCardProps {
    agentId: string;
    onLeadProcessed: () => void;
    refreshKey: number;
}

export default function LeadCard({ agentId, onLeadProcessed, refreshKey }: LeadCardProps) {
    const [currentLead, setCurrentLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [potentialLevel, setPotentialLevel] = useState<PotentialLevel>('not_assessed');
    const [note, setNote] = useState('');

    const [actionTaken, setActionTaken] = useState<string>('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);

    const supabase = createClient();
    const lastPlayedLeadId = useRef<string | null>(null);

    // Load lead on mount - check localStorage first for persistence across page refreshes
    useEffect(() => {
        const restoreFromStorage = async () => {
            const savedLeadId = localStorage.getItem(`agent_${agentId}_current_lead`);

            if (savedLeadId && refreshKey === 0) {
                // Try to restore the saved lead
                try {
                    const { data: savedLead, error } = await supabase
                        .from('leads')
                        .select('*')
                        .eq('id', savedLeadId)
                        .eq('assigned_to', agentId)
                        .eq('status', 'pending')
                        .single();

                    if (!error && savedLead) {
                        // Re-lock the lead (in case it was unlocked)
                        await supabase
                            .from('leads')
                            .update({
                                current_agent_id: agentId,
                                locked_at: new Date().toISOString(),
                            })
                            .eq('id', savedLead.id);

                        setCurrentLead(savedLead);
                        setLoading(false);
                        return; // Don't load new lead
                    }
                } catch (err) {
                    console.error('Error restoring lead:', err);
                }
            }

            // If no saved lead or restore failed, load next lead
            loadNextLead();
        };

        restoreFromStorage();
    }, [refreshKey]);

    const loadNextLead = async () => {
        setLoading(true);
        setError(null);

        try {
            // Unlock stale leads first
            await fetch('/api/leads/unlock-stale', { method: 'POST' });

            // Get next pending lead assigned to this agent
            const { data: leads, error: fetchError } = await supabase
                .from('leads')
                .select('*')
                .eq('assigned_to', agentId)
                .eq('status', 'pending')
                .is('current_agent_id', null)
                .order('created_at')
                .limit(1);

            if (fetchError) throw fetchError;

            if (!leads || leads.length === 0) {
                // Clear localStorage since there are no more leads
                localStorage.removeItem(`agent_${agentId}_current_lead`);

                setCurrentLead(null);
                setLoading(false);
                // Play victory sound when all leads are completed!
                playVictory();
                return;
            }

            const lead = leads[0];

            // Lock this lead
            const { error: lockError } = await supabase
                .from('leads')
                .update({
                    current_agent_id: agentId,
                    locked_at: new Date().toISOString(),
                })
                .eq('id', lead.id);

            if (lockError) throw lockError;

            // Log 'viewed' action for handle time tracking
            await supabase.from('lead_activity_log').insert({
                lead_id: lead.id,
                agent_id: agentId,
                action: 'viewed',
                metadata: { source: 'agent_dashboard' }
            });

            setCurrentLead(lead);

            // Save to localStorage for persistence across page refreshes
            localStorage.setItem(`agent_${agentId}_current_lead`, lead.id);

            // Play sound for new lead if not already played for this lead
            if (lastPlayedLeadId.current !== lead.id) {
                playLeadTransition();
                lastPlayedLeadId.current = lead.id;
            }

            // Reset form
            setPotentialLevel('not_assessed');
            setNote('');
            setActionTaken('');

        } catch (err: any) {
            setError(err.message || 'Lead yüklenirken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const [showAppointmentModal, setShowAppointmentModal] = useState(false);
    const [appointmentDate, setAppointmentDate] = useState('');

    const handleWhatsApp = () => {
        if (!currentLead) return;
        const url = getWhatsAppUrl(currentLead.phone_number);
        window.open(url, '_blank');
        setActionTaken('whatsapp_sent');
        playWhatsApp();
    };

    const handleAppointment = () => {
        setShowAppointmentModal(true);
    };

    const confirmAppointment = () => {
        if (!appointmentDate) {
            alert('Lütfen bir tarih ve saat seçin!');
            return;
        }

        const date = new Date(appointmentDate);
        const formattedDate = new Intl.DateTimeFormat('tr-TR', {
            dateStyle: 'full',
            timeStyle: 'short'
        }).format(date);

        const appointmentNote = `📅 Randevu: ${formattedDate}`;

        // Append to existing note or start new
        setNote(prev => {
            const cleanPrev = prev.trim();
            if (cleanPrev) return cleanPrev + '\n\n' + appointmentNote;
            return appointmentNote;
        });

        setActionTaken('appointment_scheduled');
        playAppointment();
        setShowAppointmentModal(false);
    };

    const isFormValid = () => {
        return (
            potentialLevel !== 'not_assessed' &&
            note.trim().length >= 10
        );
    };

    const handleNextLead = async () => {
        if (!currentLead || !isFormValid()) {
            setError('Lütfen tüm alanları doldurun! (Not en az 10 karakter olmalı)');
            playError();
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const response = await fetch(`/api/leads/${currentLead.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: actionTaken === 'appointment_scheduled' ? 'appointment' : 'contacted',
                    potentialLevel,
                    note,
                    actionTaken: actionTaken || undefined, // Send undefined if empty
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Lead güncellenirken hata oluştu');
            }

            // Clear saved lead from localStorage since it's been processed
            localStorage.removeItem(`agent_${agentId}_current_lead`);

            // Success - notify parent and load next lead
            onLeadProcessed();

            // Check if this was the last lead - will be determined in loadNextLead
            // We'll check after loading
            await loadNextLead();

        } catch (err: any) {
            setError(err.message || 'İşlem sırasında bir hata oluştu');
        } finally {
            setProcessing(false);
        }
    };

    const handleRecordingComplete = (audioUrl: string, blob: Blob) => {
        analyzeRecording(audioUrl);
    };

    const analyzeRecording = async (audioUrl: string) => {
        setIsAiProcessing(true);
        try {
            const res = await fetch('/api/ai/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioUrl, leadId: currentLead?.id })
            });
            const data = await res.json();

            if (data.success && data.analysis) {
                // Build comprehensive AI note
                let aiNote = `🤖 **AI SATIŞANALIZI** (ArtificAgent)\n\n`;
                aiNote += `📌 **Özet:** ${data.analysis.summary || 'Analiz yapılamadı'}\n\n`;

                // Customer info
                if (data.analysis.customer_name) {
                    aiNote += `👤 **Müşteri:** ${data.analysis.customer_name}`;
                    if (data.analysis.decision_maker) {
                        aiNote += ` (Karar Verici ✓)`;
                    }
                    aiNote += `\n`;
                }

                // Interested service
                if (data.analysis.interested_service && data.analysis.interested_service !== 'Belirsiz') {
                    aiNote += `🎯 **İlgilenilen Hizmet:** ${data.analysis.interested_service}\n`;
                }

                aiNote += `💡 **Potansiyel:** ${data.analysis.potential_level?.toUpperCase() || 'BELİRLENEMEDİ'}\n`;

                if (data.analysis.sentiment_score) {
                    aiNote += `📊 **Duygu Skoru:** ${data.analysis.sentiment_score}/10\n`;
                }

                // Pain points
                if (data.analysis.pain_points && data.analysis.pain_points.length > 0) {
                    aiNote += `⚡ **Sorun Noktaları:** ${data.analysis.pain_points.join(', ')}\n`;
                }

                if (data.analysis.extracted_date) {
                    aiNote += `📅 **Randevu/Tarih:** ${data.analysis.extracted_date}\n`;
                }

                if (data.analysis.key_objections && data.analysis.key_objections.length > 0) {
                    aiNote += `⚠️ **İtirazlar:** ${data.analysis.key_objections.join(', ')}\n`;
                }

                aiNote += `\n🚀 **Önerilen Aksiyon:** ${data.analysis.suggested_action || 'Manuel inceleme'}\n`;

                if (data.analysis.next_call_timing) {
                    aiNote += `⏰ **Sonraki Arama:** ${data.analysis.next_call_timing}\n`;
                }

                setNote(prev => (prev ? prev + '\n\n' : '') + aiNote);

                // Optionally set potential level if AI determined it
                if (data.analysis.potential_level && data.analysis.potential_level !== 'not_assessed') {
                    setPotentialLevel(data.analysis.potential_level as PotentialLevel);
                }
            } else {
                alert('Analiz hatası: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (e) {
            console.error(e);
            alert('Analysis error');
        } finally {
            setIsAiProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-12 border border-white/20 flex items-center justify-center min-h-[500px]">
                <div className="text-center">
                    <img src="/loading-logo.png" alt="Loading" className="w-24 h-8 animate-pulse mx-auto mb-4 object-contain" />
                    <p className="text-purple-200">Sistem Hazırlanıyor...</p>
                </div>
            </div>
        );
    }

    if (!currentLead) {
        return (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-12 border border-white/20 flex items-center justify-center min-h-[500px]">
                <div className="text-center">
                    <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">Tebrikler!</h3>
                    <p className="text-purple-200">Tüm lead'lerinizi tamamladınız.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">{currentLead.business_name}</h2>
                    <div className="flex items-center gap-2 text-purple-200">
                        <span className="px-3 py-1 bg-purple-500/30 rounded-full text-sm">
                            {currentLead.category || 'Kategori yok'}
                        </span>
                        {currentLead.rating && (
                            <span className="flex items-center gap-1 px-3 py-1 bg-yellow-500/30 rounded-full text-sm">
                                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                {currentLead.rating}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* AI INSIGHT ALERT BANNER - High Visibility Section */}
            {currentLead.potential_level && currentLead.potential_level !== 'not_assessed' && currentLead.potential_level !== 'low' && (
                <div className={`rounded-xl p-4 border-2 ${currentLead.potential_level === 'high'
                        ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-400 animate-pulse'
                        : 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-400'
                    }`}>
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${currentLead.potential_level === 'high' ? 'bg-emerald-500/30' : 'bg-yellow-500/30'
                            }`}>
                            <Wand2 className={`w-6 h-6 ${currentLead.potential_level === 'high' ? 'text-emerald-300' : 'text-yellow-300'
                                }`} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                                🧠 AI TAVSİYESİ
                                {currentLead.potential_level === 'high' && (
                                    <span className="px-2 py-0.5 bg-emerald-500/40 text-emerald-100 text-xs rounded-full animate-pulse">
                                        YÜKSEK POTANSİYEL!
                                    </span>
                                )}
                            </h3>
                            <p className={`text-sm ${currentLead.potential_level === 'high' ? 'text-emerald-100' : 'text-yellow-100'
                                }`}>
                                {currentLead.potential_level === 'high'
                                    ? '⚡ Bu müşteri çok önemli! AI, yüksek satın alma niyeti tespit etti. Öncelikli olarak takip edin!'
                                    : '💡 Bu müşteri potansiyel gösteriyor. AI orta seviye ilgi tespit etti. Yakın takipte kalın.'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}


            {/* Lead Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center gap-2 text-purple-300 mb-2">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm font-medium">Telefon</span>
                    </div>
                    <a
                        href={`tel:${currentLead.phone_number}`}
                        className="text-lg font-semibold text-white hover:text-purple-300 transition-colors"
                    >
                        {formatPhoneNumber(currentLead.phone_number)}
                    </a>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center gap-2 text-purple-300 mb-2">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm font-medium">Adres</span>
                    </div>
                    <p className="text-lg font-semibold text-white truncate">
                        {currentLead.address || 'Adres yok'}
                    </p>
                </div>

                {currentLead.website && (
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10 md:col-span-2">
                        <div className="flex items-center gap-2 text-purple-300 mb-2">
                            <Globe className="w-4 h-4" />
                            <span className="text-sm font-medium">Website</span>
                        </div>
                        <a
                            href={currentLead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lg font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            {currentLead.website}
                        </a>
                    </div>
                )}
            </div>

            {/* Potential Level Selection */}
            <div>
                <label className="block text-sm font-medium text-purple-200 mb-3">
                    Potansiyel Seviyesi <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                    <button
                        onClick={() => setPotentialLevel('high')}
                        className={`p-4 rounded-lg border-2 transition-all ${potentialLevel === 'high'
                            ? 'border-green-400 bg-green-500/20 text-green-100'
                            : 'border-white/20 bg-white/5 text-purple-200 hover:border-green-400/50'
                            }`}
                    >
                        <Flame className="w-6 h-6 mx-auto mb-2" />
                        <div className="font-semibold">Yüksek</div>
                    </button>

                    <button
                        onClick={() => setPotentialLevel('medium')}
                        className={`p-4 rounded-lg border-2 transition-all ${potentialLevel === 'medium'
                            ? 'border-yellow-400 bg-yellow-500/20 text-yellow-100'
                            : 'border-white/20 bg-white/5 text-purple-200 hover:border-yellow-400/50'
                            }`}
                    >
                        <Zap className="w-6 h-6 mx-auto mb-2" />
                        <div className="font-semibold">Orta</div>
                    </button>

                    <button
                        onClick={() => setPotentialLevel('low')}
                        className={`p-4 rounded-lg border-2 transition-all ${potentialLevel === 'low'
                            ? 'border-red-400 bg-red-500/20 text-red-100'
                            : 'border-white/20 bg-white/5 text-purple-200 hover:border-red-400/50'
                            }`}
                    >
                        <TrendingDown className="w-6 h-6 mx-auto mb-2" />
                        <div className="font-semibold">Düşük</div>
                    </button>
                </div>
            </div>

            {/* Voice Recorder */}
            {currentLead && (
                <div className="mb-4">
                    <VoiceRecorder
                        leadId={currentLead.id}
                        onRecordingComplete={handleRecordingComplete}
                    />
                    {isAiProcessing && (
                        <div className="mt-2 text-xs text-purple-300 flex items-center gap-2 animate-pulse">
                            <Wand2 className="w-3 h-3" />
                            Yapay zeka görüşmeyi analiz ediyor...
                        </div>
                    )}
                </div>
            )}

            {/* Note Taking */}
            <div>
                <label htmlFor="note" className="block text-sm font-medium text-purple-200 mb-2">
                    Not <span className="text-red-400">* (Min. 10 karakter)</span>
                </label>
                <textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Görüşme notlarınızı buraya yazın..."
                    rows={4}
                    className={`w-full px-4 py-3 bg-white/10 border rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none ${note.trim().length > 0 && note.trim().length < 10
                        ? 'border-red-500'
                        : 'border-white/20'
                        }`}
                    disabled={processing}
                />
                <p className="text-sm text-purple-300 mt-1">
                    {note.length} / 10 karakter
                </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={handleWhatsApp}
                    disabled={processing}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${actionTaken === 'whatsapp_sent'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-500/20 border-2 border-green-500 text-green-100 hover:bg-green-500/30'
                        }`}
                >
                    <MessageCircle className="w-5 h-5" />
                    WhatsApp'a Yönlendir
                </button>

                <button
                    onClick={handleAppointment}
                    disabled={processing}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${actionTaken === 'appointment_scheduled'
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-500/20 border-2 border-purple-500 text-purple-100 hover:bg-purple-500/30'
                        }`}
                >
                    <Calendar className="w-5 h-5" />
                    Randevuya Çevir
                </button>
            </div>

            {/* Next Lead Button */}
            <button
                onClick={handleNextLead}
                disabled={!isFormValid() || processing}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-lg rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
                {processing ? (
                    <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        İşleniyor...
                    </>
                ) : (
                    <>
                        Sonraki Lead
                        <ArrowRight className="w-6 h-6" />
                    </>
                )}
            </button>
            {/* Appointment Modal */}
            {showAppointmentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-purple-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
                        <button
                            onClick={() => setShowAppointmentModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>

                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-purple-400" />
                            Randevu Planla
                        </h3>

                        <p className="text-purple-200/80 mb-6">
                            Lütfen geri dönüş için bir tarih ve saat seçin. Bu bilgi otomatik olarak notlara eklenecektir.
                        </p>

                        <div className="mb-6 space-y-2">
                            <label className="text-sm font-medium text-purple-200">Tarih ve Saat</label>
                            <input
                                type="datetime-local"
                                value={appointmentDate}
                                onChange={(e) => setAppointmentDate(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark]"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowAppointmentModal(false)}
                                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={confirmAppointment}
                                className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Onayla ve Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
