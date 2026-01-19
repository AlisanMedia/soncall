# ArtificAgent Cold Calling System - Supabase Kurulum Kılavuzu

Bu kılavuz, Supabase projenizi nasıl kuracağınızı adım adım açıklar.

## 1. Supabase Projesi Oluşturma

1. [Supabase](https://supabase.com) web sitesine gidin
2. "Start your project" veya "Sign in" butonuna tıklayın
3. GitHub hesabınızla giriş yapın
4. "New Project" butonuna tıklayın
5. Organization seçin (veya yeni oluşturun)
6. Proje detaylarını doldurun:
   - **Name**: `artificagent-coldcalling` (veya istediğiniz bir isim)
   - **Database Password**: Güçlü bir şifre belirleyin (kaydedin!)
   - **Region**: Size en yakın bölgeyi seçin (örn. Europe West)
   - **Pricing Plan**: Free tier seçin
7. "Create new project" butonuna tıklayın
8. Proje oluşturulmasını bekleyin (~2 dakika)

## 2. API Keys Alma

1. Supabase Dashboard'da sol menüden **Settings** > **API** sayfasına gidin
2. Şu değerleri kopyalayın:
   - **Project URL**: `https://xxxxx.supabase.co` formatında
   - **anon public**: `eyJhbGc...` gibi uzun bir token

## 3. Environment Variables Yapılandırma

1. Proje klasöründeki `.env.local` dosyasını açın
2. Kopyaladığınız değerleri yapıştırın:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Dosyayı kaydedin

## 4. Database Schema Kurulumu

1. Supabase Dashboard'da sol menüden **SQL Editor** sayfasına gidin
2. "New query" butonuna tıklayın
3. Proje klasöründeki `supabase/migrations/001_initial_schema.sql` dosyasını açın
4. Tüm SQL kodunu kopyalayın
5. Supabase SQL Editor'e yapıştırın
6. Sağ üst köşedeki **"Run"** butonuna tıklayın
7. Başarılı mesajı görene kadar bekleyin

**✅ Success!** yazısını görmelisiniz.

## 5. Test Kullanıcıları Oluşturma (Opsiyonel)

Test için kullanıcılar oluşturmak isterseniz:

1. SQL Editor'de yeni bir query açın
2. `supabase/seed.sql` dosyasındaki SQL kodunu kopyalayın
3. SQL Editor'e yapıştırın
4. **"Run"** butonuna tıklayın

**NOT**: Seed data, şifreleme için PostgreSQL'in `crypt` fonksiyonunu kullanır. Eğer hata alırsanız, kullanıcıları manuel olarak oluşturabilirsiniz.

## 6. Manuel Kullanıcı Oluşturma

Seed script çalışmazsa manuel olarak oluşturun:

### Manager Kullanıcısı

1. Supabase Dashboard > **Authentication** > **Users** sayfasına gidin
2. "Add user" > "Create new user" seçin
3. Bilgileri doldurun:
   - **Email**: `manager@artificagent.com`
   - **Password**: `password123`
   - **Auto Confirm User**: ✅ İşaretle
4. "Create user" butonuna tıklayın
5. Oluşturulan kullanıcının **ID**'sini kopyalayın
6. **SQL Editor**'e gidin ve şu komutu çalıştırın:

```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  'user-id-buraya-yapıştır',
  'manager@artificagent.com',
  'Test Manager',
  'manager'
);
```

### Agent Kullanıcıları

Aynı adımları tekrarlayın:

**Agent 1:**
- Email: `agent1@artificagent.com`
- Password: `password123`
- Role: `agent`
- Full Name: `Ahmet Yılmaz`

**Agent 2:**
- Email: `agent2@artificagent.com`
- Password: `password123`
- Role: `agent`
- Full Name: `Mehmet Demir`

## 7. Database Tables Kontrolü

Tablolar düzgün oluşturulmuş mu kontrol edin:

1. **Table Editor** sayfasına gidin
2. Sol menüde şu tabloları görmelisiniz:
   - ✅ `profiles`
   - ✅ `leads`
   - ✅ `upload_batches`
   - ✅ `lead_notes`
   - ✅ `lead_activity_log`

## 8. Row Level Security (RLS) Kontrolü

1. Herhangi bir tabloyu seçin (örn. `leads`)
2. Üst menüden **"..." > "View Policies"** seçin
3. Her tabloda RLS policy'lerin olduğunu görmelisiniz

## 9. Test Etme

1. Terminalde projeyi çalıştırın:

```bash
npm run dev
```

2. `http://localhost:3000` adresini açın
3. Login sayfasına yönlendirilmelisiniz
4. Manager hesabıyla giriş yapın:
   - Email: `manager@artificagent.com`
   - Password: `password123`

5. Manager dashboard'u görmelisiniz!

## 🎉 Tebrikler!

Supabase kurulumunuz tamamlandı. Artık:
- ✅ Manager olarak CSV yükleyebilirsiniz
- ✅ Lead'leri agent'lara dağıtabilirsiniz  
- ✅ Agent'lar lead'leri işleyebilir

## 🐛 Sorun Giderme

### "Invalid supabaseUrl" Hatası

`.env.local` dosyasındaki URL'nin doğru olduğundan emin olun:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
```

URL'de `http://` değil `https://` olmalı!

### Login Çalışmıyor

1. Supabase Dashboard > **Authentication** > **URL Configuration** sayfasına gidin
2. **Site URL**: `http://localhost:3000` ekleyin
3. **Redirect URLs**: `http://localhost:3000/**` ekleyin

### Tablolar Oluşturulmadı

SQL komutlarını tek tek çalıştırın:
1. İlk önce ENUM type'ları oluşturun
2. Sonra tabloları oluşturun
3. En son RLS policy'leri ekleyin

### Kullanıcı Oluşturulamıyor

- Email adresinin daha önce kullanılmadığından emin olun
- Password en az 6 karakter olmalı
- "Auto Confirm User" kutucuğunu işaretleyin

## 📞 Destek

Sorun devam ederse:
1. Supabase Dashboard'da **Logs** bölümünü kontrol edin
2. Browser console'da hata mesajlarına bakın
3. Issue açın

---

**İyi çalışmalar!** 🚀
