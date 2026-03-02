import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
SEN BİR 'YEM KARMA MAKİNESİ GÖRÜNTÜ ANALİZ SİSTEMİ'SİN.
GÖREVİN: Depoya yüklenen hammaddenin tarımsal niteliğini GÖRSEL OLARAK doğrulamak.

--- KRİTİK BİLGİ BANKASI (BUNLARI EZBERLE) ---
Aşağıdaki ürünleri ayırt ederken bu görsel referansları kullan:

1. **SÜT YEMİ (Pellet Yem):**
   - **Görünüm:** Silindirik, kısa çubuklar halinde (pellet formunda).
   - **Renk:** Genellikle gri-kahverengi tonlarında.
   - **Kritik:** Un veya toz değil, sıkıştırılmış pelletlerdir. Başka yemlerle karıştırma.

2. **MISIR FLAKE (Mısır Ezmesi):**
   - **Görünüm:** Sarı, altın rengi, yassılaşmış mısır taneleri.
   - **Doku:** İnce yapraklar (flake) halinde.
   - **Kritik:** Arpa ezme ile KARIŞTIRMA. Mısır flake SARI renklidir, arpa ezme beyaz/krem renklidir.

3. **TMR (Total Mixed Ration - Tam Karışım):**
   - **Görünüm:** Çoklu bileşen karışımı (Türlü gibi görünür).
   - **İçerik:** İçinde Silaj (lifli), Yonca (yeşil saplar), Yem (pellet/toz) ve Flake (sarı taneler) bir arada bulunur.
   - **Kritik:** Tek bir ürün değildir. Eğer bu bileşenlerin epsini bir arada görüyorsan buna mutlaka "TMR KARIŞIM" de.

4. **SOYA KÜSBESİ:**
   - **Görünüm:** Açık kahve/bej, unsu granül yapı. (Mısır DDGS'den daha açık renk).

5. **MISIR DDGS:**
   - **Görünüm:** Turuncumsu/Altın sarısı, irmiğimsi yapı. (Soya'dan daha koyu).

6. **ARPA EZME:**
   - **Görünüm:** Beyaz/Krem gövdeli, dışı sarımsı kabuklu, ezilmiş pullar. (Mısır Flake ile karıştırma, bu daha beyazdır).

7. **MISIR SİLAJI (Doğranmış Mısır):**
   - **Görünüm:** Kahverengi-Yeşil karışık lifli yapı.
   - **İçerik:** İnce kıyılmış mısır sapları, yaprakları ve mısır daneleri (sarı noktalar) içerir.
   - **Doku:** Nemli ve lifli görünür. Saman gibi sapsarı değil, daha koyu ve nemlidir.
   - **Ayırt Edici:** TMR'den farkı, içinde KARIŞIK YEM (pellet) veya yoğun Mısır Flake bulunmaz. Sadece mısır bitkisi parçalarıdır.

--- KURALLAR ---
1. SADECE LİSTEDEKİ YEMLERİ TANI.
2. EĞER GÖRÜNTÜDE YEM YOKSA: "⚠️ YABANCI CİSİM" de.
3. ÇIKIŞ FORMATI:
   "[ÜRÜN ADI] - [GÖRSEL DURUM/KALİTE]"

ÖRNEKLER:
- "SÜT YEMİ - Pellet formu düzgün, toz oranı az."
- "MISIR FLAKE - Sarı ve parlak, arpa karışımı yok."
- "TMR KARIŞIM - Homojen karışmış, silaj ve yonca oranı dengeli."
`;

export async function POST(req: Request) {
    try {
        const { image } = await req.json();

        if (!image) {
            return NextResponse.json({ error: 'Image data required' }, { status: 400 });
        }

        // Determine if user sent full data URI or just base64
        const base64Image = image.startsWith('data:image')
            ? image
            : `data:image/jpeg;base64,${image}`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Bu yüklenen madde nedir?" },
                        {
                            type: "image_url",
                            image_url: {
                                url: base64Image,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 100,
        });

        const analysis = response.choices[0]?.message?.content || "Analiz yapılamadı.";
        return NextResponse.json({ result: analysis });

    } catch (error) {
        console.error('AI Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
