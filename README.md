# ArtificAgent Cold Calling Management System

Modern ve profesyonel bir cold calling yönetim sistemi. Manager'lar CSV ile toplu lead yükleyebilir ve agent'lara dağıtabilir. Agent'lar ise lead'leri tek tek işleyerek notlar alabilir ve WhatsApp'a yönlendirebilir.

## 🚀 Özellikler

### Manager Dashboard
- ✨ CSV/Excel dosya yükleme (Google Maps formatı)
- 📊 Lead önizleme ve doğrulama
- 👥 Agent listesi ve lead dağıtımı
- 🎲 Otomatik eşit dağıtım özelliği
- 📈 Manuel lead atama

### Agent Dashboard
- 🎯 Tek lead odaklı çalışma (atlama yok!)
- 📝 Zorunlu not alma (min. 10 karakter)
- 🔥 Potansiyel seviyesi belirleme (Yüksek/Orta/Düşük)
- 📱 WhatsApp'a direkt yönlendirme
- 📅 Randevuya çevirme
- 🏆 Gerçek zamanlı liderlik tablosu
- 🔒 Lead kilitleme mekanizması (10 dk timeout)

### Teknik Özellikler
- ⚡ Next.js 14 (App Router)
- 🔐 Supabase Authentication
- 🗄️ PostgreSQL Database
- 🎨 Tailwind CSS + Glassmorphism Design
- 📊 Real-time Updates
- 🔒 Row Level Security (RLS)
- 📱 Responsive Design

## 📋 Gereksinimler

- Node.js 18+
- Npm veya Yarn
- Supabase Hesabı

## 🛠️ Kurulum

### 1. Projeyi Klonlayın

```bash
git clone <your-repo-url>
cd soncall
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. Supabase Projesi Oluşturun

1. [Supabase](https://supabase.com) hesabınıza giriş yapın
2. Yeni proje oluşturun
3. Project Settings > API'den URL ve Anon Key'i kopyalayın

### 4. Environment Variables

`.env.local` dosyasını düzenleyin:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Database Schema Kurulumu

Supabase Dashboard > SQL Editor'de `supabase/migrations/001_initial_schema.sql` dosyasındaki SQL kodunu çalıştırın.

### 6. Test Kullanıcıları Oluşturun (Opsiyonel)

`supabase/seed.sql` dosyasındaki SQL kodunu çalıştırarak test kullanıcıları oluşturabilirsiniz.

**Test Hesapları:**
- Manager: `manager@artificagent.com` / `password123`
- Agent 1: `agent1@artificagent.com` / `password123`
- Agent 2: `agent2@artificagent.com` / `password123`

### 7. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Tarayıcıda `http://localhost:3000` adresini açın.

## 📁 Proje Yapısı

```
soncall/
├── app/
│   ├── (auth)/login/          # Login sayfası
│   ├── manager/               # Manager dashboard
│   ├── agent/                 # Agent dashboard
│   └── api/                   # API routes
│       ├── leads/upload/      # CSV upload
│       ├── leads/assign/      # Lead dağıtımı
│       ├── leads/[id]/        # Lead güncelleme
│       ├── leads/unlock-stale/ # Eski lead'leri unlock
│       └── stats/             # Leaderboard istatistikleri
├── components/
│   ├── manager/               # Manager components
│   │   ├── ManagerDashboard.tsx
│   │   ├── FileUpload.tsx
│   │   └── LeadDistribution.tsx
│   └── agent/                 # Agent components
│       ├── AgentDashboard.tsx
│       ├── LeadCard.tsx
│       └── Leaderboard.tsx
├── lib/
│   ├── supabase/              # Supabase clients
│   ├── parsers/               # CSV parsing
│   └── utils.ts               # Utility functions
├── types/                     # TypeScript types
└── supabase/                  # Database schema
```

## 🎯 Kullanım

### Manager Workflow

1. Login olun (manager hesabı ile)
2. CSV dosyasını yükleyin (Google Maps formatı)
3. Lead önizlemesini kontrol edin
4. "Onayla ve Yükle" butonuna tıklayın
5. Agent listesinden dağıtım yapın
6. "Otomatik Dağıt" veya manuel olarak sayıları girin
7. "Dağıtımı Onayla" ile tamamlayın

### Agent Workflow

1. Login olun (agent hesabı ile)
2. İlk lead otomatik olarak gelir
3. Lead bilgilerini inceleyin
4. Potansiyel seviyesini seçin
5. Not yazın (en az 10 karakter)
6. WhatsApp'a yönlendir veya randevuya çevir
7. "Sonraki Lead" ile işlemi tamamlayın
8. Sidebar'daki leaderboard'da sıralamanızı görün

## 📊 CSV Format

Google Maps'ten export edilen CSV dosyaları için örnek format:

```csv
Business Name,Phone,Address,Category,Website,Rating
"Cafe Istanbul","+90 212 123 4567","İstiklal Cad. No:123","Coffee Shop","https://cafe.com",4.5
```

**Gerekli kolonlar:**
- `Business Name` veya `Name`
- `Phone` veya `Phone Number`

**Opsiyonel kolonlar:**
- `Address`
- `Category` veya `Type`
- `Website` veya `URL`
- `Rating`

## 🚀 Deployment

### Vercel Deployment

1. GitHub'a push edin
2. [Vercel](https://vercel.com)'e giriş yapın
3. "New Project" > GitHub repo'nuzu seçin
4. Environment Variables ekleyin:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy edin

### Environment Variables

Production'da şu environment variable'ları eklemeyi unutmayın:

```
NEXT_PUBLIC_SUPABASE_URL=your-production-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-key
```

## 🔒 Güvenlik

- Row Level Security (RLS) tüm tablolarda aktif
- Agent'lar sadece kendi lead'lerini görebilir
- Manager'lar tüm lead'leri görebilir
- Session-based authentication
- Lead locking mekanizması

## 🐛 Bilinen Sorunlar

Şu anda bilinen bir sorun bulunmamaktadır.

## 📝 Lisans

MIT License

## 👥 Destek

Sorun yaşarsanız veya öneriniz varsa lütfen issue açın.

---

**ArtificAgent** ile yapıldı ❤️
