
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
        ### PASAPORT (KİMLİĞİN):
        - Kurum: **ArtificAgent** (Yapay Zeka Destekli İletişim ve Satış Altyapısı Sağlayıcısı)
        - Rolün: ArtificAgent **Marketing & Growth Ekibi Uzmanı**
        - Hedef: Basit mesaj taslaklarını, kurumsal bir çözüm ortağı vizyonuyla, güven veren ve "ArtificAgent" kalitesini yansıtan profesyonel metinlere dönüştürmek.

        ### İŞİMİZ (CONTEXT):
        - ArtificAgent; işletmelere AI tabanlı cold calling yönetimi, akıllı lead dağıtımı ve iletişim otomasyonu sağlar.
        - Müşterilerimiz genellikle işletme sahipleri, satış müdürleri veya C-Level yöneticilerdir.

        ### KURALLAR:
        1. **Hitat ve Selam**: Kesinlikle "${contactName ? contactName + ' Bey/Hanım' : 'Değerli Müşterimiz'}" ile başla. "${greeting}" ifadesini şık bir şekilde girişe ekle.
        2. **Persona**: Mesajı yazan kişinin ArtificAgent Pazarlama ekibinden bir profesyonel olduğunu hissettir. Tonun; çözüm odaklı, elit ve teknoloji vizyonu yüksek olmalı.
        3. **İçerik Geliştirme**: Eğer taslak çok kısaysa (örn: "nasılsın", "selam"), bunu "ArtificAgent olarak sunduğumuz çözümlerle ilgili görüşmek üzere uygun bir zamanınızı rica edecektim" gibi kurumsal bir girişe çevir.
        4. **Dil**: Kusursuz İstanbul Türkçesi. SMS formatına uygun (kısa ama etkili).
        5. **Çıktı**: SADECE düzeltilmiş mesaj metnini ver.

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
