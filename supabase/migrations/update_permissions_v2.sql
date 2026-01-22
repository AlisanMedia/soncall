-- ============================================
-- UPDATE PERMISSIONS FOR NEW ROLES (Admin & Founder)
-- ============================================

-- 1. Update Profile Permissions (Allow Admin/Founder to update others)
DROP POLICY IF EXISTS "Managers can update profiles" ON profiles;
CREATE POLICY "Privileged users can update profiles" ON profiles FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
);

-- 2. Update Lead Permissions
DROP POLICY IF EXISTS "Managers can view all leads" ON leads;
CREATE POLICY "Privileged users can view all leads" ON leads FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin', 'founder'))
);

DROP POLICY IF EXISTS "Managers can insert leads" ON leads;
CREATE POLICY "Privileged users can insert leads" ON leads FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin', 'founder'))
);

DROP POLICY IF EXISTS "Managers can update leads" ON leads;
CREATE POLICY "Privileged users can update leads" ON leads FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin', 'founder'))
);

-- 3. Update Sales Permissions
DROP POLICY IF EXISTS "Managers can view all sales" ON sales;
CREATE POLICY "Privileged users can view all sales" ON sales FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
);

DROP POLICY IF EXISTS "Managers can update sales" ON sales;
CREATE POLICY "Privileged users can update sales" ON sales FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
);

-- 4. Update Goal Permissions
DROP POLICY IF EXISTS "Managers can manage all goals" ON public.goals;
CREATE POLICY "Privileged users can manage all goals" ON public.goals FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
);

-- 5. Update Unified Message View Policy
DROP POLICY IF EXISTS "unified_view_messages_policy" ON messages;
CREATE POLICY "unified_view_messages_policy"
  ON messages FOR SELECT
  USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR
    (message_type = 'broadcast') OR
    (message_type = 'lead_comment' AND (sender_id = auth.uid() OR lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid()))) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
  );
