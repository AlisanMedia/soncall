-- ============================================
-- FIX: Activity Stream Permissions FINAL
-- Ensure ALL authenticated users can INSERT and SEE activities
-- ============================================

BEGIN;

-- 1. Ensure RLS is ON
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to be clean
DROP POLICY IF EXISTS "Authenticated can view all activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Authenticated can insert activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Enable read access for all users" ON lead_activity_log;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON lead_activity_log;

-- 3. Create PERMISSIVE policies
-- Managers need to SEE everything. Agents need to SEE everything (for leaderboard/live feed?) or just INSERT?
-- The requirements say "Live Activity Monitoring" on Manager Dashboard.
-- So Agents definitely need to INSERT.
-- Managers need to SELECT.

CREATE POLICY "Authenticated can select activity logs"
ON lead_activity_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert activity logs"
ON lead_activity_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Grant explicit permissions just in case
GRANT SELECT, INSERT ON lead_activity_log TO authenticated;
GRANT SELECT, INSERT ON lead_activity_log TO service_role;

-- 5. Fix Profiles & Leads visibility just in case
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);

COMMIT;
