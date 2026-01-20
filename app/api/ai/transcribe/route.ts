
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

// Initialize OpenAI
// Note: Requires OPENAI_API_KEY in .env.local
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Authenticate
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Parse Request
        const { audioUrl, leadId } = await request.json();
        if (!audioUrl || !leadId) {
            return NextResponse.json({ error: 'Missing audioUrl or leadId' }, { status: 400 });
        }

        console.log('Processing audio:', audioUrl);

        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY is missing');
            return NextResponse.json({ error: 'Server configuration error: OpenAI API Key missing' }, { status: 500 });
        }

        // 3. Download Audio File from Supabase Storage or URL
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Failed to fetch audio file: ${audioResponse.statusText}`);
        }

        const audioBlob = await audioResponse.blob();

        // Determine mime type from URL or fallback
        let mimeType = audioBlob.type;
        let fileName = 'recording.webm';

        // Try to guess from URL if blob type is generic or missing or octet-stream
        if (!mimeType || mimeType === 'application/octet-stream') {
            if (audioUrl.includes('.mp4')) {
                mimeType = 'audio/mp4';
                fileName = 'recording.mp4';
            } else if (audioUrl.includes('.ogg')) {
                mimeType = 'audio/ogg';
                fileName = 'recording.ogg';
            } else if (audioUrl.includes('.wav')) {
                mimeType = 'audio/wav';
                fileName = 'recording.wav';
            } else {
                mimeType = 'audio/webm';
                fileName = 'recording.webm';
            }
        } else {
            // Set filename based on detected mimeType
            if (mimeType.includes('mp4')) fileName = 'recording.mp4';
            else if (mimeType.includes('ogg')) fileName = 'recording.ogg';
            else if (mimeType.includes('wav')) fileName = 'recording.wav';
        }

        console.log(`Using mimeType: ${mimeType}, fileName: ${fileName}`);

        const file = new File([audioBlob], fileName, { type: mimeType });

        // 4. OpenAI Whisper (Transcription)
        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'tr', // Hint Turkish
            response_format: 'text',
        });

        const transcriptText = transcription as unknown as string;

        // 5. OpenAI GPT-4o (Summarization)
        let summary = 'Özet oluşturulamadı.';
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o', // or gpt-3.5-turbo if 4o is not available
                messages: [
                    {
                        role: 'system',
                        content: `Sen profesyonel bir satış koçu ve CRM asistanısın. Görevin, bir satış temsilcisi ile potansiyel müşteri arasındaki telefon görüşmesinin transkriptini analiz ederek yapılandırılmış bir özet çıkarmaktır.

                        Lütfen aşağıdaki kurallara SIKI SIKIYA uy:
                        1. **Sadece Gerçek Konuşmayı Analiz Et:** Eğer transkript boşsa, çok kısaysa (örn: "Alo", "Ses", "Merhaba") veya anlamsız seslerden oluşuyorsa, ASLA bir senaryo uydurma. Sadece "Görüşme içeriği yetersiz veya ses anlaşılamadı." yaz.
                        2. **Ürün Uydurma:** Transkriptte geçmeyen hiçbir ürün veya hizmetten (örn: yazıcı, sigorta, emlak) bahsetme. Sadece konuşmada geçen konuları not al.
                        3. **Format:** Çıktıyı tam olarak aşağıdaki başlıklarla Türkçe olarak ver:
                           - **Özet**: Görüşmenin 1-2 cümlelik özeti.
                           - **Müşteri İlgisi**: (Yüksek / Orta / Düşük / Belirsiz) - Sebebiyle birlikte.
                           - **İtirazlar**: Müşterinin dile getirdiği endişeler veya itirazlar (yoksa "Yok" yaz).
                           - **Sonraki Adım**: Satış temsilcisi ne yapmalı?

                        Unutma: Dürüst ol. Eğer konuşma yoksa, analiz yapma.`
                    },
                    {
                        role: 'user',
                        content: transcriptText
                    }
                ],
                temperature: 0.3,
            });
            summary = completion.choices[0].message.content || 'Özet oluşturulamadı.';
        } catch (gptError) {
            console.error('GPT Summarization error:', gptError);
            summary = 'Özetleme servisi şu an kullanılamıyor, ancak transkript kaydedildi.';
        }

        // 6. Save to DB (call_logs)
        // Insert record linking to lead
        const { error: logError } = await supabase.from('call_logs').insert({
            lead_id: leadId,
            agent_id: user.id,
            audio_url: audioUrl,
            transcription: transcriptText,
            summary: summary,
            duration_seconds: 0 // We don't have exact duration here easily unless passed from client
        });

        if (logError) {
            console.error('Database insert error:', logError);
            // Don't fail full request if just logging failed
        }

        return NextResponse.json({
            success: true,
            transcription: transcriptText,
            summary: summary
        });

    } catch (error: any) {
        console.error('Transcription error:', error);
        return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
    }
}
