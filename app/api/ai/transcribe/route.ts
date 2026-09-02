
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { logAiUsage } from '@/lib/ai-usage';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

type CallAnalysis = {
    summary?: string;
    potential_level?: 'high' | 'medium' | 'low' | 'not_assessed';
    next_action_type?: 'appointment' | 'callback' | 'none';
    extracted_date?: string | null;
    callback_reason?: string | null;
    sentiment_score?: number;
    suggested_action?: string;
    key_objections?: string[];
    sales_completed?: boolean;
    industry?: string;
    interested_service?: string;
};

type LeadUpdateData = {
    potential_level?: string;
    category?: string;
    appointment_date?: string;
    status?: string;
    callback_at?: string;
    callback_reason?: string;
    callback_reminder_10m_sent?: boolean;
};

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Authenticate
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Parse Request
        const { audioUrl, leadId, durationSeconds } = await request.json();
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
        const audioSeconds = Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0
            ? Math.round(Number(durationSeconds))
            : Math.max(1, Math.round(audioBlob.size / 4000));
        console.log('✅ [AI Analysis] Audio fetched, size:', audioBlob.size, 'bytes');

        const { data: leadMarket } = await supabase
            .from('leads')
            .select('market_id')
            .eq('id', leadId)
            .maybeSingle();

        // CRITICAL FIX: Force MP3 format for better Whisper compatibility
        // WebM codec often causes transcription failures
        const fileName = 'recording.mp3';
        const mimeType = 'audio/mp3';

        console.log('🔄 [AI Analysis] Converting to MP3 for Whisper compatibility');

        // 4. Transcription (Whisper)
        console.log('🎤 [AI Analysis] Starting Whisper transcription...');
        let transcriptText = '';
        try {
            const file = new File([audioBlob], fileName, { type: mimeType });
            const transcriptionModel = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
            const transcription = await openai.audio.transcriptions.create({
                file: file,
                model: transcriptionModel,
                language: 'tr',
                response_format: 'text',
            });

            transcriptText = transcription as unknown as string;
            await logAiUsage(supabase, {
                userId: user.id,
                leadId,
                marketId: leadMarket?.market_id || null,
                feature: 'call_transcription',
                model: transcriptionModel,
                audioSeconds,
                metadata: {
                    audio_size_bytes: audioBlob.size,
                    audio_url: audioUrl,
                },
            });
            console.log('✅ [AI Analysis] Transcription complete, length:', transcriptText.length);
            console.log('📝 [AI Analysis] Transcript preview:', transcriptText.substring(0, 100));
        } catch (whisperError: unknown) {
            const message = whisperError instanceof Error ? whisperError.message : 'Unknown transcription error';
            console.error('❌ [AI Analysis] Whisper error:', message);
            return NextResponse.json({
                error: 'Transcription failed',
                details: message,
                fallback: {
                    summary: '⚠️ Ses tanıma başarısız oldu',
                    potential_level: 'not_assessed'
                }
            }, { status: 500 });
        }

        // 5. Sales Coach Analysis (GPT-4o)
        console.log('🧠 [AI Analysis] Starting GPT-4o analysis...');

        const systemPrompt = `
            Sen ArtificAgent için özelleştirilmiş bir AI Satış Analisti'sin.
            
            ## ŞİRKET BİLGİLERİ:
            **Şirket Adı:** ArtificAgent
            **Sektör:** Yapay Zeka İş Otomasyonu ve Müşteri İletişimi
            
            **ANA HİZMETLER:**
            1. **AI Voice Agent (Yapay Zeka Sesli Asistan)**
               - 7/24 müşteri görüşmeleri
               - Satış, destek, bilgilendirme görüşmeleri
               - Çok dilli destek
               - İnsan benzeri konuşma
            
            2. **AI Voice Receptionist (Yapay Zeka Resepsiyonist)**
               - Gelen aramaları otomatik cevaplama
               - Randevu yönetimi
               - Çağrı yönlendirme
               - 7/24 kesintisiz hizmet
            
            3. **İş Yükü Otomasyonu**
               - Tekrarlayan görevleri otomasyonlaştırma
               - İnsan kaynağı tasarrufu
               - Operasyonel verimlilik artışı
               - Hata oranı azaltma
            
            **HEDEF MÜŞTERİ:**
            - KOBİ'ler (küçük-orta ölçekli işletmeler)
            - Call center'lar ve müşteri hizmetleri departmanları
            - E-ticaret şirketleri
            - Sağlık, eğitim, finans sektörleri
            - Yoğun çağrı alan işletmeler
            
            **DEĞER ÖNERİSİ:**
            "7/24 kesintisiz hizmet, %70 maliyet tasarrufu, %50 daha hızlı yanıt süresi, sıfır hata oranı"
            
            **MÜŞTERİ SORUN NOKTALARI (Pain Points):**
            - Gece/hafta sonu aramalarını kaçırma
            - Yüksek personel maliyeti
            - Tutarsız müşteri deneyimi
            - Çağrı yoğunluğunda kayıp müşteriler
            - İnsan hatası ve unutkanlık
            
            **FİYATLANDIRMA:** Aylık abonelik modeli (görüşme sayısına göre paketler)
            
            ## GÖRÜŞME BAŞARI ÖRNEKLERİ (Bu örnekleri öğren):
            
            **YÜKSEK POTANSİYEL (HIGH) Örnek:**
            "Müşteri: Evet, özellikle gece aramaları kaçırıyoruz. Fiyatınız nedir? Demo istiyorum, yarın müsait miyiz?"
            → NEDEN HIGH: Sorun itirafı + Fiyat sorusu + Demo/Randevu talebi = Satın alma niyeti VAR
            
            **ORTA POTANSİYEL (MEDIUM) Örnek:**
            "Müşteri: İlginç görünüyor ama şu an bütçemiz yok. Belki 2-3 ay sonra tekrar konuşalım."
            → NEDEN MEDIUM: İlgi var AMA somut adım yok. Zaman istiyor = Gelecekte satış şansı var
            
            **DÜŞÜK POTANSİYEL (LOW) Örnek:**
            "Müşteri: Biz zaten başka şirketle çalışıyoruz, memnunuz. Şu an ihtiyacımız yok."
            → NEDEN LOW: Rakip kullanıyor + Memnun = Satış imkansıza yakın
            
            ## KRİTİK KARAR KRİTERLERİ (POTENTIAL_LEVEL için KATIYDI):
            
            ### "high" VERMENİN ŞARTLARI (HEPSİNDEN EN AZ 2'Sİ OLMALI):
            ✅ Müşteri budget/fiyat sorusu sordu
            ✅ Randevu veya demo talep etti
            ✅구체c bir sorun noktası belirtti ("Gece aramaları kaçırıyoruz", "Personel maliyeti yüksek")
            ✅ Karar verici kişi ile konuşuldu (CEO, İşletme Sahibi, Müdür)
            ✅ "Hemen başlamak istiyorum" gibi aciliyet ifadeleri kullandı
            ✅ Önceki çözümlerden memnuniyetsizlik ifade etti
            
            ### "medium" VERMENİN ŞARTLARI:
            ⚠️ Ürüne genel ilgi var AMA somut adım atmıyor
            ⚠️ "Düşünmem lazım", "Önümüzdeki ay konuşalım" gibi erteleme ifadeleri
            ⚠️ Bilgi topluyor, fiyat sormadı
            ⚠️ Karar verici değil, yönlendirme istedi
            
            ### "low" VERMENİN ŞARTLARI:
            ❌ Rakip çözüm kullanıyor ve memnun
            ❌ "İhtiyacımız yok" açık reddi
            ❌ Görüşme 30 saniyeden kısa, ciddi diyalog yok
            ❌ Müşteri sürekli soru değiştiriyor, konuya odaklanmıyor
            
            ### "not_assessed" VERMENİN ŞARTLARI:
            🔇 Ses kaydı çok kısa veya anlaşılmaz
            🔇 Teknik sorunlar var, diyalog çok eksik
            
            ## GÖREV:
            ArtificAgent satış temsilcisinin müşteri ile yaptığı cold call görüşmesini analiz et.
            Yukarıdaki KRİTERLERE SIKI SIKI UYARAK potential_level belirle!
            
            ## İTİRAZ ALGILAMA REHBERİ:
            - "Pahalı" → Fiyat itirazı
            - "Zaten var" → Rakip kullanımı
            - "Düşünmem lazım" → Kararsızlık
            - "Şimdi zamanı değil" → Zamanlama sorunu
            - "Güvenemem" → Güven eksikliği
            
            ## ÇIKTI FORMATI (JSON):
            {
                "summary": "3-5 cümlelik profesyonel özet (tek string, array DEĞİL!). Şirket adımızı 'ArtificAgent' olarak kullan. Hangi hizmeti anlattığımızı belirt (AI Voice Agent/Receptionist/Otomasyon). Müşterinin EN ÖNEMLİ sorununu ve ilgi seviyesini yaz.",
                "potential_level": "high" | "medium" | "low" | "not_assessed",
                "next_action_type": "appointment" | "callback" | "none",
                "extracted_date": "YYYY-MM-DD HH:MM veya null (Bugünün tarihi: ${new Date().toISOString().split('T')[0]})",
                "callback_reason": "Müşterinin neden tekrar aranacağı, yoksa null",
                "sentiment_score": 1-10 (10 çok olumlu),
                "suggested_action": "Spesifik, uygulanabilir aksiyon (örn: 'Yarın 14:00'te Zeynep'e WhatsApp'tan AI Voice Agent demo kaydı gönder')",
                "key_objections": ["itiraz1", "itiraz2"],
                "sales_completed": true/false,
                "customer_name": "Müşteri adı (söylenmişse)",
                "decision_maker": true/false,
                "pain_points": ["Tespit edilen sorun noktaları - örn: Gece aramaları kaçırıyor, Yüksek personel maliyeti"],
                "next_call_timing": "Önerilen sonraki arama zamanı",
                "interested_service": "AI Voice Agent | AI Receptionist | Otomasyon | Belirsiz",
                "industry": "Müşterinin faaliyet gösterdiği sektör (örn: Sağlık, E-ticaret, Turizm, Belirsiz)"
            }
            
            ## ANALİZ KURALLARI:

            ### 0. NEXT ACTION TYPE AYRIMI:
            - Müşteri demo, toplantı, Google Meet, sunum veya closer görüşmesi kabul ettiyse next_action_type = "appointment".
            - Müşteri "patron yok", "müsait değiliz", "yarın ara", "şu gün tekrar arayın", "sonra konuşalım" diyorsa next_action_type = "callback".
            - Görüşmede net bir sonraki zaman yoksa next_action_type = "none" ve extracted_date = null.
            - Callback, satış toplantısı değildir. Callback sadece SDR'ın telefonla tekrar aramasıdır.
            
            ### 1. TARİH ÇIKARIMI (ÖNEMLİ - TÜRKİYE SAATİ!):
            **Saat Dilimi:** Türkiye/İstanbul (UTC+3)
            **Bugünün Tarihi:** ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' })}
            **Şu Anki Saat:** ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })}
            
            **Tarih Hesaplama Kuralları:**
            - "Bugün" = ${new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}
            - "Yarın" = ${new Date(Date.now() + 86400000).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}
            - "Pazartesi", "Salı" vb. → Haftanın ilgili günü (gelecekteki en yakın)
            - Saat belirtilmişse kullan (örn: "14:00")
            - Saat YOK ise varsayılan: "09:00"
            
            **Format:** "YYYY-MM-DD HH:MM" (24 saat formatı)
            **Örnek:** "2026-01-23 14:00"
            
            **ÖRNEKLER:**
            - "Yarın öğleden sonra" → "${new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })} 14:00"
            - "Perşembe sabah" → (Bir sonraki Perşembe) 09:00
            - "2 gün sonra saat 3'te" → (Bugün + 2 gün) 15:00
            
            **Eğer randevu veya callback zamanı YOK:** null döndür
            
            ### 2. POTANSİYEL SEVİYESİ:
            - **HIGH**: Demo/toplantı kabul etti, bütçe konuşuldu, karar vericisiyle görüşülüyor, acil ihtiyaç var, **randevu alındı**
            - **MEDIUM**: İlgileniyor ama henüz taahhüt yok, daha fazla bilgi istedi
            - **LOW**: Şu an ihtiyaç yok ama gelecekte olabilir, pasif ilgi
            - **NOT_ASSESSED**: Görüşme anlamsız/hatalı
            
            ### 3. SOĞUK ARAMA EN İYİ PRATİKLER:
            - İlk 10 saniye kritik: İsim + değer önerisi
            - SPIN metodolojisi: Situation → Problem → Implication → Need-Payoff
            - İtirazları fırsata çevir:
              * "Pahalı" → ROI hesaplama, maliyet-tasarruf analizi
              * "Mevcut çözümümüz var" → Entegrasyon, farklılaştırıcı özellikler
              * "Zamanım yok" → Ücretsiz demo, 15 dakikalık hızlı sunum
            
            ### 4. ÖZET YAZIM KURALLARI:
            - Tek bir paragraph (3-5 cümle)
            - Array veya madde/virgül listesi KULLANMA!
            - Profesyonel dil
            - Şirket adı: "ArtificAgent"
            - Müşteri adı varsa kullan
            
            ### 5. AKSİYON ÖNERİSİ:
            - Spesifik kanal belirt (WhatsApp, Email, Telefon)
            - Zaman belirt (Yarın 14:00, Pazartesi sabah)
            - Ne gönderilecek (Demo linki, Fiyat teklifi, Brochure)
            - Kişiselleştirilmiş (müşteri adı + ihtiyacı)
            - Callback varsa "belirtilen saatte tekrar ara" diye yaz.
            
            ## ÖRNEKLER:
            
            **İyi Özet:**
            "ArtificAgent satış temsilcisi Zeynep ile görüşüyor. Zeynep başlangıçta ilgilenmediğini belirtiyor ancak yapay zeka destekli lead yönetim sisteminin operasyonel maliyetleri nasıl düşürdüğü açıklanınca ilgisi artıyor. Ücretsiz demo teklifi kabul ediliyor ve yarın saat 14:00 için randevu alınıyor."
            
            **Kötü Özet (YAPMA!):**
            "Satış temsilcisi görüşüyor, Müşteri ilgilenmiyor, Demo teklif ediliyor, Randevu alınıyor"
            
            ÖNEMLİ: Her zaman geçerli, parse edilebilir JSON döndür!
        `;

        let analysis: CallAnalysis = {
            summary: 'Analiz yapılamadı',
            potential_level: 'not_assessed',
            sentiment_score: 5,
            suggested_action: 'Manuel inceleme gerekli',
            key_objections: [],
            sales_completed: false
        };

        try {
            const analysisModel = process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini';
            const completion = await openai.chat.completions.create({
                model: analysisModel,
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
            await logAiUsage(supabase, {
                userId: user.id,
                leadId,
                marketId: leadMarket?.market_id || null,
                feature: 'call_analysis',
                model: analysisModel,
                inputTokens: completion.usage?.prompt_tokens || 0,
                outputTokens: completion.usage?.completion_tokens || 0,
                totalTokens: completion.usage?.total_tokens || 0,
                metadata: {
                    potential_level: analysis.potential_level || 'not_assessed',
                    next_action_type: analysis.next_action_type || 'none',
                },
            });
            console.log('✅ [AI Analysis] GPT-4o analysis complete');
        } catch (gptError: unknown) {
            const message = gptError instanceof Error ? gptError.message : 'Unknown analysis error';
            console.error('❌ [AI Analysis] GPT-4o error:', message);
            analysis.summary = `⚠️ AI analizi kısmen başarısız: ${message}`;
        }

        // 6. Database Updates (Auto-Pilot)

        // A) Update Lead Status & Potential
        if (analysis.potential_level !== 'not_assessed') {
            const updateData: LeadUpdateData = {
                potential_level: analysis.potential_level,
                category: analysis.industry || analysis.interested_service || undefined
            };

            // If AI extracted an appointment date, save it to the lead
            if (analysis.extracted_date && analysis.next_action_type === 'appointment') {
                try {
                    // Parse the AI-provided date (should be in "YYYY-MM-DD HH:MM" format)
                    const appointmentDate = new Date(analysis.extracted_date);
                    if (!isNaN(appointmentDate.getTime())) {
                        updateData.appointment_date = appointmentDate.toISOString();
                        console.log('📅 [AI Analysis] Setting appointment_date:', appointmentDate.toISOString());
                    }
                } catch (dateError) {
                    console.error('⚠️ [AI Analysis] Date parsing error:', dateError);
                }
            }

            if (analysis.extracted_date && analysis.next_action_type === 'callback') {
                try {
                    const callbackDate = new Date(analysis.extracted_date);
                    if (!isNaN(callbackDate.getTime())) {
                        updateData.status = 'callback';
                        updateData.callback_at = callbackDate.toISOString();
                        updateData.callback_reason = analysis.callback_reason || analysis.suggested_action || 'AI callback zamanı algıladı';
                        updateData.callback_reminder_10m_sent = false;
                        console.log('⏰ [AI Analysis] Setting callback_at:', callbackDate.toISOString());
                    }
                } catch (dateError) {
                    console.error('⚠️ [AI Analysis] Callback date parsing error:', dateError);
                }
            }

            const { error: updateError } = await supabase.from('leads').update(updateData).eq('id', leadId);

            if (updateError) {
                console.error('⚠️ [AI Analysis] Lead update error:', updateError.message);
            } else {
                console.log('✅ [AI Analysis] Lead updated with AI analysis fields');
            }
        }

        // B) Add AI Note
        let noteContent = `🤖 **AI Satış Analizi**\n\n`;
        noteContent += `📌 **Özet:** ${analysis.summary || 'Analiz yapılamadı'}\n`;
        noteContent += `💡 **Potansiyel:** ${(analysis.potential_level || 'not_assessed').toUpperCase()} (Skor: ${analysis.sentiment_score || 0}/10)\n`;
        if (analysis.extracted_date) {
            noteContent += `📅 **Algılanan Tarih:** ${analysis.extracted_date}\n`;
        }
        if (analysis.next_action_type) {
            noteContent += `➡️ **Sonraki Aksiyon Tipi:** ${analysis.next_action_type}\n`;
        }
        if (analysis.callback_reason) {
            noteContent += `⏰ **Callback Nedeni:** ${analysis.callback_reason}\n`;
        }
        if ((analysis.key_objections || []).length > 0) {
            noteContent += `⚠️ **İtirazlar:** ${(analysis.key_objections || []).join(', ')}\n`;
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
            duration_seconds: audioSeconds
        });

        // D) Log to Activity Feed (Explicitly with AI details)
        await supabase.from('lead_activity_log').insert({
            lead_id: leadId,
            agent_id: user.id,
            action: 'call_analyzed',
            metadata: {
                summary: analysis.summary,
                potential_level: analysis.potential_level,
                sentiment_score: analysis.sentiment_score
            },
            ai_summary: analysis.summary,
            ai_score: analysis.sentiment_score
        });

        console.log('🎉 [AI Analysis] Process complete for lead:', leadId);

        return NextResponse.json({
            success: true,
            analysis: analysis,
            transcription: transcriptText
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const stack = error instanceof Error ? error.stack : undefined;
        console.error('💥 [AI Analysis] CRITICAL ERROR:', error);
        console.error('Stack:', stack);

        return NextResponse.json({
            error: message,
            stack: process.env.NODE_ENV === 'development' ? stack : undefined
        }, { status: 500 });
    }
}
