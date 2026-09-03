'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Lead, PotentialLevel, Profile } from '@/types';
import {
    Phone, MapPin, Globe, Star, Sparkles, Calendar,
    ArrowRight, Loader2, CheckCircle2, AlertCircle, Flame, Zap, TrendingDown, Wand2, Hash, Copy, Clock3, RotateCcw, XCircle
} from 'lucide-react';
import { getWhatsAppUrl, formatPhoneNumber } from '@/lib/utils';
import { playLeadTransition, playAppointment, playWhatsApp, playVictory, playError } from '@/lib/sounds';
import VoiceRecorder from './VoiceRecorder';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { GlassButton } from '@/components/ui/glass-button';
import AIAnalysisDisplay, { type AIAnalysis } from './AIAnalysisDisplay';

interface LeadCardProps {
    agentId: string;
    profile: Profile;
    onLeadProcessed: () => void;
    refreshKey: number;
}

type CloserOption = Pick<Profile, 'id' | 'full_name' | 'email'>;
type MeetingOutcome = 'won' | 'lost' | 'no_show' | 'completed' | '';

function toDatetimeLocalValue(date: Date) {
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function LeadCard({ agentId, profile, onLeadProcessed, refreshKey }: LeadCardProps) {
    const [currentLead, setCurrentLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [potentialLevel, setPotentialLevel] = useState<PotentialLevel>('not_assessed');
    const [note, setNote] = useState('');

    const [actionTaken, setActionTaken] = useState<string>('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
    const [callCount, setCallCount] = useState(0);
    const [closers, setClosers] = useState<CloserOption[]>([]);
    const [appointmentCloserId, setAppointmentCloserId] = useState('');
    const [meetingUrl, setMeetingUrl] = useState('');
    const [meetingOutcome, setMeetingOutcome] = useState<MeetingOutcome>('');

    const supabase = createClient();
    const lastPlayedLeadId = useRef<string | null>(null);
    const currentLeadStorageKey = `agent_${agentId}_current_lead`;
    const currentLeadSourceKey = `agent_${agentId}_current_lead_source`;
    const isCloser = profile.sales_role === 'closer';
    const leadCodeLabel = currentLead?.lead_number ? `#${String(currentLead.lead_number).padStart(4, '0')}` : null;

    const copyLeadCode = async () => {
        if (!leadCodeLabel || typeof navigator === 'undefined') return;

        try {
            await navigator.clipboard?.writeText(leadCodeLabel);
        } catch {
            // Clipboard is optional; the visible code is still usable.
        }
    };

    // Clear AI analysis when lead changes
    useEffect(() => {
        setAiAnalysis(null);
        if (currentLead?.id) {
            // Fetch call count
            supabase
                .from('lead_activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('lead_id', currentLead.id)
                .in('action', ['call_recording', 'completed'])
                .then(({ count }) => setCallCount(count || 0));
        }
    }, [currentLead?.id]);

    useEffect(() => {
        if (isCloser) return;

        supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'agent')
            .eq('sales_role', 'closer')
            .order('full_name')
            .then(({ data, error }) => {
                if (error) {
                    setClosers([]);
                    return;
                }

                setClosers(data || []);
            });
    }, [isCloser]);

    // Load lead on mount - check localStorage first for persistence across page refreshes
    useEffect(() => {
        const restoreFromStorage = async () => {
            const requestedLeadId = new URLSearchParams(window.location.search).get('leadId');
            const hasValidRequestedLead = requestedLeadId && !['undefined', 'null'].includes(requestedLeadId);
            const savedLeadId = hasValidRequestedLead ? requestedLeadId : localStorage.getItem(currentLeadStorageKey);
            const savedLeadSource = hasValidRequestedLead ? 'appointment' : localStorage.getItem(currentLeadSourceKey);

            if (hasValidRequestedLead) {
                localStorage.setItem(currentLeadStorageKey, requestedLeadId);
                localStorage.setItem(currentLeadSourceKey, 'appointment');
                window.history.replaceState(null, '', window.location.pathname);
            }

            if (savedLeadId) {
                // Try to restore the saved lead
                try {
                    let savedLeadQuery = supabase
                        .from('leads')
                        .select('*')
                        .eq('id', savedLeadId)
                        .or(`assigned_to.eq.${agentId},sdr_id.eq.${agentId},closer_id.eq.${agentId}`);

                    if (savedLeadSource !== 'appointment') {
                        savedLeadQuery = savedLeadQuery.in('status', ['pending', 'appointment', 'callback']);
                    }

                    const { data: savedLead, error } = await savedLeadQuery.maybeSingle();

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
                        setPotentialLevel(savedLead.potential_level || 'not_assessed');
                        setNote('');
                        setActionTaken('');
                        setSavedAudioUrl(null);
                        setAppointmentCloserId('');
                        setMeetingUrl(savedLead.meeting_url || '');
                        setMeetingOutcome('');
                        setCallbackDate(savedLead.callback_at ? toDatetimeLocalValue(new Date(savedLead.callback_at)) : '');
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

            // SDRs work cold leads; closers work scheduled meetings.
            let nextLeadQuery = supabase
                .from('leads')
                .select('*')
                .is('current_agent_id', null)
                .limit(1);

            nextLeadQuery = isCloser
                ? nextLeadQuery
                    .eq('closer_id', agentId)
                    .eq('meeting_status', 'scheduled')
                    .not('appointment_date', 'is', null)
                    .order('appointment_date')
                : nextLeadQuery
                    .eq('assigned_to', agentId)
                    .or(`status.eq.pending,and(status.eq.callback,callback_at.lte.${new Date().toISOString()})`)
                    .order('callback_at', { ascending: true, nullsFirst: false })
                    .order('created_at');

            const { data: leads, error: fetchError } = await nextLeadQuery;

            if (fetchError) throw fetchError;

            if (!leads || leads.length === 0) {
                // Clear localStorage since there are no more leads
                localStorage.removeItem(currentLeadStorageKey);
                localStorage.removeItem(currentLeadSourceKey);

                setCurrentLead(null);
                setLoading(false);
                // Play victory sound when all leads are completed!
                playVictory();
                return;
            }

            const lead = leads[0];

            // Lock this lead only if it is still available. This prevents duplicate work
            // when the same agent opens multiple tabs or devices at the same time.
            const { data: lockedLead, error: lockError } = await supabase
                .from('leads')
                .update({
                    current_agent_id: agentId,
                    locked_at: new Date().toISOString(),
                })
                .eq('id', lead.id)
                .is('current_agent_id', null)
                .select('*')
                .maybeSingle();

            if (lockError) throw lockError;
            if (!lockedLead) {
                await loadNextLead();
                return;
            }

            // Log 'viewed' action for handle time tracking
            // Log 'viewed' action via API to avoid RLS issues
            await fetch('/api/agent/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: lead.id,
                    action: 'viewed',
                    metadata: { source: 'agent_dashboard' }
                })
            });

            setCurrentLead(lockedLead);

            // Save to localStorage for persistence across page refreshes
            localStorage.setItem(currentLeadStorageKey, lockedLead.id);
            localStorage.removeItem(currentLeadSourceKey);

            // Play sound for new lead if not already played for this lead
            if (lastPlayedLeadId.current !== lockedLead.id) {
                playLeadTransition();
                lastPlayedLeadId.current = lockedLead.id;
            }

            // Reset form
            setPotentialLevel('not_assessed');
            setNote('');
            setActionTaken('');
            setSavedAudioUrl(null); // Reset audio url
            setAppointmentCloserId('');
            setMeetingUrl('');
            setMeetingOutcome('');
            setCallbackDate('');

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Lead yüklenirken bir hata oluştu';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const [showAppointmentModal, setShowAppointmentModal] = useState(false);
    const [showCallbackModal, setShowCallbackModal] = useState(false);
    const [appointmentDate, setAppointmentDate] = useState('');
    const [callbackDate, setCallbackDate] = useState('');

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

    const handleCallback = () => {
        setShowCallbackModal(true);
    };

    const confirmAppointment = () => {
        if (!appointmentDate) {
            alert('Lütfen bir tarih ve saat seçin!');
            return;
        }

        if (!appointmentCloserId) {
            alert('Lütfen toplantıyı devralacak closer seçin!');
            return;
        }

        const cleanMeetingUrl = meetingUrl.trim();
        if (!cleanMeetingUrl) {
            alert('Lütfen Google Meet linkini girin!');
            return;
        }

        if (!/^https:\/\/meet\.google\.com\//i.test(cleanMeetingUrl)) {
            alert('Lütfen geçerli bir Google Meet linki girin!');
            return;
        }

        const date = new Date(appointmentDate);
        const formattedDate = new Intl.DateTimeFormat('tr-TR', {
            dateStyle: 'full',
            timeStyle: 'short'
        }).format(date);

        const appointmentNote = `📅 Randevu: ${formattedDate}`;

        const closer = closers.find(item => item.id === appointmentCloserId);
        const appointmentDetails = [
            appointmentNote,
            closer ? `Closer: ${closer.full_name}` : null,
            `Google Meet: ${cleanMeetingUrl}`,
        ].filter(Boolean).join('\n');

        // Append to existing note or start new
        setNote(prev => {
            const cleanPrev = prev.trim();
            if (cleanPrev) return cleanPrev + '\n\n' + appointmentDetails;
            return appointmentDetails;
        });

        setActionTaken('appointment_scheduled');
        playAppointment();
        setShowAppointmentModal(false);
    };

    const confirmCallback = () => {
        if (!callbackDate) {
            alert('Lütfen tekrar arama tarih ve saatini seçin!');
            return;
        }

        const date = new Date(callbackDate);
        if (Number.isNaN(date.getTime())) {
            alert('Lütfen geçerli bir tekrar arama zamanı seçin!');
            return;
        }

        const formattedDate = new Intl.DateTimeFormat('tr-TR', {
            dateStyle: 'full',
            timeStyle: 'short'
        }).format(date);

        const callbackDetails = `⏰ Tekrar Arama: ${formattedDate}`;

        setNote(prev => {
            const cleanPrev = prev.trim();
            if (cleanPrev) return cleanPrev + '\n\n' + callbackDetails;
            return callbackDetails;
        });

        setActionTaken('callback_scheduled');
        playAppointment();
        setShowCallbackModal(false);
    };

    const isFormValid = () => {
        if (isCloser) {
            return meetingOutcome.length > 0 && note.trim().length >= 10;
        }

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
                    status: isCloser ? 'appointment' : actionTaken === 'appointment_scheduled' ? 'appointment' : actionTaken === 'callback_scheduled' ? 'callback' : 'contacted',
                    potentialLevel: isCloser ? (currentLead.potential_level || 'medium') : potentialLevel,
                    note,
                    actionTaken: isCloser ? `meeting_${meetingOutcome}` : actionTaken || undefined,
                    appointmentDate: actionTaken === 'appointment_scheduled' ? new Date(appointmentDate).toISOString() : null,
                    closerId: actionTaken === 'appointment_scheduled' ? appointmentCloserId || null : null,
                    meetingUrl: actionTaken === 'appointment_scheduled' ? meetingUrl.trim() || null : null,
                    meetingOutcome: isCloser ? meetingOutcome : null,
                    callbackAt: actionTaken === 'callback_scheduled' ? new Date(callbackDate).toISOString() : null,
                    callbackReason: actionTaken === 'callback_scheduled' ? note : null,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Lead güncellenirken hata oluştu');
            }

            // Save call recording metadata if available
            if (savedAudioUrl) {
                if (savedAudioUrl) {
                    // Log via API to avoid RLS issues
                    await fetch('/api/agent/activity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            lead_id: currentLead.id,
                            action: 'call_recording',
                            metadata: {
                                recording_url: savedAudioUrl,
                                source: 'agent_dashboard'
                            }
                        })
                    });
                }
            }

            // Clear saved lead from localStorage since it's been processed
            localStorage.removeItem(currentLeadStorageKey);
            localStorage.removeItem(currentLeadSourceKey);

            // Success - notify parent and load next lead
            onLeadProcessed();

            // Check if this was the last lead - will be determined in loadNextLead
            // We'll check after loading
            await loadNextLead();

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'İşlem sırasında bir hata oluştu';
            setError(message);
        } finally {
            setProcessing(false);
        }
    };

    const handleRecordingComplete = (audioUrl: string, _blob: Blob, durationSeconds: number) => {
        setSavedAudioUrl(audioUrl);
        analyzeRecording(audioUrl, durationSeconds);
    };

    const analyzeRecording = async (audioUrl: string, durationSeconds: number) => {
        setIsAiProcessing(true);
        try {
            const res = await fetch('/api/ai/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioUrl, leadId: currentLead?.id, durationSeconds })
            });
            const data = await res.json();

            if (data.success && data.analysis) {
                // Store analysis data for display component
                setAiAnalysis(data.analysis);

                if (data.analysis.next_action_type === 'callback' && data.analysis.extracted_date) {
                    const callbackTime = new Date(data.analysis.extracted_date);
                    if (!Number.isNaN(callbackTime.getTime())) {
                        setActionTaken('callback_scheduled');
                        setCallbackDate(toDatetimeLocalValue(callbackTime));
                    }
                }

                if (data.analysis.next_action_type === 'appointment' && data.analysis.extracted_date) {
                    const extractedAppointment = new Date(data.analysis.extracted_date);
                    if (!Number.isNaN(extractedAppointment.getTime())) {
                        setAppointmentDate(toDatetimeLocalValue(extractedAppointment));
                    }
                }

                // Format summary nicely for notes
                let formattedNote = '📝 AI ANALİZ ÖZETİ\n';
                formattedNote += '─'.repeat(40) + '\n';
                if (data.analysis.summary) {
                    formattedNote += data.analysis.summary + '\n';
                }
                formattedNote += '─'.repeat(40) + '\n';
                formattedNote += `Analiz Zamanı: ${new Date().toLocaleString('tr-TR')}`;

                setNote(prev => (prev ? prev + '\n\n' : '') + formattedNote);

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
            <div className="glass-card flex min-h-[360px] items-center justify-center p-6 sm:min-h-[500px] sm:p-12 animate-scale-in">
                <div className="text-center">
                    <img src="/loading-logo.png" alt="Loading" className="w-24 h-8 animate-pulse mx-auto mb-4 object-contain" />
                    <p className="text-zinc-400">Sistem Hazırlanıyor...</p>
                </div>
            </div>
        );
    }

    if (!currentLead) {
        return (
            <div className="glass-card p-12 flex items-center justify-center min-h-[500px] animate-scale-in">
                <div className="text-center">
                    <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">
                        {isCloser ? 'Bekleyen Toplantı Yok' : 'Tebrikler!'}
                    </h3>
                    <p className="text-zinc-400">
                        {isCloser ? 'Size atanmış sonuçlanmamış toplantı görünmüyor.' : 'Tüm lead&apos;lerinizi tamamladınız.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card glass-card-hover relative space-y-4 p-4 sm:space-y-6 sm:p-8 animate-fade-in-up">
            <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} borderWidth={3} />
            {/* Header */}
            <div className="flex min-w-0 items-start justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h2 className="min-w-0 break-words text-2xl font-bold leading-tight text-white sm:text-3xl">{currentLead.business_name}</h2>
                        {leadCodeLabel && (
                            <button
                                type="button"
                                onClick={copyLeadCode}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 text-xs font-bold text-cyan-100 transition-colors hover:border-cyan-300/60 hover:bg-cyan-500/20"
                                title="Yardımcı agent lead kodu"
                            >
                                <Hash className="h-3.5 w-3.5" />
                                <span>{leadCodeLabel.slice(1)}</span>
                                <Copy className="h-3 w-3 opacity-70" />
                            </button>
                        )}
                        {callCount > 0 && (
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-sm font-bold animate-pulse">
                                {callCount + 1}. ARAMA
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-purple-200">
                        <span className="max-w-full truncate rounded-full bg-purple-500/30 px-3 py-1 text-sm">
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className={`p-2 rounded-lg ${currentLead.potential_level === 'high' ? 'bg-emerald-500/30' : 'bg-yellow-500/30'
                            }`}>
                            <Wand2 className={`w-6 h-6 ${currentLead.potential_level === 'high' ? 'text-emerald-300' : 'text-yellow-300'
                                }`} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="mb-1 flex flex-wrap items-center gap-2 text-base font-bold text-white sm:text-lg">
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


            {/* Lead Info - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center gap-2 text-purple-300 mb-2">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm font-medium">Telefon</span>
                    </div>
                    <a
                        href={`tel:${currentLead.phone_number}`}
                        className="text-lg font-semibold text-white hover:text-purple-300 transition-colors block py-1 touch-target"
                    >
                        {formatPhoneNumber(currentLead.phone_number)}
                    </a>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center gap-2 text-purple-300 mb-2">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm font-medium">Adres</span>
                    </div>
                    <p className="text-base sm:text-lg font-semibold text-white line-clamp-2">
                        {currentLead.address || 'Adres yok'}
                    </p>
                </div>

                {currentLead.website && (
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10 sm:col-span-2">
                        <div className="flex items-center gap-2 text-purple-300 mb-2">
                            <Globe className="w-4 h-4" />
                            <span className="text-sm font-medium">Website</span>
                        </div>
                        <a
                            href={currentLead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base sm:text-lg font-semibold text-purple-400 hover:text-purple-300 transition-colors break-all block py-1 touch-target"
                        >
                            {currentLead.website}
                        </a>
                    </div>
                )}
            </div>

            {/* Potential Level Selection - Touch-Optimized */}
            <div className={isCloser ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-purple-200 mb-3">
                    Potansiyel Seviyesi <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2 xs:grid-cols-3 sm:gap-3">
                    <GlassButton
                        onClick={() => setPotentialLevel('high')}
                        className={`transition-all touch-target h-auto ${potentialLevel === 'high'
                            ? '[&>.glass-button]:!bg-green-500/20 [&>.glass-button]:!border-green-400 [&>.glass-button]:!text-green-100'
                            : '[&>.glass-button]:!bg-white/5 [&>.glass-button]:!border-white/20 [&>.glass-button]:!text-purple-200 hover:[&>.glass-button]:!border-green-400/50'
                            }`}
                        contentClassName="flex flex-col items-center justify-center p-3 sm:p-4 w-full h-full"
                    >
                        <Flame className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                        <div className="font-semibold text-sm sm:text-base">Yüksek</div>
                    </GlassButton>

                    <GlassButton
                        onClick={() => setPotentialLevel('medium')}
                        className={`transition-all touch-target h-auto ${potentialLevel === 'medium'
                            ? '[&>.glass-button]:!bg-yellow-500/20 [&>.glass-button]:!border-yellow-400 [&>.glass-button]:!text-yellow-100'
                            : '[&>.glass-button]:!bg-white/5 [&>.glass-button]:!border-white/20 [&>.glass-button]:!text-purple-200 hover:[&>.glass-button]:!border-yellow-400/50'
                            }`}
                        contentClassName="flex flex-col items-center justify-center p-3 sm:p-4 w-full h-full"
                    >
                        <Zap className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                        <div className="font-semibold text-sm sm:text-base">Orta</div>
                    </GlassButton>

                    <GlassButton
                        onClick={() => setPotentialLevel('low')}
                        className={`transition-all touch-target h-auto ${potentialLevel === 'low'
                            ? '[&>.glass-button]:!bg-red-500/20 [&>.glass-button]:!border-red-400 [&>.glass-button]:!text-red-100'
                            : '[&>.glass-button]:!bg-white/5 [&>.glass-button]:!border-white/20 [&>.glass-button]:!text-purple-200 hover:[&>.glass-button]:!border-red-400/50'
                            }`}
                        contentClassName="flex flex-col items-center justify-center p-3 sm:p-4 w-full h-full"
                    >
                        <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                        <div className="font-semibold text-sm sm:text-base">Düşük</div>
                    </GlassButton>
                </div>
            </div>

            {/* Voice Recorder */}
            {currentLead && !isCloser && (
                <div className="mb-4">
                    <VoiceRecorder
                        leadId={currentLead.id}
                        onRecordingComplete={handleRecordingComplete}
                        isProcessing={isAiProcessing}
                    />
                    {isAiProcessing && (
                        <div className="mt-2 text-xs text-purple-300 flex items-center gap-2 animate-pulse">
                            <Wand2 className="w-3 h-3" />
                            Yapay zeka analiz ediyor...
                        </div>
                    )}
                </div>
            )}

            {/* AI Analysis Display */}
            {aiAnalysis && !isCloser && (
                <div className="mb-4">
                    <AIAnalysisDisplay
                        analysis={aiAnalysis}
                    />
                </div>
            )}

            {isCloser && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Toplantı Operasyonu</h3>
                        <p className="text-sm text-emerald-200/80">Closer görevi: toplantıya katıl, sonucu kaydet ve satış sürecini kapat.</p>
                    </div>
                    {currentLead.meeting_url && (
                        <a
                            href={currentLead.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
                        >
                            Google Meet Toplantısına Gir
                        </a>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-emerald-100 mb-2">
                            Toplantı Sonucu <span className="text-red-300">*</span>
                        </label>
                        <select
                            value={meetingOutcome}
                            onChange={(event) => setMeetingOutcome(event.target.value as MeetingOutcome)}
                            className="w-full rounded-lg border border-white/20 bg-black/30 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="">Sonuç seçin</option>
                            <option value="won">Satış kapandı</option>
                            <option value="lost">Satış kapanmadı</option>
                            <option value="no_show">Müşteri katılmadı</option>
                            <option value="completed">Toplantı tamamlandı, takip gerekli</option>
                        </select>
                    </div>
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

            {/* Action Buttons - Mobile Optimized */}
            <div className={`grid grid-cols-1 xs:grid-cols-3 gap-3 sm:gap-4 ${isCloser ? 'hidden' : ''}`}>
                <GlassButton
                    onClick={handleWhatsApp}
                    disabled={processing}
                    className={`transition-all touch-target ${actionTaken === 'whatsapp_sent'
                        ? '[&>.glass-button]:!bg-green-600 [&>.glass-button]:text-white'
                        : '[&>.glass-button]:!bg-green-500/20 [&>.glass-button]:!border-green-500 [&>.glass-button]:text-green-100 hover:[&>.glass-button]:!bg-green-500/30'
                        }`}
                    contentClassName="flex items-center justify-center gap-2 py-3 sm:py-4 px-4 sm:px-6 font-semibold"
                >
                    <Sparkles className="w-5 h-5" />
                    <span className="text-sm sm:text-base">WhatsApp&apos;a Yönlendir</span>
                </GlassButton>

                <GlassButton
                    onClick={handleAppointment}
                    disabled={processing}
                    className={`transition-all touch-target ${actionTaken === 'appointment_scheduled'
                        ? '[&>.glass-button]:!bg-purple-600 [&>.glass-button]:text-white'
                        : '[&>.glass-button]:!bg-purple-500/20 [&>.glass-button]:!border-purple-500 [&>.glass-button]:text-purple-100 hover:[&>.glass-button]:!bg-purple-500/30'
                        }`}
                    contentClassName="flex items-center justify-center gap-2 py-3 sm:py-4 px-4 sm:px-6 font-semibold"
                >
                    <Calendar className="w-5 h-5" />
                    <span className="text-sm sm:text-base">Randevuya Çevir</span>
                </GlassButton>

                <GlassButton
                    onClick={handleCallback}
                    disabled={processing}
                    className={`transition-all touch-target ${actionTaken === 'callback_scheduled'
                        ? '[&>.glass-button]:!bg-amber-600 [&>.glass-button]:text-white'
                        : '[&>.glass-button]:!bg-amber-500/20 [&>.glass-button]:!border-amber-500 [&>.glass-button]:text-amber-100 hover:[&>.glass-button]:!bg-amber-500/30'
                        }`}
                    contentClassName="flex items-center justify-center gap-2 py-3 sm:py-4 px-4 sm:px-6 font-semibold"
                >
                    <RotateCcw className="w-5 h-5" />
                    <span className="text-sm sm:text-base">Tekrar Ara</span>
                </GlassButton>
            </div>

            {/* Next Lead Button - Mobile Optimized */}
            {/* Next Lead Button - Mobile Optimized */}
            <GlassButton
                onClick={handleNextLead}
                disabled={!isFormValid() || processing}
                className="w-full shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-target-large"
                contentClassName="flex items-center justify-center gap-3 py-4 sm:py-5 px-6 font-bold text-base sm:text-lg text-white"
                size="lg"
            >
                {processing ? (
                    <>
                        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                        <span>İşleniyor...</span>
                    </>
                ) : (
                    <>
                        <span>{isCloser ? 'Toplantıyı Kaydet' : 'Sonraki Lead'}</span>
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </>
                )}
            </GlassButton>
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

                        <div className="mb-6 space-y-2">
                            <label className="text-sm font-medium text-purple-200">Closer</label>
                            <select
                                value={appointmentCloserId}
                                onChange={(e) => setAppointmentCloserId(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">Closer seçin</option>
                                {closers.map((closer) => (
                                    <option key={closer.id} value={closer.id}>
                                        {closer.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-6 space-y-2">
                            <label className="text-sm font-medium text-purple-200">Google Meet Linki</label>
                            <input
                                type="url"
                                value={meetingUrl}
                                onChange={(e) => setMeetingUrl(e.target.value)}
                                placeholder="https://meet.google.com/..."
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        <div className="flex gap-3">
                            <GlassButton
                                onClick={() => setShowAppointmentModal(false)}
                                className="flex-1 [&>.glass-button]:!bg-white/5 hover:[&>.glass-button]:!bg-white/10"
                                contentClassName="py-3 px-4 text-white font-medium"
                            >
                                İptal
                            </GlassButton>
                            <GlassButton
                                onClick={confirmAppointment}
                                className="flex-1 [&>.glass-button]:!bg-purple-600 hover:[&>.glass-button]:!bg-purple-700 shadow-lg hover:shadow-purple-500/25"
                                contentClassName="flex items-center justify-center gap-2 py-3 px-4 text-white font-bold"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Onayla ve Ekle
                            </GlassButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Callback Modal */}
            {showCallbackModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
                        <button
                            onClick={() => setShowCallbackModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                            aria-label="Kapat"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Clock3 className="w-6 h-6 text-amber-400" />
                            Tekrar Arama Planla
                        </h3>

                        <p className="text-amber-100/80 mb-6">
                            Bu müşteri toplantı değil, telefonla tekrar aranacaksa tarih ve saat seçin. Sistem 10 dakika önce agent’a SMS gönderecek.
                        </p>

                        <div className="mb-6 space-y-2">
                            <label className="text-sm font-medium text-amber-100">Tekrar Arama Zamanı</label>
                            <input
                                type="datetime-local"
                                value={callbackDate}
                                onChange={(e) => setCallbackDate(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 [color-scheme:dark]"
                            />
                        </div>

                        <div className="flex gap-3">
                            <GlassButton
                                onClick={() => setShowCallbackModal(false)}
                                className="flex-1 [&>.glass-button]:!bg-white/5 hover:[&>.glass-button]:!bg-white/10"
                                contentClassName="py-3 px-4 text-white font-medium"
                            >
                                İptal
                            </GlassButton>
                            <GlassButton
                                onClick={confirmCallback}
                                className="flex-1 [&>.glass-button]:!bg-amber-600 hover:[&>.glass-button]:!bg-amber-700 shadow-lg hover:shadow-amber-500/25"
                                contentClassName="flex items-center justify-center gap-2 py-3 px-4 text-white font-bold"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Hatırlatma Kur
                            </GlassButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
