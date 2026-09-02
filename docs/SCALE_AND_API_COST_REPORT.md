# SonCall Ölçek ve API Maliyet Raporu

Tarih: 1 Eylül 2026  
Senaryo: 50 kullanıcı, haftalık yaklaşık 13.000 arama, aylık yaklaşık 56.300 arama

## Yönetici Özeti

Sistem 50 kişilik ekip için teknik olarak kaldırılabilir seviyede görünüyor. Asıl maliyet riski lead aramanın kendisi değil; ses kaydı analizi, yardımcı agent chat kullanımı ve lead araştırmasıdır.

En kritik optimizasyon yapıldı: sabit `gpt-4o` kullanılan operasyonel endpointler varsayılan olarak `gpt-4o-mini` / `gpt-4o-mini-transcribe` kullanacak şekilde değiştirildi. Kalite düşerse ilgili endpoint env değişkeniyle tekrar yükseltilebilir.

## Güncel Maliyet Varsayımları

Kaynak fiyatlar:
- OpenAI `gpt-4o`: input $2.50 / 1M token, output $10.00 / 1M token.
- OpenAI `gpt-4o-mini`: input $0.15 / 1M token, output $0.60 / 1M token.
- OpenAI `gpt-4o-mini-transcribe`: yaklaşık $0.003 / dakika.
- OpenAI `gpt-4o-transcribe`: yaklaşık $0.006 / dakika.
- ElevenLabs Conversational AI: ek çağrı dakikası yaklaşık $0.08 / dakika, concurrency aşımında burst yaklaşık $0.16 / dakika.
- Google Custom Search JSON API: 100 sorgu/gün ücretsiz, ek sorgu $5 / 1.000 sorgu, 10.000 sorgu/gün limit.
- Supabase Pro: $25 / ay başlangıç; API request sayısı ayrı ücretlenmiyor, compute ve disk önemli.

## Aksiyon Bazlı Maliyet

| Kullanım | Varsayılan maliyet | Not |
| --- | ---: | --- |
| Sadece lead açma, telefon linkine basma, not yazma | ~$0 API | Supabase dışında ücretli AI çağrısı yok |
| 1 yardımcı chat sorusu | ~$0.001 | Ortalama 5.000 input + 500 output token varsayımı |
| 1 lead araştırması | $0 veya ~$0.005 | Google günlük 100 ücretsiz sorgu sonrası |
| 1 dakikalık ses kaydı transkripsiyonu | ~$0.003 | `gpt-4o-mini-transcribe` |
| 1 ses kaydı AI analizi | ~$0.001 | Ortalama transcript + analiz promptu |

## Haftalık 13.000 Arama İçin Senaryolar

Aylık hacim hesabı: `13.000 * 4,33 = 56.290 arama/ay`.

| Senaryo | Aylık yaklaşık maliyet |
| --- | ---: |
| Kayıt/AI analiz yok, sadece CRM kullanımı | Supabase planı |
| Her arama 3 dk kaydedilip analiz edilirse | ~$565 OpenAI/ay |
| Her arama 5 dk kaydedilip analiz edilirse | ~$915 OpenAI/ay |
| Eski `gpt-4o` + daha pahalı transcribe düzeninde 3 dk analiz | ~$1.460/ay |
| Eski `gpt-4o` + daha pahalı transcribe düzeninde 5 dk analiz | ~$2.870/ay |

## Yardımcı Agent Kullanımı

| Kullanım | Aylık yaklaşık maliyet |
| --- | ---: |
| 50 kişi, günde 5 chat sorusu, 26 iş günü | ~$7 OpenAI/ay |
| 50 kişi, günde 20 chat sorusu, 26 iş günü | ~$27 OpenAI/ay |
Yardımcı agent chat-only yapıya alındığı için ElevenLabs dakika ve eş zamanlı voice oturumu maliyeti bu modülden çıktı.

## Supabase Kapasite Yorumu

50 kullanıcı için Supabase Pro ile başlamak makul. Kritik olan bağlantı sayısı ve polling yoğunluğu:

- Agent bildirimleri: 30 saniyede bir.
- Agent randevuları: 30 saniyede bir.
- Global görev timer: 60 saniyede bir.
- Manager canlı ekranları: 15-60 saniye arası polling ve bazı realtime abonelikler.

50 agent sadece agent panelindeyse bu trafik yönetilebilir. Manager dashboardları aynı anda açık kalırsa query sayısı artar ama API request ücreti değil, database compute yükü önemlidir. İlk canlı kullanımda Supabase dashboard üzerinden CPU, RAM, slow queries ve realtime connection izlenmeli.

## Minimum Maliyet İçin Kararlar

1. Ses kaydı analizini her aramada otomatik zorunlu yapma. Sadece randevuya dönen, itirazlı veya yüksek potansiyel görüşmelerde kullandır.
2. Yardımcı agentı chat-only kullan; uzman modlarıyla gereksiz uzun cevapları ve token tüketimini sınırlı tut.
3. Agentlara lead koduyla soru sorma alışkanlığı kazandır; doğru bağlam daha kısa ve daha ucuz cevap üretir.
4. Google araştırmayı her lead için otomatik çalıştırma. Sadece kullanıcı “araştır”, “site”, “yorum”, “firma” gibi istediğinde çalışsın.
5. Manager panellerinde 50+ kullanıcı testinde polling aralığını 60 saniyeye çekmeyi veya endpointleri birleştirmeyi planla.
6. OpenAI model env değerlerini varsayılan düşük maliyetli modellerde tut:
   - `SONCALL_ASSISTANT_MODEL=gpt-4o-mini`
   - `OPENAI_ANALYSIS_MODEL=gpt-4o-mini`
   - `OPENAI_ENRICH_MODEL=gpt-4o-mini`
   - `OPENAI_SMS_MODEL=gpt-4o-mini`
   - `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe`

## Canlı Test Checklist

- 50 kullanıcı aynı anda login olabiliyor mu?
- Her agent aynı lead'i iki kere almıyor mu?
- Randevuya çekilen lead closer ekranına düşüyor mu?
- Yardımcı agent `#0001` gibi kodla doğru lead geçmişini getiriyor mu?
- Ses kaydı analizi kullanılıyorsa ortalama kaç saniyede bitiyor?
- Supabase CPU/RAM ve realtime connection kaç oluyor?
- OpenAI usage dashboardda günlük maliyet beklentiye yakın mı?
- ElevenLabs dashboardda voice dakika ve concurrency limiti aşımı var mı?
