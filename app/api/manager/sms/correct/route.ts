
import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';
import { logAiUsage } from '@/lib/ai-usage';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        // Read custom instructions from file
        let customInstructions = "";
        try {
            const instructionsPath = path.join(process.cwd(), 'lib/ai/instructions.md');
            customInstructions = fs.readFileSync(instructionsPath, 'utf8');
        } catch (e) {
            console.error("Instructions file read error:", e);
        }
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('market_id')
            .eq('id', user.id)
            .maybeSingle();

        const body = await request.json();
        const { text, contactName } = body;

        if (!text) {
            return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
        }

        const now = new Date();
        const hour = now.getHours();
        let greeting = 'İyi günler';
        if (hour >= 5 && hour < 12) greeting = 'Günaydın';
        else if (hour >= 18 && hour < 23) greeting = 'İyi akşamlar';
        else if (hour >= 23 || hour < 5) greeting = 'İyi geceler';

        const prompt = `
        ### ÖZEL TALİMATLAR VE BİLGİLER (BU BİLGİLERİ ESAŞ AL):
        ${customInstructions}

        ### ALICI BİLGİLERİ VE ZAMAN:
        - Alıcı: "${contactName || 'Değerli Müşterimiz'}"
        - Selam Türü: "${greeting}"

        ### KURALLAR:
        1. Yukarıdaki "ÖZEL TALİMATLAR" kısmındaki şirket bilgilerini ve tonlamayı kesinlikle uygula.
        2. Mesajı "${contactName ? contactName + ' Bey/Hanım' : 'Değerli Müşterimiz'}" ile başlat ve "${greeting}" ekle.
        3. Çıktı SADECE düzeltilmiş mesaj metni olmalıdır.

        ### TASLAK MESAJ:
        "${text}"
        `;

        const model = process.env.OPENAI_SMS_MODEL || 'gpt-4o-mini';
        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: 'Sen üst düzey bir kurumsal iletişim ve satış stratejistisin. Sadece mükemmel Türkçe iş yazışmaları yaparsın.' },
                { role: 'user', content: prompt }
            ],
            model,
            max_tokens: 300,
            temperature: 0.6,
        });

        const correctedMessage = completion.choices[0].message.content?.trim();

        await logAiUsage(supabase, {
            userId: user.id,
            marketId: profile?.market_id || null,
            feature: 'sms_correct',
            model,
            inputTokens: completion.usage?.prompt_tokens || 0,
            outputTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
            metadata: { contact_name: contactName || null },
        });

        return NextResponse.json({ message: correctedMessage });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'AI correction failed';
        console.error('AI Correction Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
