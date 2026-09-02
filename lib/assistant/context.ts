import type { SupabaseClient } from '@supabase/supabase-js';

type JsonRecord = Record<string, unknown>;

type AssistantProfile = {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
    sales_role?: 'sdr' | 'closer' | null;
    market_id?: string | null;
};

type AssistantLeadNote = {
    note?: string | null;
    action_taken?: string | null;
    created_at?: string | null;
};

type AssistantLeadActivity = {
    action?: string | null;
    metadata?: JsonRecord | null;
    created_at?: string | null;
    profiles?: {
        full_name?: string | null;
    } | null;
};

type AssistantLead = {
    id: string;
    lead_number?: number | null;
    business_name?: string | null;
    phone_number?: string | null;
    category?: string | null;
    address?: string | null;
    website?: string | null;
    rating?: number | null;
    raw_data?: JsonRecord | null;
    status?: string | null;
    potential_level?: string | null;
    assigned_to?: string | null;
    sdr_id?: string | null;
    closer_id?: string | null;
    appointment_date?: string | null;
    callback_at?: string | null;
    callback_reason?: string | null;
    callback_reminder_10m_sent?: boolean | null;
    meeting_url?: string | null;
    meeting_status?: string | null;
    processed_at?: string | null;
    created_at?: string | null;
    ai_summary?: string | null;
    next_action_date?: string | null;
    ai_sentiment?: string | null;
    lead_notes?: AssistantLeadNote[] | null;
    market_id?: string | null;
};

type AssistantGoal = {
    target_sales?: number | null;
    target_calls?: number | null;
    current_sales?: number | null;
    current_calls?: number | null;
};

type AssistantActivity = {
    action?: string | null;
    metadata?: JsonRecord | null;
    created_at?: string | null;
    leads?: {
        business_name?: string | null;
        status?: string | null;
        potential_level?: string | null;
    } | null;
};

type BuildAssistantContextOptions = {
    currentLeadId?: string | null;
    leadCode?: number | null;
    question?: string | null;
};

export type AssistantContext = {
    profile: AssistantProfile | null;
    currentLead: AssistantLead | null;
    selectedLead: AssistantLead | null;
    selectedLeadActivities: AssistantLeadActivity[];
    selectedLeadResearch: string | null;
    selectedLeadSource: 'code' | 'current' | 'none';
    upcomingAppointments: AssistantLead[];
    todayCompletedCount: number;
    todayAppointmentCount: number;
    todayMeetingOutcomeCount: number;
    remainingWorkCount: number;
    goal: AssistantGoal | null;
    recentActivities: AssistantActivity[];
    contextText: string;
};

const PRIVILEGED_ROLES = new Set(['manager', 'admin', 'founder']);

const LEAD_SELECT_WITH_PIPELINE = `
    id,
    lead_number,
    market_id,
    business_name,
    phone_number,
    category,
    address,
    website,
    rating,
    raw_data,
    status,
    potential_level,
    assigned_to,
    sdr_id,
    closer_id,
    appointment_date,
    callback_at,
    callback_reason,
    callback_reminder_10m_sent,
    meeting_url,
    meeting_status,
    processed_at,
    created_at,
    ai_summary,
    next_action_date,
    ai_sentiment,
    lead_notes (
        note,
        action_taken,
        created_at
    )
`;

const LEAD_SELECT_LEGACY = `
    id,
    lead_number,
    market_id,
    business_name,
    phone_number,
    category,
    address,
    website,
    rating,
    raw_data,
    status,
    potential_level,
    assigned_to,
    appointment_date,
    callback_at,
    callback_reason,
    callback_reminder_10m_sent,
    processed_at,
    created_at,
    ai_summary,
    next_action_date,
    ai_sentiment,
    lead_notes (
        note,
        action_taken,
        created_at
    )
`;

export function extractLeadCodeFromText(text: string) {
    const explicitCode = text.match(/(?:^|\s)#\s*(?:SC-?)?(\d{1,10})\b/i)
        || text.match(/\bSC-?(\d{1,10})\b/i);

    if (!explicitCode?.[1]) return null;

    const parsed = Number.parseInt(explicitCode[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function monthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function startOfTodayIso() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
}

function isPrivileged(profile: AssistantProfile | null) {
    return Boolean(profile?.role && PRIVILEGED_ROLES.has(profile.role));
}

function ownershipFilter(userId: string) {
    return `assigned_to.eq.${userId},sdr_id.eq.${userId},closer_id.eq.${userId},current_agent_id.eq.${userId}`;
}

function legacyOwnershipFilter(userId: string) {
    return `assigned_to.eq.${userId},current_agent_id.eq.${userId}`;
}

function formatDate(value?: string | null) {
    if (!value) return 'yok';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('tr-TR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function shorten(value: unknown, max = 520) {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text.length <= max) return text;
    return `${text.slice(0, max - 3)}...`;
}

function leadCode(lead: AssistantLead | null) {
    return lead?.lead_number ? `#${String(lead.lead_number).padStart(4, '0')}` : '#kod-yok';
}

function shouldRunExternalResearch(question?: string | null) {
    if (!question) return false;
    return /araştır|arastir|incele|sektör|sektor|web|site|sosyal|firma|şirket|sirket|yorum|harita/i.test(question);
}

function getNotesSummary(lead: AssistantLead | null) {
    const notes = lead?.lead_notes || [];
    if (notes.length === 0) return '- Not yok.';

    return notes
        .slice(-6)
        .map((note) => {
            const action = note.action_taken ? ` (${note.action_taken})` : '';
            return `- ${formatDate(note.created_at)}${action}: ${shorten(note.note, 260)}`;
        })
        .join('\n');
}

function getLeadProgressSummary(lead: AssistantLead | null, activities: AssistantLeadActivity[]) {
    if (!lead) return 'Lead bulunamadı veya kullanıcının erişiminde değil.';

    const processedState = lead.processed_at
        ? `İşlenmiş. Son işlem: ${formatDate(lead.processed_at)}`
        : 'Henüz processed_at kaydı yok.';

    const hasConversation = (lead.lead_notes?.length || 0) > 0 || activities.length > 0;
    const conversationState = hasConversation
        ? `Geçmiş kayıt var: ${lead.lead_notes?.length || 0} not, ${activities.length} aktivite.`
        : 'Geçmiş konuşma/not kaydı görünmüyor.';

    return `${processedState} ${conversationState}`;
}

async function fetchProfile(supabase: SupabaseClient, userId: string): Promise<AssistantProfile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, sales_role, market_id')
        .eq('id', userId)
        .maybeSingle();

    if (!error) return data as AssistantProfile | null;

    const fallback = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', userId)
        .maybeSingle();

    if (fallback.error) throw fallback.error;

    return fallback.data
        ? { ...(fallback.data as AssistantProfile), sales_role: 'sdr' }
        : null;
}

async function fetchLeadByQuery(
    supabase: SupabaseClient,
    userId: string,
    profile: AssistantProfile | null,
    field: 'id' | 'lead_number',
    value: string | number
): Promise<AssistantLead | null> {
    let query = supabase
        .from('leads')
        .select(LEAD_SELECT_WITH_PIPELINE)
        .eq(field, value)
        .limit(1);

    if (isPrivileged(profile) && profile?.market_id && profile.role === 'manager') {
        query = query.eq('market_id', profile.market_id);
    } else if (!isPrivileged(profile)) {
        query = query.or(ownershipFilter(userId));
    }

    const { data, error } = await query.maybeSingle();

    if (!error) return data as AssistantLead | null;

    let fallback = supabase
        .from('leads')
        .select(LEAD_SELECT_LEGACY)
        .eq(field, value)
        .limit(1);

    if (isPrivileged(profile) && profile?.market_id && profile.role === 'manager') {
        fallback = fallback.eq('market_id', profile.market_id);
    } else if (!isPrivileged(profile)) {
        fallback = fallback.or(legacyOwnershipFilter(userId));
    }

    const fallbackResult = await fallback.maybeSingle();
    if (fallbackResult.error) return null;

    return fallbackResult.data as AssistantLead | null;
}

async function fetchUpcomingAppointments(
    supabase: SupabaseClient,
    userId: string,
    isCloser: boolean
): Promise<AssistantLead[]> {
    let query = supabase
        .from('leads')
        .select(LEAD_SELECT_WITH_PIPELINE)
        .not('appointment_date', 'is', null)
        .order('appointment_date', { ascending: true })
        .limit(5);

    query = isCloser
        ? query.eq('closer_id', userId).eq('meeting_status', 'scheduled')
        : query.or(`assigned_to.eq.${userId},sdr_id.eq.${userId}`);

    const { data, error } = await query;

    if (!error) return (data || []) as AssistantLead[];

    const fallback = await supabase
        .from('leads')
        .select(LEAD_SELECT_LEGACY)
        .eq('assigned_to', userId)
        .not('appointment_date', 'is', null)
        .order('appointment_date', { ascending: true })
        .limit(5);

    if (fallback.error) return [];

    return (fallback.data || []) as AssistantLead[];
}

async function fetchRemainingWorkCount(
    supabase: SupabaseClient,
    userId: string,
    isCloser: boolean
) {
    const query = isCloser
        ? supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('closer_id', userId)
            .eq('meeting_status', 'scheduled')
            .not('appointment_date', 'is', null)
        : supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', userId)
            .eq('status', 'pending');

    const { count, error } = await query;

    if (!error) return count || 0;

    if (isCloser) return 0;

    const fallback = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('status', 'pending');

    return fallback.count || 0;
}

async function fetchGoal(supabase: SupabaseClient, userId: string): Promise<AssistantGoal | null> {
    const { data, error } = await supabase
        .from('goals')
        .select('target_sales, target_calls, current_sales, current_calls')
        .eq('agent_id', userId)
        .eq('period_key', monthKey())
        .maybeSingle();

    if (error) return null;
    return data as AssistantGoal | null;
}

async function fetchRecentActivities(
    supabase: SupabaseClient,
    userId: string
): Promise<AssistantActivity[]> {
    const { data, error } = await supabase
        .from('lead_activity_log')
        .select(`
            action,
            metadata,
            created_at,
            leads:lead_id (
                business_name,
                status,
                potential_level
            )
        `)
        .eq('agent_id', userId)
        .order('created_at', { ascending: false })
        .limit(8);

    if (error) return [];
    return (data || []) as AssistantActivity[];
}

async function fetchLeadActivities(
    supabase: SupabaseClient,
    leadId?: string | null
): Promise<AssistantLeadActivity[]> {
    if (!leadId) return [];

    const { data, error } = await supabase
        .from('lead_activity_log')
        .select(`
            action,
            metadata,
            created_at,
            profiles:agent_id (
                full_name
            )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) return [];
    return (data || []) as AssistantLeadActivity[];
}

async function fetchExternalLeadResearch(lead: AssistantLead | null, question?: string | null) {
    if (!lead || !shouldRunExternalResearch(question)) return null;

    const localResearch = [
        lead.website ? `Kayıttaki web sitesi: ${lead.website}` : null,
        lead.rating ? `Kayıttaki puan: ${lead.rating}` : null,
        lead.address ? `Kayıttaki adres: ${lead.address}` : null,
        lead.raw_data ? `Ham veri özeti: ${shorten(lead.raw_data, 700)}` : null,
    ].filter(Boolean).join('\n');

    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
        return [
            localResearch || 'Kayıt içinde ek araştırma verisi yok.',
            'Harici web araştırması için GOOGLE_API_KEY ve GOOGLE_SEARCH_ENGINE_ID tanımlı değil.',
        ].join('\n');
    }

    try {
        const query = [
            lead.business_name,
            lead.address,
            lead.category,
            'official website reviews social media',
        ].filter(Boolean).join(' ');

        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.set('key', process.env.GOOGLE_API_KEY);
        url.searchParams.set('cx', process.env.GOOGLE_SEARCH_ENGINE_ID);
        url.searchParams.set('q', query);
        url.searchParams.set('num', '5');

        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Google search failed: ${response.status}`);

        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items.slice(0, 5) : [];
        const results = items.map((item: JsonRecord, index: number) => (
            `${index + 1}. ${shorten(item.title, 120)} | ${shorten(item.link, 160)} | ${shorten(item.snippet, 220)}`
        )).join('\n');

        return [
            localResearch,
            results ? `Harici arama sonuçları:\n${results}` : 'Harici aramada güçlü sonuç bulunamadı.',
        ].filter(Boolean).join('\n');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Harici araştırma başarısız.';
        return [
            localResearch || 'Kayıt içi araştırma verisi sınırlı.',
            `Harici araştırma hatası: ${message}`,
        ].join('\n');
    }
}

function countRoleMetrics(activities: AssistantActivity[]) {
    let completed = 0;
    let appointments = 0;
    let meetingOutcomes = 0;

    activities.forEach((activity) => {
        if (activity.action === 'completed') completed++;

        const metadata = activity.metadata || {};
        if (metadata.action_taken === 'appointment_scheduled' || metadata.status === 'appointment') {
            appointments++;
        }

        if (typeof metadata.meeting_outcome === 'string' && metadata.meeting_outcome) {
            meetingOutcomes++;
        }
    });

    return { completed, appointments, meetingOutcomes };
}

function renderAppointments(appointments: AssistantLead[]) {
    if (appointments.length === 0) return '- Yaklaşan randevu/toplantı yok.';

    return appointments
        .map((lead) => {
            const status = lead.meeting_status || lead.status || 'scheduled';
            return `- ${leadCode(lead)} | ${formatDate(lead.appointment_date)} | ${lead.business_name || 'İsimsiz lead'} | ${status}`;
        })
        .join('\n');
}

function renderActivities(activities: AssistantActivity[]) {
    if (activities.length === 0) return '- Yakın aktivite yok.';

    return activities.slice(0, 5).map((activity) => {
        const leadName = activity.leads?.business_name || 'Lead';
        return `- ${formatDate(activity.created_at)} | ${activity.action || 'aktivite'} | ${leadName} | ${shorten(activity.metadata, 180)}`;
    }).join('\n');
}

function renderLeadActivities(activities: AssistantLeadActivity[]) {
    if (activities.length === 0) return '- Aktivite yok.';

    return activities.slice(0, 8).map((activity) => {
        const agent = activity.profiles?.full_name ? ` | ${activity.profiles.full_name}` : '';
        return `- ${formatDate(activity.created_at)} | ${activity.action || 'aktivite'}${agent} | ${shorten(activity.metadata, 240)}`;
    }).join('\n');
}

function renderLeadBlock(lead: AssistantLead | null, activities: AssistantLeadActivity[]) {
    if (!lead) return 'Lead bulunamadı veya kullanıcının erişiminde değil.';

    return [
        `Kod: ${leadCode(lead)}`,
        `İşletme: ${lead.business_name || 'İsimsiz lead'}`,
        `Telefon: ${lead.phone_number || 'yok'}`,
        `Sektör/kategori: ${lead.category || 'belirsiz'}`,
        `Adres: ${lead.address || 'yok'}`,
        `Web: ${lead.website || 'yok'}`,
        `Puan: ${lead.rating || 'yok'}`,
        `Status: ${lead.status || 'belirsiz'}`,
        `Potansiyel: ${lead.potential_level || 'not_assessed'}`,
        `Randevu: ${formatDate(lead.appointment_date)}`,
        `Tekrar arama: ${formatDate(lead.callback_at)}`,
        `Tekrar arama nedeni: ${lead.callback_reason || 'yok'}`,
        `10 dk SMS hatırlatma: ${lead.callback_reminder_10m_sent ? 'gönderildi' : 'bekliyor/gönderilmedi'}`,
        `Meeting status: ${lead.meeting_status || 'yok'}`,
        `İşlenme/geçmiş: ${getLeadProgressSummary(lead, activities)}`,
        `AI özet: ${shorten(lead.ai_summary, 420) || 'yok'}`,
        `Son notlar:\n${getNotesSummary(lead)}`,
        `Lead aktiviteleri:\n${renderLeadActivities(activities)}`,
    ].join('\n');
}

function buildContextText(context: Omit<AssistantContext, 'contextText'>) {
    const profile = context.profile;
    const isCloser = profile?.sales_role === 'closer';
    const roleLabel = isCloser ? 'Closer' : 'SDR';
    const targetLabel = isCloser ? 'toplantı sonucu / satış' : 'toplantı organize';
    const goal = context.goal;

    return `
Kullanıcı:
- İsim: ${profile?.full_name || 'bilinmiyor'}
- Yetki rolü: ${profile?.role || 'bilinmiyor'}
- Satış fonksiyonu: ${roleLabel}

Bugünkü durum:
- Bugünkü tamamlanan işlem: ${context.todayCompletedCount}
- Bugünkü SDR randevu metriği: ${context.todayAppointmentCount}
- Bugünkü closer toplantı sonucu: ${context.todayMeetingOutcomeCount}
- Bekleyen rol işi: ${context.remainingWorkCount}
- Rol hedef etiketi: ${targetLabel}
- Aylık hedef: randevu/operasyon ${goal?.target_calls || 0}, satış ${goal?.target_sales || 0}
- Aylık ilerleme: randevu/operasyon ${goal?.current_calls || 0}, satış ${goal?.current_sales || 0}

Seçili lead bağlamı (${context.selectedLeadSource === 'code' ? 'kod ile seçildi' : context.selectedLeadSource === 'current' ? 'aktif lead' : 'lead yok'}):
${renderLeadBlock(context.selectedLead, context.selectedLeadActivities)}

Aktif lead:
${context.currentLead ? `${leadCode(context.currentLead)} | ${context.currentLead.business_name || 'İsimsiz lead'} | ${context.currentLead.status || 'belirsiz'}` : 'Aktif lead yok.'}

Yaklaşan randevu/toplantılar:
${renderAppointments(context.upcomingAppointments)}

Son kullanıcı aktiviteleri:
${renderActivities(context.recentActivities)}

Araştırma notu:
${context.selectedLeadResearch || 'Bu soru için harici araştırma çalıştırılmadı.'}
`.trim();
}

export async function buildAssistantContext(
    supabase: SupabaseClient,
    userId: string,
    options: BuildAssistantContextOptions = {}
): Promise<AssistantContext> {
    const profile = await fetchProfile(supabase, userId);
    const isCloser = profile?.sales_role === 'closer';
    const todayStart = startOfTodayIso();

    const [currentLead, codeLead] = await Promise.all([
        options.currentLeadId
            ? fetchLeadByQuery(supabase, userId, profile, 'id', options.currentLeadId)
            : Promise.resolve(null),
        options.leadCode
            ? fetchLeadByQuery(supabase, userId, profile, 'lead_number', options.leadCode)
            : Promise.resolve(null),
    ]);

    const selectedLead = codeLead || currentLead;
    const selectedLeadSource = codeLead ? 'code' : currentLead ? 'current' : 'none';

    const [
        upcomingAppointments,
        goal,
        recentActivities,
        remainingWorkCount,
        todayActivitiesResult,
        selectedLeadActivities,
        selectedLeadResearch,
    ] = await Promise.all([
        fetchUpcomingAppointments(supabase, userId, isCloser),
        fetchGoal(supabase, userId),
        fetchRecentActivities(supabase, userId),
        fetchRemainingWorkCount(supabase, userId, isCloser),
        supabase
            .from('lead_activity_log')
            .select('action, metadata, created_at')
            .eq('agent_id', userId)
            .gte('created_at', todayStart),
        fetchLeadActivities(supabase, selectedLead?.id),
        fetchExternalLeadResearch(selectedLead, options.question),
    ]);

    const todayActivities = (todayActivitiesResult.data || []) as AssistantActivity[];
    const roleMetrics = countRoleMetrics(todayActivities);

    const partialContext = {
        profile,
        currentLead,
        selectedLead,
        selectedLeadActivities,
        selectedLeadResearch,
        selectedLeadSource: selectedLeadSource as AssistantContext['selectedLeadSource'],
        upcomingAppointments,
        todayCompletedCount: roleMetrics.completed,
        todayAppointmentCount: roleMetrics.appointments,
        todayMeetingOutcomeCount: roleMetrics.meetingOutcomes,
        remainingWorkCount,
        goal,
        recentActivities,
    };

    return {
        ...partialContext,
        contextText: buildContextText(partialContext),
    };
}
