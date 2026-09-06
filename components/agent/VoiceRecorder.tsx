
'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, UploadCloud, FileAudio, AlertCircle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { PulseVoiceRecorder } from '@/components/ui/voice-recording';

interface VoiceRecorderProps {
    leadId: string;
    onRecordingComplete: (audioUrl: string, blob: Blob, durationSeconds: number) => void;
    isProcessing?: boolean;
}

export default function VoiceRecorder({ leadId, onRecordingComplete, isProcessing = false }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [hasUploadedRecording, setHasUploadedRecording] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const uploadedUrlRef = useRef<string | null>(null);

    useEffect(() => () => {
        const recorder = mediaRecorderRef.current;
        if (recorder) {
            recorder.onstop = null;
            recorder.ondataavailable = null;
            if (recorder.state !== 'inactive') recorder.stop();
            recorder.stream.getTracks().forEach(track => track.stop());
        }
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    useEffect(() => () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
    }, [audioUrl]);

    const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Bilinmeyen hata';

    // Add import at top
    // ... Inside component

    // ... Inside component
    const startRecording = async () => {
        try {
            setUploadError(null);
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast.error('Tarayıcınız ses kaydını desteklemiyor. Chrome veya Firefox kullanın.');
                return;
            }

            console.log('[VoiceRecorder] Starting recording...');
            console.log('[VoiceRecorder] Browser:', navigator.userAgent);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('[VoiceRecorder] Microphone access granted');

            // Desktop-first MIME type ordering (Safari/Edge compatibility)
            const mimeTypes = [
                'audio/webm;codecs=opus',     // Chrome/Firefox preferred
                'audio/webm',                  // Chrome/Firefox fallback
                'audio/mp4',                   // Safari/Edge
                'audio/mp4;codecs=mp4a.40.2', // Safari specific
                'audio/ogg;codecs=opus',       // Firefox fallback
                'audio/wav',                   // Universal fallback
                ''                             // Browser default (last resort)
            ];

            // Test and log supported types
            console.log('[VoiceRecorder] Testing MIME types:');
            const supportedTypes = mimeTypes.map(type => {
                const supported = type === '' ? true : MediaRecorder.isTypeSupported(type);
                console.log(`  ${type || '(browser default)'}: ${supported ? '✓' : '✗'}`);
                return { type, supported };
            }).filter(t => t.supported);

            const selectedMimeType = supportedTypes[0]?.type || '';

            console.log('[VoiceRecorder] Selected MIME type:', selectedMimeType || '(browser default)');

            const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
            const mediaRecorder = new MediaRecorder(stream, options);
            // Read the browser's actual encoder choice; it can differ from the
            // requested type when the browser silently falls back.
            const actualMimeType = mediaRecorder.mimeType || selectedMimeType || 'audio/webm';
            setAudioMimeType(actualMimeType);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            uploadedUrlRef.current = null;

            // Enhanced event handlers
            mediaRecorder.onstart = () => {
                console.log('[VoiceRecorder] Recording started, state:', mediaRecorder.state);
                toast.success(`Kayıt başladı (${selectedMimeType || 'default format'})`);
            };

            mediaRecorder.ondataavailable = (event) => {
                console.log('[VoiceRecorder] Chunk received:', event.data.size, 'bytes');
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onerror = (event: Event) => {
                const recorderError = event as Event & { error?: DOMException };
                console.error('[VoiceRecorder] MediaRecorder error:', event);
                console.error('[VoiceRecorder] Error details:', {
                    error: recorderError.error,
                    state: mediaRecorder.state
                });
                toast.error(`Kayıt hatası: ${recorderError.error?.name || 'Bilinmeyen hata'}`);
                setIsRecording(false);
                if (timerRef.current) clearInterval(timerRef.current);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.onstop = () => {
                console.log('[VoiceRecorder] Recording stopped');
                console.log('[VoiceRecorder] Chunks collected:', audioChunksRef.current.length);

                // Ensure we have data
                if (audioChunksRef.current.length === 0) {
                    console.error('[VoiceRecorder] No chunks received!');
                    setUploadError('Ses verisi alınamadı. Mikrofonunuzu kontrol edin ve tekrar deneyin.');
                    toast.error("Ses verisi alınamadı. Mikrofonunuzu kontrol edin.");
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                // Calculate total size
                const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
                console.log('[VoiceRecorder] Total audio data:', totalSize, 'bytes');

                // Stronger validation (1KB minimum)
                if (totalSize < 1000) {
                    console.error('[VoiceRecorder] Audio data too small:', totalSize, 'bytes');
                    setUploadError('Ses kaydı çok kısa. Daha uzun bir kayıt alın ve tekrar deneyin.');
                    toast.error("Ses kaydı çok kısa (minimum 1KB gerekli).");
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                // Create blob
                const blobType = mediaRecorder.mimeType || actualMimeType;
                const blob = new Blob(audioChunksRef.current, { type: blobType });

                console.log('[VoiceRecorder] Blob created:', {
                    size: blob.size,
                    type: blob.type,
                    chunks: audioChunksRef.current.length
                });

                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);
                stream.getTracks().forEach(track => track.stop());

                toast.success(`Kayıt tamamlandı (${(blob.size / 1024).toFixed(1)} KB)`);
            };

            // Start recording without timeslice for better compatibility
            mediaRecorder.start();
            console.log('[VoiceRecorder] MediaRecorder.start() called');

            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error: unknown) {
            const mediaError = error as { name?: string; message?: string; stack?: string };
            console.error('[VoiceRecorder] Error in startRecording:', error);
            console.error('[VoiceRecorder] Error details:', {
                name: mediaError.name,
                message: mediaError.message,
                stack: mediaError.stack
            });

            if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
                setUploadError('Mikrofon erişimi reddedildi. Tarayıcı ayarlarını kontrol edin.');
                toast.error('Mikrofon erişimi reddedildi. Tarayıcı ayarlarını kontrol edin.');
            } else if (mediaError.name === 'NotFoundError') {
                setUploadError('Mikrofon bulunamadı. Cihazınızı kontrol edin.');
                toast.error('Mikrofon bulunamadı. Cihazınızı kontrol edin.');
            } else if (mediaError.name === 'NotSupportedError') {
                setUploadError('Tarayıcınız ses kaydını desteklemiyor. Chrome/Firefox kullanın.');
                toast.error('Tarayıcınız ses kaydını desteklemiyor. Chrome/Firefox kullanın.');
            } else {
                setUploadError('Ses kaydı başlatılamadı. Lütfen tekrar deneyin.');
                toast.error('Ses kaydı başlatılamadı: ' + getErrorMessage(error));
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const togglePlayback = () => {
        if (!audioPlayerRef.current || !audioUrl) return;

        if (isPlaying) {
            audioPlayerRef.current.pause();
            setIsPlaying(false);
        } else {
            audioPlayerRef.current.play();
            setIsPlaying(true);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleUpload = async () => {
        if (!audioBlob || isUploading || isProcessing) return;
        setUploadError(null);
        if (audioBlob.size > 25 * 1024 * 1024) {
            setUploadError('Ses kaydı 25 MB sınırını aşıyor. Daha kısa bir kayıt alın.');
            toast.error('Ses kaydı 25 MB sınırını aşıyor. Daha kısa bir kayıt alın.');
            return;
        }
        if (uploadedUrlRef.current) {
            setHasUploadedRecording(true);
            onRecordingComplete(uploadedUrlRef.current, audioBlob, recordingTime);
            return;
        }
        setIsUploading(true);

        try {
            const supabase = createClient();
            // Storage allow-lists use the base MIME value; MediaRecorder often
            // appends codec parameters (for example `audio/webm;codecs=opus`).
            const uploadMimeType = audioMimeType.split(';', 1)[0] || 'audio/webm';

            // Determine extension based on mime type
            let ext = 'webm';
            if (uploadMimeType.includes('mp4')) ext = 'mp4';
            else if (uploadMimeType.includes('ogg')) ext = 'ogg';
            else if (uploadMimeType.includes('wav')) ext = 'wav';

            const filename = `${leadId}-${Date.now()}.${ext}`;

            // Upload to Supabase Storage
            const { error } = await supabase.storage
                .from('call-recordings')
                .upload(filename, audioBlob, {
                contentType: uploadMimeType,
                upsert: false
            });

            if (error) throw error;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('call-recordings')
                .getPublicUrl(filename);

            uploadedUrlRef.current = publicUrl;
            setHasUploadedRecording(true);
            onRecordingComplete(publicUrl, audioBlob, recordingTime);
        } catch (error: unknown) {
            console.error('Upload failed:', error);
            const message = 'Yükleme başarısız: ' + getErrorMessage(error);
            setUploadError(message);
            toast.error(message);
        } finally {
            setIsUploading(false);
        }
    };

    const discardRecording = () => {
        audioPlayerRef.current?.pause();
        setAudioUrl(null);
        setAudioBlob(null);
        setIsPlaying(false);
        setRecordingTime(0);
        setUploadError(null);
        setHasUploadedRecording(false);
        uploadedUrlRef.current = null;
    };

    // ... existing logic functions ...

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 flex flex-col items-center gap-4 sm:gap-6">
            <div className="flex w-full items-center justify-between gap-3 border-b border-white/10 pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-purple-400" />
                Görüşme Kaydı
                </h4>
                <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple-200">
                    İsteğe bağlı
                </span>
            </div>

            <div className="w-full" aria-live="polite">
                {isRecording ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-100">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                        Kayıt devam ediyor — bitirmek için mikrofona dokunun
                    </div>
                ) : isUploading ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-100">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Kayıt güvenli şekilde yükleniyor…
                    </div>
                ) : isProcessing ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        AI görüşmeyi analiz ediyor…
                    </div>
                ) : uploadError ? (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
                        <span className="min-w-0">{uploadError}</span>
                    </div>
                ) : hasUploadedRecording ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-100">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Kayıt yüklendi. Analiz başarısızsa aşağıdan tekrar deneyebilirsiniz.
                    </div>
                ) : null}
            </div>

            {/* Audio Player Logic */}
            <audio
                ref={audioPlayerRef}
                src={audioUrl || undefined}
                onEnded={() => setIsPlaying(false)}
                aria-label="Görüşme kaydı oynatıcı"
            />

            {/* Main Recorder UI */}
            {(!audioUrl || isRecording) && (
                <div className="py-2">
                    <PulseVoiceRecorder
                        isRecording={isRecording}
                        onToggle={isRecording ? stopRecording : startRecording}
                        duration={recordingTime}
                    />
                    {!isRecording && !audioUrl && (
                        <p className="text-xs text-center text-purple-300/50 mt-4">
                            Kaydı başlatmak için mikrofona dokunun
                        </p>
                    )}
                </div>
            )}

            {/* Post-Recording Actions (Review & Upload) */}
            {!isRecording && audioUrl && (
                <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <FileAudio className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Ses Kaydı Hazır</p>
                                <p className="text-xs text-purple-300/70">{formatTime(recordingTime)}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={togglePlayback}
                                type="button"
                                className="min-h-11 min-w-11 p-2 sm:p-3 hover:bg-white/10 active:scale-95 rounded-full text-white transition-all touch-target"
                                title={isPlaying ? "Duraklat" : "Dinle"}
                                aria-label={isPlaying ? "Duraklat" : "Dinle"}
                                aria-pressed={isPlaying}
                            >
                                {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </button>
                            <button
                                onClick={discardRecording}
                                type="button"
                                className="min-h-11 min-w-11 p-2 sm:p-3 hover:bg-red-500/20 active:scale-95 rounded-full text-red-400 transition-all touch-target"
                                title="Sil ve Yeniden Kaydet"
                                aria-label="Sil ve Yeniden Kaydet"
                            >
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={isUploading || isProcessing}
                        className="w-full py-3 sm:py-4 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 touch-target"
                    >
                        {isUploading || isProcessing ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                <span className="text-sm sm:text-base">{isUploading ? 'Yükleniyor...' : 'Analiz Ediliyor...'}</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud className="w-5 h-5" />
                                <span className="text-sm sm:text-base">{hasUploadedRecording ? 'Analizi Tekrarla' : 'Analiz Et ve Kaydet'}</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
