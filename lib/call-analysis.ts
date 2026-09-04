/** Accept only recordings uploaded by VoiceRecorder for this lead, never arbitrary URLs. */
export function getRecordingPath(audioUrl: string, leadId: string, supabaseUrl: string): string | null {
    try {
        const url = new URL(audioUrl);
        const origin = new URL(supabaseUrl);
        if (url.origin !== origin.origin || url.username || url.password || url.search || url.hash) return null;
        const prefix = '/storage/v1/object/public/call-recordings/';
        if (!url.pathname.startsWith(prefix)) return null;
        const path = url.pathname.slice(prefix.length);
        const escapedLead = leadId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${escapedLead}-[0-9]+\\.(webm|mp4|ogg|wav)$`, 'i').test(path) ? path : null;
    } catch {
        return null;
    }
}

/** The analyst prompt returns Istanbul wall time, not the server/browser time zone. */
export function parseCallDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(value)) return new Date(NaN);
    return new Date(`${value.replace(' ', 'T')}:00+03:00`);
}
