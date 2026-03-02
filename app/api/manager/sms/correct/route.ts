
import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

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

        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: 'Sen üst düzey bir kurumsal iletişim ve satış stratejistisin. Sadece mükemmel Türkçe iş yazışmaları yaparsın.' },
                { role: 'user', content: prompt }
            ],
            model: 'gpt-4o',
            max_tokens: 300,
            temperature: 0.6,
        });

        const correctedMessage = completion.choices[0].message.content?.trim();

        return NextResponse.json({ message: correctedMessage });

    } catch (error: any) {
        console.error('AI Correction Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
