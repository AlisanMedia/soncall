# SonCall Next Plan: Agent Onboarding and AI Cost Panel

## 1. Agent Onboarding Screen

Amaç: Yeni başlayan SDR veya Closer, sisteme ilk girdiğinde 5 dakika içinde ne yapacağını anlamalı.

### Agent onboarding akışı

1. Rol tanıma
   - SDR: soğuk lead arar, ihtiyacı anlar, toplantı organize eder.
   - Closer: Google Meet toplantısına girer, sonucu netleştirir.

2. Günlük çalışma adımları
   - Sıradaki lead'i aç.
   - Telefon butonuyla ara.
   - Gerekirse ses kaydını başlat.
   - Notu kurumsal yaz.
   - Sonucu doğru seç: ulaşıldı, randevu, callback, ilgilenmiyor.

3. Callback disiplini
   - Müşteri yeni arama zamanı verirse callback seç.
   - Tarih ve saat boş bırakılmamalı.
   - Sistem 10 dakika önce SMS hatırlatır.
   - Callback kaçarsa manager alarmına düşer.

4. Lead kodu kullanımı
   - Her lead `#0001` formatında aranabilir.
   - Yardımcı chat'e lead koduyla soru sorulabilir.

5. Mini kontrol testi
   - Kullanıcıya 4-5 kısa görev verilir.
   - Tamamlamadan panelin kritik alanları kapalı veya uyarılı olabilir.

### Gerekli geliştirmeler

- `agent_onboarding_progress` tablosu.
- İlk girişte onboarding modalı.
- Agent ayarlarında "Onboarding'i tekrar aç" butonu.
- Role göre farklı onboarding metni.
- Manager tarafında "onboarding tamamladı mı" göstergesi.

## 2. Manager AI Cost Panel

Amaç: Manager, AI analiz ve yardımcı chat maliyetini günlük/haftalık/aylık görmeli.

### İzlenecek olaylar

- Ses transkripsiyonu
- Görüşme AI analizi
- Yardımcı chat sorusu
- SMS metni üretimi/düzeltme
- Lead zenginleştirme/araştırma

### Önerilen tablo

```sql
ai_usage_logs
- id
- user_id
- lead_id
- feature
- model
- input_tokens
- output_tokens
- audio_seconds
- estimated_cost_usd
- metadata
- created_at
```

### Manager panel metrikleri

- Bugünkü AI maliyeti
- Bu haftaki AI maliyeti
- Bu ayki AI maliyeti
- Agent başı maliyet
- Feature bazlı maliyet
- Ortalama analiz maliyeti
- En pahalı 20 işlem

### Maliyet koruma kuralları

- 20 saniye altı kayıtları analiz etmeme.
- 5 dakika üstü kayıtlarda uyarı veya kırpma.
- Basit not düzeltmede ucuz model.
- Kritik randevu/closer analizinde kaliteli model.
- Günlük bütçe eşiği aşılırsa manager alarmı.
