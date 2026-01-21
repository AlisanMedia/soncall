
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

        console.log('Processing Sales AI Analysis for lead:', leadId);

        // 3. Fetch Audio
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) throw new Error(`Audio fetch failed: ${audioResponse.statusText}`);

        const audioBlob = await audioResponse.blob();

        // Mime Type Handling
        let mimeType = audioBlob.type || 'audio/webm';
        let fileName = 'recording.webm';
        if (audioUrl.includes('.mp4')) { mimeType = 'audio/mp4'; fileName = 'recording.mp4'; }
        else if (audioUrl.includes('.wav')) { mimeType = 'audio/wav'; fileName = 'recording.wav'; }
        else if (audioUrl.includes('.ogg')) { mimeType = 'audio/ogg'; fileName = 'recording.ogg'; }

        console.log('Transcribing file:', fileName, mimeType);

        // 4. Transcription (Whisper)
        const file = new File([audioBlob], fileName, { type: mimeType });
        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'tr',
            response_format: 'text',
        });

        const transcriptText = transcription as unknown as string;

        // 5. Sales Coach Analysis (GPT-4o)
        console.log('Starting GPT-4o Sales Analysis...');

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
        let analysis;
        try {
            analysis = JSON.parse(analysisRaw || '{}');
        } catch (e) {
            console.error('JSON Parse Error:', e);
            analysis = {
                summary: 'Analiz format hatası.',
                potential_level: 'not_assessed',
                suggested_action: 'Manuel inceleme gerekli.'
            };
        }

        console.log('AI Analysis Result:', analysis);

        // 6. Database Updates (Auto-Pilot)

        // A) Update Lead Status & Potential
        // Only update if AI is confident (high/medium/low)
        if (analysis.potential_level !== 'not_assessed') {
            await supabase.from('leads').update({
                potential_level: analysis.potential_level,
                // Optional: Update status based on sales_completed logic
                // status: analysis.sales_completed ? 'pending' : 'contacted'
            }).eq('id', leadId);
        }

        // B) Add AI Note
        let noteContent = `🤖 **AI Satış Analizi**\n\n`;
        noteContent += `📌 **Özet:** ${analysis.summary}\n`;
        noteContent += `💡 **Potansiyel:** ${analysis.potential_level.toUpperCase()} (Skor: ${analysis.sentiment_score}/10)\n`;
        if (analysis.extracted_date) {
            noteContent += `📅 **Algılanan Tarih:** ${analysis.extracted_date}\n`;
        }
        if (analysis.key_objections?.length > 0) {
            noteContent += `⚠️ **İtirazlar:** ${analysis.key_objections.join(', ')}\n`;
        }
        noteContent += `🚀 **Öneri:** ${analysis.suggested_action}`;

        const { error: noteError } = await supabase.from('lead_notes').insert({
            lead_id: leadId,
            agent_id: user.id, // Logged as the agent, but marked as AI analysis in text
            note: noteContent,
            action_taken: 'AI Analysis', // Special flag
        });

        // C) Save Log
        await supabase.from('call_logs').insert({
            lead_id: leadId,
            agent_id: user.id,
            audio_url: audioUrl,
            transcription: transcriptText,
            summary: analysis.summary,
            duration_seconds: 0
        });

        return NextResponse.json({
            success: true,
            analysis: analysis,
            transcription: transcriptText
        });

    } catch (error: any) {
        console.error('Sales AI Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
