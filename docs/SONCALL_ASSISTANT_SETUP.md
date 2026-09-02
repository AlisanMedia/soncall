# SonCall Uzman Chat Kurulumu

Bu modül Agent panelindeki chat-only yardımcıyı çalıştırır. Yardımcı, aktif agent rolünü, seçili lead'i, lead kodunu ve geçmiş aktiviteleri okuyarak farklı uzmanlık modlarında cevap verir.

## Zorunlu ortam değişkenleri

```env
OPENAI_API_KEY=...
SONCALL_ASSISTANT_MODEL=gpt-4o-mini
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
OPENAI_ENRICH_MODEL=gpt-4o-mini
OPENAI_SMS_MODEL=gpt-4o-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

Opsiyonel lead araştırması için:

```env
GOOGLE_API_KEY=...
GOOGLE_SEARCH_ENGINE_ID=...
```

## Uzman modları

- **SDR Operasyon Koçu:** cold calling, ihtiyaç çıkarma, toplantıya çekme, CTA.
- **Closer Toplantı Stratejisti:** Google Meet akışı, karar verici, kapanış ve toplantı sonucu.
- **İtiraz ve Fiyat Koçu:** fiyat, yetki, zamanlama, güven ve alışkanlık itirazları.
- **Lead İstihbarat Analisti:** lead geçmişi, arama sayısı, notlar, aktivite logları ve riskler.
- **Kalite ve CRM Koçu:** görüşme notu kalitesi, eksik alanlar, manager özeti ve takip disiplini.

## Lead kodu davranışı

- Her lead için `lead_number` kullanılır.
- UI tarafında kod `#0001` formatında gösterilir.
- Chat tarafında `#1`, `#0001`, `SC-1`, `SC-0001` formatları aynı lead olarak aranır.
- Eski leadlerde `lead_number` boşsa unified SQL backfill bloğu bu değerleri doldurur.

## Hızlı test

1. Agent panelinde yardımcı chat'i aç.
2. Uzman modlarından birini seç.
3. Lead başlığındaki kodu kopyala.
4. Chat'e `#0001 geçmişini kontrol et` yaz.
5. Cevapta lead notu, işlenme durumu, aktivite geçmişi veya randevu bilgisi referans edilmelidir.
