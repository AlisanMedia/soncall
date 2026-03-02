
import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { createClient } from '@/lib/supabase/server';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
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
        Sen dünyanın en iyi kurumsal satış ve iletişim uzmanısın. Görevin, sahadaki satış temsilcisinin yazdığı basit veya eksik taslak mesajları, "C-Level" (üst düzey yönetici) kalitesinde, güven veren ve harekete geçiren profesyonel iş mesajlarına dönüştürmektir.

        ### KONTEKST:
        - Alıcının İsmi: "${contactName || 'Değerli Müşterimiz'}"
        - Mevcut Zaman Dilimi Selamı: "${greeting}"
        - Dil: Türkçe (Kurumsal İstanbul Türkçesi)

        ### KURALLAR (Hayati Önemde):
        1. **Hitap Sanatı**: Kesinlikle "${contactName ? contactName + ' Bey/Hanım' : 'Değerli Müşterimiz'}" şeklinde başla. Eğer isim varsa nezaket kurallarına uygun hitap et (Örn: "Muhammed Bey Merhaba,").
        2. **Zaman Uyumu**: "${greeting}" ifadesini profesyonel bir şekilde başlangıca entegre et.
        3. **Satış Psikolojisi**: Mesajın tonu ezik değil, çözüm ortağı gibi olmalı. Güven vermeli.
        4. **Netlik ve Akıcılık**: Basit "merhaba" yazılmışsa, bunu "Sizi rahatsız etmek istemedim, müsaitliğinizde bir konu hakkında görüşmek isterim" gibi şık bir giriş cümlesine dönüştür.
        5. **Kısalık**: SMS formatına uygun, gereksiz dolambaçlı ifadelerden kaçınan ama elit duran bir metin olsun.
        6. **Çıktı SADECE düzeltilmiş mesaj metni olmalıdır.** Başına veya sonuna not ekleme.

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
