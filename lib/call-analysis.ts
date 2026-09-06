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
        return new RegExp(`^${escapedLead}-[0-9]+\\.(webm|mp4|m4a|ogg|wav|mp3)$`, 'i').test(path) ? path : null;
    } catch {
        return null;
    }
}

/**
 * Supabase Storage can return application/octet-stream even when the object has
 * a valid audio extension. OpenAI uses the MIME type when validating the upload,
 * so prefer the recorded extension and only trust a known audio MIME value.
 */
export function getAudioMimeType(recordingPath: string, blobType?: string | null): string {
    const extension = recordingPath.split('.').pop()?.toLowerCase();
    const byExtension: Record<string, string> = {
        webm: 'audio/webm',
        mp4: 'audio/mp4',
        m4a: 'audio/mp4',
        ogg: 'audio/ogg',
        wav: 'audio/wav',
        mp3: 'audio/mpeg',
    };
    const extensionType = extension ? byExtension[extension] : undefined;
    const normalized = String(blobType || '').split(';', 1)[0].toLowerCase();
    const supported = new Set(Object.values(byExtension));
    return extensionType || (supported.has(normalized) ? normalized : 'audio/webm');
}

/** The analyst prompt returns Istanbul wall time, not the server/browser time zone. */
export function parseCallDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(value)) return new Date(NaN);
    return new Date(`${value.replace(' ', 'T')}:00+03:00`);
}
