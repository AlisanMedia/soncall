-- ============================================
-- FIX: Activity Stream RLS & Permissions v2
-- Comprehensive fix for Manager Access
-- ============================================

BEGIN;

-- 1. PROFILES: Ensure Managers can read profiles (especially their own for role check)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);

-- 2. LEADS: Ensure Managers can view ALL leads (for details join)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Privileged users can view all leads" ON leads;
CREATE POLICY "Privileged users can view all leads" 
ON leads FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('manager', 'admin', 'founder')
    )
);

-- 3. ACTIVITY LOG: Open access for Team Monitoring
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view all activity logs" ON lead_activity_log;
CREATE POLICY "Authenticated can view all activity logs"
ON lead_activity_log FOR SELECT
TO authenticated
USING (true);

-- 4. ACTIVITY LOG: Insert permission
DROP POLICY IF EXISTS "Authenticated can insert activity logs" ON lead_activity_log;
CREATE POLICY "Authenticated can insert activity logs"
ON lead_activity_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. NOTES: Ensure access to notes
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view notes" ON lead_notes;
CREATE POLICY "Anyone can view notes" ON lead_notes FOR SELECT USING (true);

COMMIT;
