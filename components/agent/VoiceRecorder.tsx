
'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Save, Loader2, UploadCloud, FileAudio } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface VoiceRecorderProps {
    leadId: string;
    onRecordingComplete: (audioUrl: string, blob: Blob) => void;
}

export default function VoiceRecorder({ leadId, onRecordingComplete }: VoiceRecorderProps) {
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

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-purple-400" />
                Görüşme Kaydı
            </h4>

            {/* Audio Player (Hidden UI, Logic only) */}
            <audio
                ref={audioPlayerRef}
                src={audioUrl || ''}
                onEnded={() => setIsPlaying(false)}
            />

            <div className="flex items-center justify-between">
                {/* Timer & Status */}
                <div className="flex items-center gap-3">
                    {isRecording ? (
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <span className="text-red-400 font-mono font-medium">{formatTime(recordingTime)}</span>
                        </div>
                    ) : audioUrl ? (
                        <div className="text-green-400 font-medium text-sm flex items-center gap-2">
                            <FileAudio className="w-4 h-4" />
                            Kayıt Hazır
                        </div>
                    ) : (
                        <div className="text-gray-400 text-sm">Kayda başlamak için butona basın</div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                    {!audioUrl && !isRecording && (
                        <button
                            onClick={startRecording}
                            className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-all shadow-lg hover:scale-105"
                            title="Kaydı Başlat"
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                    )}

                    {isRecording && (
                        <button
                            onClick={stopRecording}
                            className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-full transition-all shadow-lg animate-pulse"
                            title="Kaydı Durdur"
                        >
                            <Square className="w-5 h-5 fill-current" />
                        </button>
                    )}

                    {audioUrl && !isRecording && (
                        <>
                            <button
                                onClick={togglePlayback}
                                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors"
                                title={isPlaying ? "Duraklat" : "Oynat"}
                            >
                                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                            </button>

                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium disabled:opacity-50"
                            >
                                {isUploading ? <img src="/loading-logo.png" alt="Loading" className="w-8 h-4 animate-pulse object-contain" /> : <UploadCloud className="w-4 h-4" />}
                                Analiz Et
                            </button>

                            <button
                                onClick={() => {
                                    setAudioUrl(null);
                                    setAudioBlob(null);
                                }}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-300 p-2 rounded-lg transition-colors"
                                title="İptal / Sil"
                                disabled={isUploading}
                            >
                                <Square className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
