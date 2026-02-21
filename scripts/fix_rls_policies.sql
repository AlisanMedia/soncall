-- 1. Genişletilmiş rolleri Enum'a ekle (Hata alırsak yoksayarız)
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

-- 2. Leads tablosu için politikaları güncelle
-- Mevcut olanları silip daha geniş kapsamlısını ekleyelim
DROP POLICY IF EXISTS "Managers can view all leads" ON leads;
CREATE POLICY "Managers and Admins can view all leads"
    ON leads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

DROP POLICY IF EXISTS "Managers can insert leads" ON leads;
CREATE POLICY "Managers and Admins can insert leads"
    ON leads FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

DROP POLICY IF EXISTS "Managers can update leads" ON leads;
CREATE POLICY "Managers and Admins can update leads"
    ON leads FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

-- 3. Batches politikalarını güncelle
DROP POLICY IF EXISTS "Managers can view all batches" ON upload_batches;
CREATE POLICY "Managers and Admins can view all batches"
    ON upload_batches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

DROP POLICY IF EXISTS "Managers can insert batches" ON upload_batches;
CREATE POLICY "Managers and Admins can insert batches"
    ON upload_batches FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('manager', 'admin', 'founder')
        )
    );

-- 4. Activity Log politikalarını (Emniyet için)
-- Zaten "Anyone can view" (true) ama yine de netleştirelim
DROP POLICY IF EXISTS "Anyone can view activity logs" ON lead_activity_log;
CREATE POLICY "Authorized view activity logs"
    ON lead_activity_log FOR SELECT
    USING (true);
