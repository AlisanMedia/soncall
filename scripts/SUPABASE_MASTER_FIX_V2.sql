-- ========================================================
-- ARTIFICAGENT SUPABASE MASTER FIX (V2 - FINAL)
-- Hedef: Canlı aktivite akışı ve Dashboard verilerini admin/founder için açmak
-- ========================================================

-- 1. Rol Tiplerini Emniyete Al (Eksikse Ekle)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'admin') THEN
        ALTER TYPE user_role ADD VALUE 'admin';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'founder') THEN
        ALTER TYPE user_role ADD VALUE 'founder';
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. LEADS Tablosu RLS Revizyonu
-- Manager, Admin ve Founder her şeyi görebilmeli ve yönetebilmeli
DROP POLICY IF EXISTS "Managers can view all leads" ON leads;
DROP POLICY IF EXISTS "Managers and Admins can view all leads" ON leads;
CREATE POLICY "Privileged access to select leads"
    ON leads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

DROP POLICY IF EXISTS "Managers can insert leads" ON leads;
DROP POLICY IF EXISTS "Managers and Admins can insert leads" ON leads;
CREATE POLICY "Privileged access to insert leads"
    ON leads FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

DROP POLICY IF EXISTS "Managers can update leads" ON leads;
DROP POLICY IF EXISTS "Managers and Admins can update leads" ON leads;
CREATE POLICY "Privileged access to update leads"
    ON leads FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

-- 3. UPLOAD BATCHES (Yükleme Grupları) RLS Revizyonu
DROP POLICY IF EXISTS "Managers can view all batches" ON upload_batches;
DROP POLICY IF EXISTS "Managers and Admins can view all batches" ON upload_batches;
CREATE POLICY "Privileged access to select batches"
    ON upload_batches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

DROP POLICY IF EXISTS "Managers can insert batches" ON upload_batches;
DROP POLICY IF EXISTS "Managers and Admins can insert batches" ON upload_batches;
CREATE POLICY "Privileged access to insert batches"
    ON upload_batches FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

-- 4. LEAD ACTIVITY LOG (Canlı Akış) RLS Revizyonu
-- Herkes (authenticated) aktiviteleri görebilmeli ve kendi aktivitelerini ekleyebilmeli
DROP POLICY IF EXISTS "Anyone can view activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Authorized view activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Authenticated can select activity logs" ON lead_activity_log;
CREATE POLICY "Public select activity logs"
    ON lead_activity_log FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Authenticated can insert activity logs" ON lead_activity_log;
CREATE POLICY "Public insert activity logs"
    ON lead_activity_log FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = agent_id);

-- 5. Ekstra Emniyet: Veritabanı İzinleri
GRANT ALL ON leads TO authenticated;
GRANT ALL ON upload_batches TO authenticated;
GRANT ALL ON lead_activity_log TO authenticated;
GRANT ALL ON profiles TO authenticated;

-- SONUÇ: Artık admin ve founder kullanıcıları tüm dashboardu eksiksiz görecektir.
