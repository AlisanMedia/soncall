
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
                toast.error('Tarayıcınız ses kaydını desteklemiyor.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // More comprehensive mime type check
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus',
                'audio/ogg',
                'audio/wav'
            ];

            // Filter supported types
            const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
            const selectedMimeType = supportedType || '';  // Let browser default if none match

            setAudioMimeType(selectedMimeType || 'audio/webm'); // State for later upload

            const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                // Ensure we have data
                if (audioChunksRef.current.length === 0) {
                    toast.error("Ses verisi alınamadı. Mikrofonunuzu kontrol edin.");
                    return;
                }

                // Fallback mime type for Blob creation
                const blobType = selectedMimeType || 'audio/webm';
                const blob = new Blob(audioChunksRef.current, { type: blobType });

                // Validate blob size
                if (blob.size < 100) {
                    toast.error("Ses kaydı çok kısa veya boş.");
                    return;
                }

                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);
                stream.getTracks().forEach(track => track.stop()); // Stop mic
            };

            // Request data every 1000ms to ensure chunks are captured
            mediaRecorder.start(1000);
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error: any) {
            console.error('Error accessing microphone:', error);
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                toast.error('Mikrofon erişimi reddedildi. Tarayıcı ayarlarını kontrol edin.');
            } else if (error.name === 'NotFoundError') {
                toast.error('Mikrofon bulunamadı.');
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
                                className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                                title={isPlaying ? "Duraklat" : "Dinle"}
                            >
                                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={() => {
                                    setAudioUrl(null);
                                    setAudioBlob(null);
                                }}
                                className="p-2 hover:bg-red-500/20 rounded-full text-red-400 transition-colors"
                                title="Sil ve Yeniden Kaydet"
                            >
                                <Square className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={isUploading || isProcessing}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading || isProcessing ? (
                            <>
                                <img src="/loading-logo.png" alt="Loading" className="w-5 h-5 animate-pulse object-contain" />
                                {isUploading ? 'Yükleniyor...' : 'Analiz Ediliyor...'}
                            </>
                        ) : (
                            <>
                                <UploadCloud className="w-5 h-5" />
                                Analiz Et ve Kaydet
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
