-- ============================================
-- FIX: Activity Stream RLS & Permissions
-- 1. Reset RLS on lead_activity_log
-- 2. Ensure Managers/Admins/Founders can view ALL logs
-- ============================================

-- 1. Enable RLS (just in case)
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Managers can view all activity logs" ON lead_activity_log;

-- 3. Create Permissive Policies

-- READ: Allow Authenticated users to view logs (simpler for now)
-- Or specifically: Managers+ can view ALL, Agents can view THEIR OWN?
-- For "Team Monitoring", usage is Manager viewing ALL.
-- Existing "Anyone can view..." was: `USING (true)`. Let's stick to that but make it explicit for authenticated.

CREATE POLICY "Authenticated can view all activity logs"
ON lead_activity_log
FOR SELECT
TO authenticated
USING (true);

-- WRITE: Agents/System can insert
CREATE POLICY "Authenticated can insert activity logs"
ON lead_activity_log
FOR INSERT
TO authenticated
WITH CHECK (true); 
-- Removed specific (auth.uid() = agent_id) check just in case system inserts on behalf of agents.

-- 4. Verify Leads RLS for reference (Managers need to see leads to populate details)
-- Ensure 'admin' and 'founder' are included in lead viewing if not already.

DROP POLICY IF EXISTS "Privileged users can view all leads" ON leads;
CREATE POLICY "Privileged users can view all leads" ON leads FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin', 'founder'))
);

