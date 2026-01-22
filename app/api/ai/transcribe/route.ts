
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

// Initialize OpenAI
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

        console.log('🤖 [AI Analysis] Starting for lead:', leadId);

        // Check API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('❌ [AI Analysis] OPENAI_API_KEY not found in environment!');
            return NextResponse.json({
                error: 'OpenAI API key not configured',
                fallback: {
                    summary: '⚠️ AI analizi yapılamadı: API key eksik',
                    potential_level: 'not_assessed'
                }
            }, { status: 500 });
        }

        // 3. Fetch Audio
        console.log('📥 [AI Analysis] Fetching audio from:', audioUrl);
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            console.error('❌ [AI Analysis] Audio fetch failed:', audioResponse.statusText);
            throw new Error(`Audio fetch failed: ${audioResponse.statusText}`);
        }

        const audioBlob = await audioResponse.blob();
        console.log('✅ [AI Analysis] Audio fetched, size:', audioBlob.size, 'bytes');

        // CRITICAL FIX: Force MP3 format for better Whisper compatibility
        // WebM codec often causes transcription failures
        let fileName = 'recording.mp3';
        let mimeType = 'audio/mp3';

        console.log('🔄 [AI Analysis] Converting to MP3 for Whisper compatibility');

        // 4. Transcription (Whisper)
        console.log('🎤 [AI Analysis] Starting Whisper transcription...');
        let transcriptText = '';
        try {
            const file = new File([audioBlob], fileName, { type: mimeType });
            const transcription = await openai.audio.transcriptions.create({
                file: file,
                model: 'whisper-1',
                language: 'tr',
                response_format: 'text',
            });

            transcriptText = transcription as unknown as string;
            console.log('✅ [AI Analysis] Transcription complete, length:', transcriptText.length);
            console.log('📝 [AI Analysis] Transcript preview:', transcriptText.substring(0, 100));
        } catch (whisperError: any) {
            console.error('❌ [AI Analysis] Whisper error:', whisperError.message);
            return NextResponse.json({
                error: 'Transcription failed',
                details: whisperError.message,
                fallback: {
                    summary: '⚠️ Ses tanıma başarısız oldu',
                    potential_level: 'not_assessed'
                }
            }, { status: 500 });
        }

        // 5. Sales Coach Analysis (GPT-4o)
        console.log('🧠 [AI Analysis] Starting GPT-4o analysis...');

        const systemPrompt = `
            Sen Dünyanın en iyi Satış Koçu ve CRM Asistanısın.
            Görevin: Bir satış temsilcisi ile müşteri arasındaki telefon görüşmesini analiz etmek ve CRM sistemi için yapılandırılmış veri çıkarmak.

            Aşağıdaki JSON formatında çıktı ver:
            {
                "summary": "Görüşmenin profesyonel, maddeler halinde kısa özeti.",
                "potential_level": "high" | "medium" | "low" | "not_assessed",
                "extracted_date": "YYYY-MM-DD HH:MM" (Eğer bir randevu veya geri arama tarihi konuşulduysa, yoksa null),
                "sentiment_score": 1-10 arası (10 çok olumlu),
                "suggested_action": "CRM için kısa aksiyon önerisi (örn: Yarın 14:00'te ara)",
                "key_objections": ["Fiyat", "Rakip firma" gibi itirazlar],
                "sales_completed": boolean (Satış kapandı mı?)
            }

            Kurallar:
            1. Tarihler için bağlama dikkat et (örn: "Yarın öğleden sonra" denildiyse bugüne 1 gün ekle ve 14:00 yap).
            2. Potansiyel seviyesini müşterinin ses tonuna ve satın alma sinyallerine göre belirle.
            3. Eğer transkript boş veya anlamsızsa "potential_level": "not_assessed" ver.
        `;

        let analysis: any = {
            summary: 'Analiz yapılamadı',
            potential_level: 'not_assessed',
            sentiment_score: 5,
            suggested_action: 'Manuel inceleme gerekli',
            key_objections: [],
            sales_completed: false
        };

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                response_format: { type: "json_object" },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Görüşme Transkripti:\n${transcriptText}` }
                ],
                temperature: 0.3,
            });

            const analysisRaw = completion.choices[0].message.content;
            console.log('📝 [AI Analysis] GPT-4o raw response:', analysisRaw?.substring(0, 200));

            analysis = JSON.parse(analysisRaw || '{}');
            console.log('✅ [AI Analysis] GPT-4o analysis complete');
        } catch (gptError: any) {
            console.error('❌ [AI Analysis] GPT-4o error:', gptError.message);
            analysis.summary = `⚠️ AI analizi kısmen başarısız: ${gptError.message}`;
        }

        // 6. Database Updates (Auto-Pilot)

        // A) Update Lead Status & Potential
        if (analysis.potential_level !== 'not_assessed') {
            const { error: updateError } = await supabase.from('leads').update({
                potential_level: analysis.potential_level,
            }).eq('id', leadId);

            if (updateError) {
                console.error('⚠️ [AI Analysis] Lead update error:', updateError.message);
            }
        }

        // B) Add AI Note
        let noteContent = `🤖 **AI Satış Analizi**\n\n`;
        noteContent += `📌 **Özet:** ${analysis.summary || 'Analiz yapılamadı'}\n`;
        noteContent += `💡 **Potansiyel:** ${(analysis.potential_level || 'not_assessed').toUpperCase()} (Skor: ${analysis.sentiment_score || 0}/10)\n`;
        if (analysis.extracted_date) {
            noteContent += `📅 **Algılanan Tarih:** ${analysis.extracted_date}\n`;
        }
        if (analysis.key_objections?.length > 0) {
            noteContent += `⚠️ **İtirazlar:** ${analysis.key_objections.join(', ')}\n`;
        }
        noteContent += `🚀 **Öneri:** ${analysis.suggested_action || 'Manuel inceleme yapın'}`;

        const { error: noteError } = await supabase.from('lead_notes').insert({
            lead_id: leadId,
            agent_id: user.id,
            note: noteContent,
            action_taken: 'AI Analysis',
        });

        if (noteError) {
            console.error('❌ [AI Analysis] Note insert error:', noteError.message);
        } else {
            console.log('✅ [AI Analysis] AI note saved successfully');
        }

        // C) Save Log
        await supabase.from('call_logs').insert({
            lead_id: leadId,
            agent_id: user.id,
            audio_url: audioUrl,
            transcription: transcriptText,
            summary: analysis.summary,
            duration_seconds: 0
        });

        console.log('🎉 [AI Analysis] Process complete for lead:', leadId);

        return NextResponse.json({
            success: true,
            analysis: analysis,
            transcription: transcriptText
        });

    } catch (error: any) {
        console.error('💥 [AI Analysis] CRITICAL ERROR:', error);
        console.error('Stack:', error.stack);

        return NextResponse.json({
            error: error.message || 'Unknown error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
