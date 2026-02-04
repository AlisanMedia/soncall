
'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Save, Loader2, UploadCloud, FileAudio } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { PulseVoiceRecorder } from '@/components/ui/voice-recording';

interface VoiceRecorderProps {
    leadId: string;
    onRecordingComplete: (audioUrl: string, blob: Blob) => void;
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

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Add import at top
    // ... Inside component

    // ... Inside component
    const startRecording = async () => {
        try {
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
            setAudioMimeType(selectedMimeType || 'audio/webm');

            console.log('[VoiceRecorder] Selected MIME type:', selectedMimeType || '(browser default)');

            const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

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

            mediaRecorder.onerror = (event: any) => {
                console.error('[VoiceRecorder] MediaRecorder error:', event);
                console.error('[VoiceRecorder] Error details:', {
                    error: event.error,
                    state: mediaRecorder.state
                });
                toast.error(`Kayıt hatası: ${event.error?.name || 'Bilinmeyen hata'}`);
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
                    toast.error("Ses kaydı çok kısa (minimum 1KB gerekli).");
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                // Create blob
                const blobType = selectedMimeType || 'audio/webm';
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

        } catch (error: any) {
            console.error('[VoiceRecorder] Error in startRecording:', error);
            console.error('[VoiceRecorder] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                toast.error('Mikrofon erişimi reddedildi. Tarayıcı ayarlarını kontrol edin.');
            } else if (error.name === 'NotFoundError') {
                toast.error('Mikrofon bulunamadı. Cihazınızı kontrol edin.');
            } else if (error.name === 'NotSupportedError') {
                toast.error('Tarayıcınız ses kaydını desteklemiyor. Chrome/Firefox kullanın.');
            } else {
                toast.error('Ses kaydı başlatılamadı: ' + error.message);
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
        if (!audioBlob) return;
        setIsUploading(true);

        try {
            const supabase = createClient();

            // Determine extension based on mime type
            let ext = 'webm';
            if (audioMimeType.includes('mp4')) ext = 'mp4';
            else if (audioMimeType.includes('ogg')) ext = 'ogg';
            else if (audioMimeType.includes('wav')) ext = 'wav';

            const filename = `${leadId}-${Date.now()}.${ext}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('call-recordings')
                .upload(filename, audioBlob, {
                    contentType: audioMimeType,
                    upsert: false
                });

            if (error) throw error;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('call-recordings')
                .getPublicUrl(filename);

            onRecordingComplete(publicUrl, audioBlob);
        } catch (error: any) {
            console.error('Upload failed:', error);
            alert('Yükleme başarısız: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    // ... existing logic functions ...

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center gap-6">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 self-start w-full border-b border-white/10 pb-2 mb-2">
                <FileAudio className="w-4 h-4 text-purple-400" />
                Görüşme Kaydı
            </h4>

            {/* Audio Player Logic */}
            <audio
                ref={audioPlayerRef}
                src={audioUrl || undefined}
                onEnded={() => setIsPlaying(false)}
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
                                className="p-2 sm:p-3 hover:bg-white/10 active:scale-95 rounded-full text-white transition-all touch-target"
                                title={isPlaying ? "Duraklat" : "Dinle"}
                                aria-label={isPlaying ? "Duraklat" : "Dinle"}
                            >
                                {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </button>
                            <button
                                onClick={() => {
                                    setAudioUrl(null);
                                    setAudioBlob(null);
                                }}
                                className="p-2 sm:p-3 hover:bg-red-500/20 active:scale-95 rounded-full text-red-400 transition-all touch-target"
                                title="Sil ve Yeniden Kaydet"
                                aria-label="Sil ve Yeniden Kaydet"
                            >
                                <Square className="w-4 h-4 sm:w-5 sm:h-5" />
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
                                <img src="/loading-logo.png" alt="Loading" className="w-5 h-5 animate-pulse object-contain" />
                                <span className="text-sm sm:text-base">{isUploading ? 'Yükleniyor...' : 'Analiz Ediliyor...'}</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud className="w-5 h-5" />
                                <span className="text-sm sm:text-base">Analiz Et ve Kaydet</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
