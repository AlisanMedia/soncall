'use client';

import { useState, useEffect } from 'react';
import { Search, Eye, Loader2, Calendar, Phone, Building2, X, Edit2, Save, XCircle, Plus, DollarSign, Trophy, Hash, FileAudio, Activity, Clock3, MessageSquare, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface Lead {
    id: string;
    lead_number?: number | null;
    business_name: string;
    phone_number: string;
    address: string | null;
    category: string | null;
    status: string;
    potential_level: string;
    appointment_date?: string | null;
    callback_at?: string | null;
    callback_reason?: string | null;
    callback_reminder_10m_sent?: boolean | null;
    processed_at: string | null;
    created_at: string;
    lead_notes: Array<{
        note: string;
        action_taken: string | null;
        created_at: string;
    }>;
}

interface LeadDetail {
    lead: Lead & {
        website?: string | null;
        rating?: number | null;
        ai_summary?: string | null;
        sdr?: { full_name?: string | null; phone_number?: string | null } | null;
        closer?: { full_name?: string | null; phone_number?: string | null } | null;
    };
    summary: {
        call_count: number;
        note_count: number;
        activity_count: number;
        sms_count: number;
        last_call_at: string | null;
        last_activity_at: string | null;
        has_recordings: boolean;
    };
    activities: Array<{
        id: string;
        action: string;
        metadata: Record<string, unknown> | null;
        ai_summary?: string | null;
        ai_score?: number | null;
        created_at: string;
        profiles?: { full_name?: string | null } | null;
    }>;
    call_logs: Array<{
        id: string;
        audio_url: string;
        transcription?: string | null;
        summary?: string | null;
        duration_seconds?: number | null;
        created_at: string;
        profiles?: { full_name?: string | null } | null;
    }>;
    sms_logs: Array<{
        id: string;
        sent_to: string;
        recipient_name?: string | null;
        message_body?: string | null;
        status?: string | null;
        trigger_type?: string | null;
        created_at: string;
    }>;
}

const PAGE_SIZE = 50;

function formatLeadCode(value?: number | null) {
    return value ? `#${String(value).padStart(4, '0')}` : '#----';
}

function formatDateTime(value?: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Bilinmeyen hata';
}

function getTextValue(metadata: Record<string, unknown> | null | undefined, key: string) {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getNumberValue(metadata: Record<string, unknown> | null | undefined, key: string) {
    const value = metadata?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatActionLabel(action: string, metadata?: Record<string, unknown> | null) {
    const actionTaken = getTextValue(metadata, 'action_taken');
    const status = getTextValue(metadata, 'status');
    const meetingOutcome = getTextValue(metadata, 'meeting_outcome');

    if (action === 'completed') {
        switch (actionTaken) {
            case 'appointment_scheduled':
                return 'Randevu oluşturuldu';
            case 'callback_scheduled':
                return 'Tekrar arama planlandı';
            case 'whatsapp_sent':
                return 'WhatsApp ile takip yapıldı';
            case 'not_interested':
                return 'Müşteri ilgilenmedi';
            case 'meeting_won':
                return 'Toplantı satışa döndü';
            case 'meeting_lost':
                return 'Toplantı kaybedildi';
            case 'meeting_no_show':
                return 'Müşteri toplantıya katılmadı';
            case 'meeting_completed':
                return 'Toplantı tamamlandı';
            default:
                return status === 'callback' ? 'Tekrar arama planlandı' : 'Lead işlendi';
        }
    }

    switch (action) {
        case 'viewed':
            return 'Lead ekranda açıldı';
        case 'assigned':
            return 'Lead agente atandı';
        case 'call_recording':
            return 'Görüşme kaydı eklendi';
        case 'call_analyzed':
            return 'Görüşme AI tarafından özetlendi';
        case 'assistant_help':
            return 'Yardımcı agent kullanıldı';
        case 'callback_sms_sent':
            return 'Tekrar arama SMS hatırlatması gönderildi';
        case 'callback_completed':
            return 'Callback görüşmesi tamamlandı';
        case 'reset_to_pool':
            return 'Lead havuza geri alındı';
        case 'REASSIGN_STUCK':
            return 'Lead yeniden atandı';
        case 'manual_update':
            return 'Manuel güncelleme yapıldı';
        case 'lead_created':
            return 'Lead sisteme eklendi';
        default:
            if (meetingOutcome) return 'Toplantı sonucu işlendi';
            return 'Sistem kaydı';
    }
}

function formatSmsTriggerLabel(triggerType?: string | null) {
    switch (triggerType) {
        case '5h_reminder':
            return 'Randevu hatırlatma SMS’i';
        case '1h_reminder':
            return 'Son saat randevu SMS’i';
        case 'callback_10m':
            return 'Tekrar arama hatırlatma SMS’i';
        case 'manual':
            return 'Manuel SMS gönderildi';
        case 'bulk':
            return 'Toplu SMS gönderildi';
        case 'motivation':
            return 'Motivasyon SMS’i';
        case 'inbound':
            return 'Müşteriden SMS geldi';
        default:
            return 'SMS kaydı';
    }
}

function formatSmsStatus(status?: string | null) {
    switch (status) {
        case 'success':
        case 'sent':
        case 'delivered':
            return 'Gönderildi';
        case 'failed':
            return 'Gönderilemedi';
        case 'pending':
            return 'Gönderim bekliyor';
        case 'read':
            return 'Okundu';
        default:
            return status || 'Durum bilinmiyor';
    }
}

function formatMetadataDetails(metadata?: Record<string, unknown> | null) {
    if (!metadata) return '';

    const lines: string[] = [];
    const note = getTextValue(metadata, 'note');
    const question = getTextValue(metadata, 'question');
    const callbackReason = getTextValue(metadata, 'callback_reason');
    const specialist = getTextValue(metadata, 'specialist');
    const selectedLeadSource = getTextValue(metadata, 'selected_lead_source');
    const duration = getNumberValue(metadata, 'duration_seconds');
    const previousStatus = getTextValue(metadata, 'previous_status');
    const status = getTextValue(metadata, 'status');
    const meetingOutcome = getTextValue(metadata, 'meeting_outcome');
    const appointmentDate = getTextValue(metadata, 'appointment_date');
    const callbackAt = getTextValue(metadata, 'callback_at');
    const leadCode = getNumberValue(metadata, 'lead_code');

    if (note) lines.push(note);
    if (question) lines.push(`Sorulan soru: ${question}`);
    if (callbackReason) lines.push(`Geri arama nedeni: ${callbackReason}`);
    if (appointmentDate) lines.push(`Randevu zamanı: ${formatDateTime(appointmentDate)}`);
    if (callbackAt) lines.push(`Tekrar arama zamanı: ${formatDateTime(callbackAt)}`);
    if (duration) lines.push(`Görüşme süresi: ${duration} sn`);
    if (meetingOutcome) lines.push(`Toplantı sonucu: ${formatMeetingOutcome(meetingOutcome)}`);
    if (previousStatus && status) lines.push(`Durum değişimi: ${getStatusLabelSafe(previousStatus)} → ${getStatusLabelSafe(status)}`);
    if (leadCode) lines.push(`Lead kodu: ${formatLeadCode(leadCode)}`);
    if (specialist) lines.push(`Kullanılan uzman: ${formatSpecialistLabel(specialist)}`);
    if (selectedLeadSource === 'code') lines.push('Lead koduyla geçmiş kontrol edildi.');
    if (selectedLeadSource === 'current') lines.push('Aktif lead üzerinden destek alındı.');

    return lines.join('\n');
}

function formatMeetingOutcome(value: string) {
    switch (value) {
        case 'won':
            return 'Satış kapandı';
        case 'lost':
            return 'Satış kaybedildi';
        case 'no_show':
            return 'Müşteri katılmadı';
        case 'completed':
            return 'Görüşme tamamlandı';
        default:
            return value;
    }
}

function formatSpecialistLabel(value: string) {
    switch (value) {
        case 'sdr_coach':
            return 'SDR Operasyon Koçu';
        case 'closer_strategist':
            return 'Closer Toplantı Stratejisti';
        case 'objection_coach':
            return 'İtiraz ve Fiyat Koçu';
        case 'lead_analyst':
            return 'Lead İstihbarat Analisti';
        case 'quality_coach':
            return 'Kalite ve CRM Koçu';
        default:
            return value;
    }
}

function getStatusLabelSafe(status: string) {
    switch (status) {
        case 'appointment': return 'Randevu';
        case 'contacted': return 'Ulaşıldı';
        case 'not_interested': return 'İlgilenmiyor';
        case 'callback': return 'Geri Arama';
        case 'pending': return 'Beklemede';
        case 'in_progress': return 'İşlemde';
        default: return status;
    }
}

export default function LeadHistoryView() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [totalLeads, setTotalLeads] = useState(0);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [selectedLeadDetail, setSelectedLeadDetail] = useState<LeadDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [potentialFilter, setPotentialFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');

    // Edit & Action States
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Lead>>({});
    const [newNote, setNewNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Sale Modal States
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [saleAmount, setSaleAmount] = useState('');
    const [isSubmittingSale, setIsSubmittingSale] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedSearchTerm(searchTerm.trim());
        }, 350);

        return () => window.clearTimeout(timeout);
    }, [searchTerm]);

    useEffect(() => {
        loadLeads(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, potentialFilter, dateFilter, debouncedSearchTerm]);

    async function loadLeads(reset = true) {
        try {
            if (reset) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }
            if (reset) setLoadError(null);

            const params = new URLSearchParams();
            const offset = reset ? 0 : leads.length;

            params.append('limit', String(PAGE_SIZE));
            params.append('offset', String(offset));

            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (potentialFilter !== 'all') params.append('potential_level', potentialFilter);
            if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);

            // Date filters
            if (dateFilter !== 'all') {
                const now = new Date();
                const dateFrom = new Date();

                switch (dateFilter) {
                    case 'today':
                        dateFrom.setHours(0, 0, 0, 0);
                        break;
                    case 'week':
                        dateFrom.setDate(now.getDate() - 7);
                        break;
                    case 'month':
                        dateFrom.setMonth(now.getMonth() - 1);
                        break;
                }

                params.append('date_from', dateFrom.toISOString());
            }

            const response = await fetch(`/api/agent/leads?${params.toString()}`);
            const data = await response.json();

            if (response.ok) {
                const nextLeads = data.leads || [];
                setLeads(prev => reset ? nextLeads : [...prev, ...nextLeads]);
                setTotalLeads(data.total || nextLeads.length);
            } else {
                throw new Error(data.error || 'Leadler yüklenemedi');
            }
        } catch (error) {
            console.error('Error loading leads:', error);
            if (reset) setLoadError('Lead geçmişi yüklenemedi. Lütfen tekrar deneyin.');
            toast.error('Leadler yüklenirken hata oluştu');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    const handleEditClick = () => {
        if (selectedLead) {
            setEditForm({
                status: selectedLead.status,
                potential_level: selectedLead.potential_level
            });
            setIsEditing(true);
        }
    };

    const openLeadDetail = async (lead: Lead) => {
        setSelectedLead(lead);
        setSelectedLeadDetail(null);
        setDetailError(null);
        setDetailLoading(true);

        try {
            const response = await fetch(`/api/agent/leads/${lead.id}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error || 'Lead detayı yüklenemedi');
            }

            setSelectedLeadDetail(data as LeadDetail);
            setSelectedLead((data as LeadDetail).lead);
        } catch (error: unknown) {
            console.error('Lead detail error:', error);
            setDetailError('Lead detayı yüklenemedi. Tekrar deneyin.');
            toast.error('Lead detayı yüklenemedi: ' + getErrorMessage(error));
        } finally {
            setDetailLoading(false);
        }
    };

    const closeLeadDetail = () => {
        setSelectedLead(null);
        setSelectedLeadDetail(null);
        setDetailError(null);
        setDetailLoading(false);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditForm({});
    };

    const handleSaveLead = async () => {
        if (!selectedLead) return;
        setIsSaving(true);
        try {
            // Update Lead Basic Info
            const { error } = await supabase
                .from('leads')
                .update({
                    status: editForm.status,
                    potential_level: editForm.potential_level
                })
                .eq('id', selectedLead.id);

            if (error) throw error;

            toast.success('Lead bilgileri güncellendi');

            // Update local state
            setSelectedLead(prev => prev ? ({ ...prev, ...editForm } as Lead) : null);
            setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...editForm } as Lead : l));
            setIsEditing(false);

        } catch (error: unknown) {
            console.error('Update error:', error);
            toast.error('Güncelleme başarısız: ' + getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddNote = async () => {
        if (!selectedLead || !newNote.trim()) return;
        setIsSaving(true);

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Oturum bulunamadı');

            // Insert into lead_notes table (separate table, not a column in leads)
            const { data: insertedNote, error } = await supabase
                .from('lead_notes')
                .insert({
                    lead_id: selectedLead.id,
                    agent_id: user.id,
                    note: newNote,
                    action_taken: 'Manual Update'
                })
                .select()
                .single();

            if (error) throw error;

            toast.success('Not eklendi');
            setNewNote('');

            // Update local state with new note
            const newNoteObj = {
                note: insertedNote.note,
                action_taken: insertedNote.action_taken,
                created_at: insertedNote.created_at
            };

            setSelectedLead(prev => prev ? ({ ...prev, lead_notes: [...(prev.lead_notes || []), newNoteObj] }) : null);
            setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, lead_notes: [...(l.lead_notes || []), newNoteObj] } : l));

        } catch (error: unknown) {
            console.error('Note add error:', error);
            toast.error('Not eklenemedi: ' + getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleReportSale = async () => {
        if (!selectedLead || !saleAmount || isNaN(Number(saleAmount))) {
            toast.error('Geçerli bir tutar giriniz');
            return;
        }

        setIsSubmittingSale(true);
        try {
            // Get Current User ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Oturum bulunamadı');

            const amount = parseFloat(saleAmount);

            // 1. Insert into Sales table
            const { error: saleError } = await supabase
                .from('sales')
                .insert({
                    lead_id: selectedLead.id,
                    agent_id: user.id, // Profile ID usually matches User ID in Supabase Auth
                    amount: amount,
                    status: 'pending'
                });

            if (saleError) throw saleError;

            // 2. Auto-update lead status to "won" or similar if desired? 
            // Let's keep it manual or update strictly to 'sale_pending' if you have that status.
            // For now just insert sale.

            // Celebration!
            triggerConfetti();
            toast.success('Satış raporlandı! Yönetici onayı bekleniyor. 💸');

            setShowSaleModal(false);
            setSaleAmount('');

        } catch (error: unknown) {
            console.error('Sale report error:', error);
            toast.error('Satış raporlanamadı: ' + getErrorMessage(error));
        } finally {
            setIsSubmittingSale(false);
        }
    };

    const triggerConfetti = () => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 60 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: ReturnType<typeof setInterval> = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti?.({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti?.({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    const hasMoreLeads = leads.length < totalLeads;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'appointment': return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'contacted': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'not_interested': return 'bg-red-500/20 text-red-300 border-red-500/30';
            case 'callback': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'appointment': return 'Randevu';
            case 'contacted': return 'Ulaşıldı';
            case 'not_interested': return 'İlgilenmiyor';
            case 'callback': return 'Geri Arama';
            case 'pending': return 'Beklemede';
            default: return status;
        }
    };

    const getPotentialColor = (level: string) => {
        switch (level) {
            case 'high': return 'bg-green-500/20 text-green-300';
            case 'medium': return 'bg-yellow-500/20 text-yellow-300';
            case 'low': return 'bg-red-500/20 text-red-300';
            default: return 'bg-gray-500/20 text-gray-300';
        }
    };

    const getPotentialLabel = (level: string) => {
        switch (level) {
            case 'high': return 'Yüksek';
            case 'medium': return 'Orta';
            case 'low': return 'Düşük';
            default: return 'Değerlendirilmedi';
        }
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
                <h2 className="mb-2 text-xl font-bold text-white sm:mb-4 sm:text-2xl">Lead Arama ve Geçmiş</h2>
                {!loading && (
                    <p className="text-sm text-purple-200/70 mb-4">
                        {totalLeads > 0
                            ? `${totalLeads} kayıttan ${leads.length} tanesi gösteriliyor`
                            : 'Filtrelere uygun kayıt bulunamadı'}
                    </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/50" />
                        <label htmlFor="lead-history-search" className="sr-only">Lead ara</label>
                        <input
                            id="lead-history-search"
                            type="text"
                            placeholder="#0042, işletme adı veya telefon ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-purple-300/30 focus:outline-none focus:border-purple-500/50"
                        />
                    </div>

                    {/* Status Filter */}
                    <label className="sr-only" htmlFor="lead-history-status">Durum filtresi</label>
                    <select
                        id="lead-history-status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="all">Tüm Durumlar</option>
                        <option value="appointment">Randevu</option>
                        <option value="contacted">Ulaşıldı</option>
                        <option value="not_interested">İlgilenmiyor</option>
                        <option value="callback">Geri Arama</option>
                        <option value="pending">Beklemede</option>
                    </select>

                    {/* Potential Filter */}
                    <label className="sr-only" htmlFor="lead-history-potential">Potansiyel filtresi</label>
                    <select
                        id="lead-history-potential"
                        value={potentialFilter}
                        onChange={(e) => setPotentialFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="all">Tüm Potansiyeller</option>
                        <option value="high">Yüksek</option>
                        <option value="medium">Orta</option>
                        <option value="low">Düşük</option>
                    </select>

                    {/* Date Filter */}
                    <label className="sr-only" htmlFor="lead-history-date">Tarih filtresi</label>
                    <select
                        id="lead-history-date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="all">Tüm Zamanlar</option>
                        <option value="today">Bugün</option>
                        <option value="week">Son 7 Gün</option>
                        <option value="month">Son 30 Gün</option>
                    </select>
                </div>
            </div>

            {/* Results */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {loading ? (
                    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-12 text-sm text-purple-200">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-300/30 border-t-purple-300" />
                        Lead geçmişi yükleniyor…
                    </div>
                ) : loadError ? (
                    <div role="alert" className="p-8 text-center">
                        <Building2 className="mx-auto mb-3 h-10 w-10 text-red-300/70" aria-hidden="true" />
                        <p className="text-sm text-red-100">{loadError}</p>
                        <button
                            type="button"
                            onClick={() => loadLeads(true)}
                            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-purple-300/30 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-100 transition-colors hover:bg-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-300/70"
                        >
                            Tekrar dene
                        </button>
                    </div>
                ) : leads.length === 0 ? (
                    <div role="status" className="p-8 text-center text-purple-300 sm:py-12">
                        <Building2 className="mx-auto mb-4 h-12 w-12 opacity-50" aria-hidden="true" />
                        <p className="font-medium">Filtrelere uygun kayıt bulunamadı.</p>
                        <p className="mt-1 text-sm text-purple-200/60">Arama veya filtreleri değiştirerek tekrar deneyin.</p>
                    </div>
                ) : (
                    <div>
                        <div className="border-b border-white/10 bg-black/10 px-4 py-2 text-xs text-purple-200/60 sm:hidden">
                            Lead kartlarını açmak için ilgili kayda dokunun.
                        </div>
                        <div className="space-y-3 p-3 sm:hidden">
                            {leads.map(lead => (
                                <article key={lead.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-200">
                                                <Hash className="h-3 w-3" aria-hidden="true" />
                                                {formatLeadCode(lead.lead_number).slice(1)}
                                            </span>
                                            <h3 className="mt-2 truncate text-base font-semibold text-white">{lead.business_name}</h3>
                                            <p className="mt-1 flex items-center gap-1 text-sm text-purple-200">
                                                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                                {lead.phone_number}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openLeadDetail(lead)}
                                            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-purple-300/20 bg-purple-500/10 text-purple-100 transition-colors hover:bg-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-300/70"
                                            aria-label={`${lead.business_name} lead dosyasını aç`}
                                        >
                                            <Eye className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <span className={`rounded border px-2 py-1 text-xs font-medium ${getStatusColor(lead.status)}`}>{getStatusLabel(lead.status)}</span>
                                        <span className={`rounded px-2 py-1 text-xs font-medium ${getPotentialColor(lead.potential_level)}`}>{getPotentialLabel(lead.potential_level)}</span>
                                        {lead.lead_notes?.length > 0 && <span className="inline-flex items-center gap-1 rounded border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-xs text-purple-100"><MessageSquare className="h-3 w-3" aria-hidden="true" /> Not var</span>}
                                        {lead.status === 'callback' && <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-100"><Clock3 className="h-3 w-3" aria-hidden="true" /> Tekrar arama</span>}
                                    </div>
                                    <p className="mt-3 text-xs text-gray-400">İşlenme: {formatDateTime(lead.processed_at)}</p>
                                </article>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto sm:block">
                        <table className="w-full min-w-[860px] text-left">
                            <thead className="bg-white/5 text-purple-200 text-sm">
                                <tr>
                                    <th scope="col" className="p-4">Kod</th>
                                    <th scope="col" className="p-4">İşletme</th>
                                    <th scope="col" className="p-4">Telefon</th>
                                    <th scope="col" className="p-4">Durum</th>
                                    <th scope="col" className="p-4">Potansiyel</th>
                                    <th scope="col" className="p-4">Geçmiş</th>
                                    <th scope="col" className="p-4">İşlenme Tarihi</th>
                                    <th scope="col" className="p-4 text-right">Detay</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {leads.map(lead => (
                                    <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-200">
                                                <Hash className="w-3 h-3" />
                                                {formatLeadCode(lead.lead_number).slice(1)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-white font-medium">{lead.business_name}</td>
                                        <td className="p-4 text-purple-200">{lead.phone_number}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(lead.status)}`}>
                                                {getStatusLabel(lead.status)}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPotentialColor(lead.potential_level)}`}>
                                                {getPotentialLabel(lead.potential_level)}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {lead.lead_notes?.length > 0 && (
                                                    <span title="Geçmiş not var" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-200">
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                    </span>
                                                )}
                                                {lead.status === 'callback' && (
                                                    <span title="Tekrar arama planlı" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-200">
                                                        <Clock3 className="w-3.5 h-3.5" />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-400 text-sm">
                                            {formatDateTime(lead.processed_at)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openLeadDetail(lead)}
                                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-purple-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-300/70"
                                                title="Lead dosyasını aç"
                                                aria-label={`${lead.business_name} lead dosyasını aç`}
                                            >
                                                <Eye className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                        {hasMoreLeads && (
                            <div className="flex items-center justify-center border-t border-white/10 bg-black/10 p-4">
                                <button
                                    onClick={() => loadLeads(false)}
                                    disabled={loadingMore}
                                    className="inline-flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-100 transition-colors hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {loadingMore ? 'Yükleniyor...' : 'Daha fazla yükle'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Lead Detail & Edit Modal */}
            {selectedLead && (
                <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4" onClick={closeLeadDetail}>
                    <div role="dialog" aria-modal="true" aria-labelledby="lead-detail-title" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a2e] shadow-2xl sm:max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-white/5 p-4 sm:p-6">
                            <div className="min-w-0">
                                <h3 id="lead-detail-title" className="flex flex-wrap items-center gap-2 text-lg font-bold text-white sm:text-xl">
                                    {selectedLead.business_name}
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-200">
                                        <Hash className="w-3 h-3" />
                                        {formatLeadCode(selectedLead.lead_number).slice(1)}
                                    </span>
                                    {isEditing && <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">DÜZENLENİYOR</span>}
                                </h3>
                                <p className="text-purple-300 text-sm mt-1 flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    {selectedLead.phone_number}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                                {!isEditing ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowSaleModal(true)}
                                            className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-green-500/50 bg-green-600 p-2 text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:bg-green-700 hover:shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                                            title="Satış Bildir"
                                            aria-label="Satış bildir"
                                        >
                                            <Trophy className="w-5 h-5" />
                                            <span className="hidden sm:inline font-bold">Satış Yapıldı</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleEditClick}
                                            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
                                            title="Düzenle"
                                            aria-label="Lead bilgilerini düzenle"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleSaveLead}
                                            disabled={isSaving}
                                            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-purple-500 bg-purple-600 p-2 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            title="Kaydet"
                                            aria-label="Lead değişikliklerini kaydet"
                                        >
                                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-500 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            title="İptal"
                                            aria-label="Düzenlemeyi iptal et"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={closeLeadDetail}
                                    className="ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-300/70 sm:ml-2"
                                    aria-label="Lead detaylarını kapat"
                                >
                                    <X className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                            {detailLoading && (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-purple-200 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Lead dosyası yükleniyor...
                                </div>
                            )}

                            {detailError && (
                                <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                                    <span>{detailError}</span>
                                    <button
                                        type="button"
                                        onClick={() => openLeadDetail(selectedLead)}
                                        className="min-h-11 shrink-0 rounded-lg border border-red-300/30 px-3 py-2 font-semibold text-red-50 transition-colors hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-300/70"
                                    >
                                        Tekrar dene
                                    </button>
                                </div>
                            )}

                            {selectedLeadDetail && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                                        <div className="text-[10px] text-purple-300/60 uppercase mb-1">Arama</div>
                                        <div className="text-xl font-bold text-white">{selectedLeadDetail.summary.call_count}</div>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                                        <div className="text-[10px] text-purple-300/60 uppercase mb-1">Not</div>
                                        <div className="text-xl font-bold text-white">{selectedLeadDetail.summary.note_count}</div>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                                        <div className="text-[10px] text-purple-300/60 uppercase mb-1">Aktivite</div>
                                        <div className="text-xl font-bold text-white">{selectedLeadDetail.summary.activity_count}</div>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                                        <div className="text-[10px] text-purple-300/60 uppercase mb-1">SMS</div>
                                        <div className="text-xl font-bold text-white">{selectedLeadDetail.summary.sms_count}</div>
                                    </div>
                                </div>
                            )}

                            {/* Lead Details Grid */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Kategori</div>
                                    <div className="text-white">{selectedLead.category || '-'}</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Son Arama</div>
                                    <div className="text-white">{formatDateTime(selectedLeadDetail?.summary.last_call_at)}</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Callback</div>
                                    <div className="text-white">{formatDateTime(selectedLead.callback_at)}</div>
                                    {selectedLead.callback_reason && (
                                        <div className="text-xs text-amber-200/80 mt-1 line-clamp-2">{selectedLead.callback_reason}</div>
                                    )}
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Adres</div>
                                    <div className="text-white truncate">{selectedLead.address || '-'}</div>
                                </div>

                                <div className={`p-4 rounded-xl border transition-all ${isEditing ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-white/5 border-white/5'}`}>
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Durum</div>
                                    {isEditing ? (
                                        <select
                                            value={editForm.status}
                                            onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-purple-500 outline-none"
                                        >
                                            <option value="appointment">Randevu</option>
                                            <option value="contacted">Ulaşıldı</option>
                                            <option value="not_interested">İlgilenmiyor</option>
                                            <option value="callback">Geri Arama</option>
                                            <option value="pending">Beklemede</option>
                                        </select>
                                    ) : (
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getStatusColor(selectedLead.status)}`}>
                                            {getStatusLabel(selectedLead.status)}
                                        </span>
                                    )}
                                </div>

                                <div className={`p-4 rounded-xl border transition-all ${isEditing ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-white/5 border-white/5'}`}>
                                    <div className="text-xs text-purple-300/50 uppercase mb-1">Potansiyel</div>
                                    {isEditing ? (
                                        <select
                                            value={editForm.potential_level}
                                            onChange={e => setEditForm({ ...editForm, potential_level: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-purple-500 outline-none"
                                        >
                                            <option value="high">Yüksek</option>
                                            <option value="medium">Orta</option>
                                            <option value="low">Düşük</option>
                                            <option value="unknown">Değerlendirilmedi</option>
                                        </select>
                                    ) : (
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPotentialColor(selectedLead.potential_level)}`}>
                                            {getPotentialLabel(selectedLead.potential_level)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {selectedLeadDetail?.call_logs && selectedLeadDetail.call_logs.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <FileAudio className="w-4 h-4 text-cyan-400" />
                                        Ses Kayıtları
                                    </h4>
                                    <div className="space-y-3">
                                        {selectedLeadDetail.call_logs.map((log) => (
                                            <div key={log.id} className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-white">
                                                            {log.profiles?.full_name || 'Agent'} kaydı
                                                        </p>
                                                        <p className="text-xs text-cyan-200/70">{formatDateTime(log.created_at)}</p>
                                                    </div>
                                                    <span className="text-xs text-cyan-100">
                                                        {log.duration_seconds ? `${log.duration_seconds} sn` : 'Süre yok'}
                                                    </span>
                                                </div>
                                                <audio controls src={log.audio_url} className="w-full" />
                                                {(log.summary || log.transcription) && (
                                                    <details className="mt-3">
                                                        <summary className="cursor-pointer text-xs font-semibold text-cyan-200">Transkript / özet</summary>
                                                        <p className="mt-2 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                                                            {log.summary || log.transcription}
                                                        </p>
                                                    </details>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedLeadDetail && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-emerald-400" />
                                        Uçtan Uca Timeline
                                    </h4>
                                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                                        {[
                                            ...selectedLeadDetail.activities.map(item => ({
                                                id: `activity-${item.id}`,
                                                date: item.created_at,
                                                title: formatActionLabel(item.action, item.metadata),
                                                body: item.ai_summary || formatMetadataDetails(item.metadata),
                                                actor: item.profiles?.full_name || 'Sistem',
                                                tone: 'emerald',
                                            })),
                                            ...selectedLeadDetail.sms_logs.map(item => ({
                                                id: `sms-${item.id}`,
                                                date: item.created_at,
                                                title: formatSmsTriggerLabel(item.trigger_type),
                                                body: [
                                                    `Durum: ${formatSmsStatus(item.status)}`,
                                                    item.message_body ? `Mesaj: ${item.message_body}` : null,
                                                ].filter(Boolean).join('\n'),
                                                actor: item.recipient_name || item.sent_to,
                                                tone: 'amber',
                                            })),
                                        ]
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map((item) => (
                                                <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-bold text-white">{item.title}</p>
                                                        <span className="text-[10px] text-slate-400">{formatDateTime(item.date)}</span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-purple-200/80 flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {item.actor}
                                                    </p>
                                                    {item.body && (
                                                        <p className="mt-2 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap line-clamp-4">{item.body}</p>
                                                    )}
                                                </div>
                                            ))}
                                        {selectedLeadDetail.activities.length === 0 && selectedLeadDetail.sms_logs.length === 0 && (
                                            <div className="text-center py-6 text-gray-500 italic text-sm bg-white/5 rounded-xl border border-white/5 border-dashed">
                                                Timeline kaydı yok.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Notes History */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-purple-400" />
                                        Görüşme Notları
                                    </h4>
                                </div>

                                {/* Add Note - Always visible */}
                                <div className="flex gap-2 items-start">
                                    <textarea
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        placeholder="Yeni not ekle..."
                                        className="flex-1 bg-black/20 border border-white/10 rounded-lg p-3 text-white text-sm placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all resize-none min-h-[60px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddNote}
                                        disabled={!newNote.trim() || isSaving}
                                        className="min-h-11 min-w-11 rounded-lg border border-purple-500/30 bg-purple-600/20 p-3 text-purple-400 transition-all hover:bg-purple-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                        title="Notu Kaydet"
                                        aria-label="Notu kaydet"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {selectedLead.lead_notes && selectedLead.lead_notes.length > 0 ? (
                                        [...selectedLead.lead_notes].reverse().map((note, i) => (
                                            <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                                <p className="text-gray-200 text-sm mb-2 whitespace-pre-wrap leading-relaxed">{note.note}</p>
                                                <div className="flex items-center justify-between mt-2">
                                                    {note.action_taken && (
                                                        <span className="text-purple-400/70 text-[10px] uppercase font-bold tracking-wider bg-purple-500/10 px-2 py-0.5 rounded">
                                                            {note.action_taken}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-gray-500 font-mono ml-auto">
                                                        {new Date(note.created_at).toLocaleString('tr-TR')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-6 text-gray-500 italic text-sm bg-white/5 rounded-xl border border-white/5 border-dashed">
                                            Henüz not eklenmemiş.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/20 text-right shrink-0">
                            <button
                                type="button"
                                onClick={closeLeadDetail}
                                className="min-h-11 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sale Report Modal */}
            {showSaleModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="sale-dialog-title" className="w-full max-w-sm overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900 to-slate-900 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg animate-bounce">
                                <DollarSign className="w-8 h-8 text-white" />
                            </div>
                            <h3 id="sale-dialog-title" className="mb-2 text-2xl font-bold text-white">Tebrikler! 🎉</h3>
                            <p className="text-purple-200 text-sm mb-6">
                                Harika bir haber! Bu satışın tutarı nedir?
                            </p>

                            <div className="relative mb-6">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                                <label htmlFor="sale-amount" className="sr-only">Satış tutarı</label>
                                <input
                                    id="sale-amount"
                                    type="number"
                                    value={saleAmount}
                                    onChange={e => setSaleAmount(e.target.value)}
                                    className="w-full bg-black/40 border border-green-500/30 rounded-xl py-3 pl-10 pr-4 text-white text-xl font-bold text-center focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleReportSale}
                                disabled={isSubmittingSale || !saleAmount}
                                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSubmittingSale ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" /> Kaydediliyor...
                                    </span>
                                ) : (
                                    "✨ Satışı Bildir"
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowSaleModal(false)}
                                disabled={isSubmittingSale}
                                className="mt-4 text-sm text-gray-400 hover:text-white underline-offset-4 hover:underline"
                            >
                                Vazgeç
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
