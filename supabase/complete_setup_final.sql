-- ============================================
-- ArtificAgent Cold Calling System
-- FINAL COMPLETE SETUP SCRIPT (V5)
-- Includes: Core, Messaging, Reporting, Voice Recording, Agent Settings, Admin Email Change
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('manager', 'agent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM ('pending', 'in_progress', 'contacted', 'appointment', 'not_interested', 'callback');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE potential_level AS ENUM ('high', 'medium', 'low', 'not_assessed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 1. CORE TABLES
-- ============================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'agent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Settings & Admin Columns (Safe to run even if table exists)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'purple',
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS pending_email TEXT; -- For manager-approved email changes

-- Upload batches table
CREATE TABLE IF NOT EXISTS upload_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    total_leads INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    address TEXT,
    category TEXT,
    website TEXT,
    rating NUMERIC(2, 1),
    raw_data JSONB,
    status lead_status NOT NULL DEFAULT 'pending',
    potential_level potential_level NOT NULL DEFAULT 'not_assessed',
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    current_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    locked_at TIMESTAMP WITH TIME ZONE,
    batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Lead notes table
CREATE TABLE IF NOT EXISTS lead_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead activity log table
CREATE TABLE IF NOT EXISTS lead_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. MESSAGING SYSTEM TABLES
-- ============================================

-- Messages table for all types of messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL for broadcasts
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL, -- NULL for general messages
  message TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('direct', 'broadcast', 'lead_comment')),
  mentions JSONB DEFAULT '[]'::jsonb, -- Array of mentioned user IDs
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message participants for tracking reads in broadcasts
CREATE TABLE IF NOT EXISTS message_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- ============================================
-- 3. REPORTING SYSTEM TABLES
-- ============================================

-- Scheduled Reports Configuration
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily_digest', 'weekly_performance', 'monthly_analytics', 'custom')),
  title TEXT DEFAULT 'Scheduled Report',
  schedule_config JSONB NOT NULL, -- {frequency, time, timezone, days}
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{email, name}]
  filters JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Execution History
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('pending', 'processing', 'success', 'failed')),
  recipients_count INTEGER DEFAULT 0,
  pdf_url TEXT,
  error_message TEXT,
  metrics_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Report Templates
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  template_name TEXT NOT NULL,
  template_config JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. VOICE RECORDING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    transcription TEXT,
    summary TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Lead indexes
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_batch_id ON leads(batch_id);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_agent_id ON lead_notes(agent_id);

CREATE INDEX IF NOT EXISTS idx_lead_activity_log_lead_id ON lead_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_agent_id ON lead_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_created_at ON lead_activity_log(created_at);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);

CREATE INDEX IF NOT EXISTS idx_message_participants_user ON message_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_message_participants_message ON message_participants(message_id);

-- Reporting indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_manager ON scheduled_reports(manager_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_scheduled_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON report_executions(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_created ON report_executions(created_at DESC);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_participants ENABLE ROW LEVEL SECURITY;

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;


-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles & Leads
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Managers can view all leads" ON leads;
CREATE POLICY "Managers can view all leads" ON leads FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Agents can view assigned leads" ON leads;
CREATE POLICY "Agents can view assigned leads" ON leads FOR SELECT USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Managers can insert leads" ON leads;
CREATE POLICY "Managers can insert leads" ON leads FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Managers can update leads" ON leads;
CREATE POLICY "Managers can update leads" ON leads FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Agents can update assigned leads" ON leads;
CREATE POLICY "Agents can update assigned leads" ON leads FOR UPDATE USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Managers can view all batches" ON upload_batches;
CREATE POLICY "Managers can view all batches" ON upload_batches FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Managers can insert batches" ON upload_batches;
CREATE POLICY "Managers can insert batches" ON upload_batches FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Anyone can view notes" ON lead_notes;
CREATE POLICY "Anyone can view notes" ON lead_notes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Agents can insert notes for assigned leads" ON lead_notes;
CREATE POLICY "Agents can insert notes for assigned leads" ON lead_notes FOR INSERT
    WITH CHECK (agent_id = auth.uid() AND EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_id AND leads.assigned_to = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view activity logs" ON lead_activity_log;
CREATE POLICY "Anyone can view activity logs" ON lead_activity_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON lead_activity_log;
CREATE POLICY "Authenticated users can insert activity logs" ON lead_activity_log FOR INSERT WITH CHECK (auth.uid() = agent_id);


-- Messaging Policies
DROP POLICY IF EXISTS "users_can_view_sent_messages" ON messages;
CREATE POLICY "users_can_view_sent_messages"
  ON messages FOR SELECT
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "users_can_view_received_messages" ON messages;
CREATE POLICY "users_can_view_received_messages"
  ON messages FOR SELECT
  USING (receiver_id = auth.uid());

DROP POLICY IF EXISTS "users_can_view_broadcasts" ON messages;
CREATE POLICY "users_can_view_broadcasts"
  ON messages FOR SELECT
  USING (message_type = 'broadcast' AND receiver_id IS NULL);

DROP POLICY IF EXISTS "managers_can_view_all_messages" ON messages;
CREATE POLICY "managers_can_view_all_messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "users_can_send_messages" ON messages;
CREATE POLICY "users_can_send_messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "users_can_update_messages" ON messages;
CREATE POLICY "users_can_update_messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "users_can_delete_own_messages" ON messages;
CREATE POLICY "users_can_delete_own_messages"
  ON messages FOR DELETE
  USING (sender_id = auth.uid());

-- Message Participants
DROP POLICY IF EXISTS "users_can_view_own_participations" ON message_participants;
CREATE POLICY "users_can_view_own_participations"
  ON message_participants FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "system_can_create_participations" ON message_participants;
CREATE POLICY "system_can_create_participations"
  ON message_participants FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_can_update_own_participations" ON message_participants;
CREATE POLICY "users_can_update_own_participations"
  ON message_participants FOR UPDATE
  USING (user_id = auth.uid());


-- Reporting Policies
DROP POLICY IF EXISTS "Managers can view own scheduled reports" ON scheduled_reports;
CREATE POLICY "Managers can view own scheduled reports"
  ON scheduled_reports FOR SELECT
  USING (manager_id = auth.uid());

DROP POLICY IF EXISTS "Managers can manage own scheduled reports" ON scheduled_reports;
CREATE POLICY "Managers can manage own scheduled reports"
  ON scheduled_reports FOR ALL
  USING (manager_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view own report executions" ON report_executions;
CREATE POLICY "Managers can view own report executions"
  ON report_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_reports 
      WHERE scheduled_reports.id = report_executions.scheduled_report_id 
      AND scheduled_reports.manager_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can trigger executions" ON report_executions;
CREATE POLICY "Managers can trigger executions"
  ON report_executions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduled_reports 
      WHERE scheduled_reports.id = scheduled_report_id 
      AND scheduled_reports.manager_id = auth.uid()
    )
  );

-- Voice Recording Policies (call_logs)
DROP POLICY IF EXISTS "Managers can view all call logs" ON call_logs;
CREATE POLICY "Managers can view all call logs" 
ON public.call_logs FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

DROP POLICY IF EXISTS "Agents can view their own call logs" ON call_logs;
CREATE POLICY "Agents can view their own call logs" 
ON public.call_logs FOR SELECT 
TO authenticated 
USING (
  agent_id = auth.uid()
);

DROP POLICY IF EXISTS "Agents can insert call logs" ON call_logs;
CREATE POLICY "Agents can insert call logs" 
ON public.call_logs FOR INSERT 
TO authenticated 
WITH CHECK (
  agent_id = auth.uid()
);


-- ============================================
-- STORAGE SETUP (Safe for Multiple Runs)
-- ============================================

-- 1. Create 'call-recordings' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create 'avatars' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Rules

-- Call Recordings
DROP POLICY IF EXISTS "Public Access to Call Recordings" ON storage.objects;
CREATE POLICY "Public Access to Call Recordings"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'call-recordings' );

DROP POLICY IF EXISTS "Authenticated users can upload recordings" ON storage.objects;
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'call-recordings' );

-- Avatars Policies
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Auth users can upload avatars" ON storage.objects;
CREATE POLICY "Auth users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Auth users can update own avatars" ON storage.objects;
CREATE POLICY "Auth users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND owner = auth.uid() );

DROP POLICY IF EXISTS "Auth users can delete own avatars" ON storage.objects;
CREATE POLICY "Auth users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' AND owner = auth.uid() );


-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- 1. update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_reports_updated_at ON scheduled_reports;
CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 2. create_broadcast_participants
CREATE OR REPLACE FUNCTION create_broadcast_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message_type = 'broadcast' THEN
    INSERT INTO message_participants (message_id, user_id)
    SELECT NEW.id, id 
    FROM profiles 
    WHERE role = 'agent' AND id != NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_broadcast_participants ON messages;
CREATE TRIGGER trg_create_broadcast_participants
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_broadcast_participants();


-- 3. update_messages_updated_at
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_messages_updated_at ON messages;
CREATE TRIGGER trg_update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();


-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON profiles TO authenticated;
GRANT ALL ON leads TO authenticated;
GRANT ALL ON upload_batches TO authenticated;
GRANT ALL ON lead_notes TO authenticated;
GRANT ALL ON lead_activity_log TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON message_participants TO authenticated;
GRANT ALL ON scheduled_reports TO authenticated;
GRANT ALL ON report_executions TO authenticated;
GRANT ALL ON report_templates TO authenticated;
GRANT ALL ON call_logs TO authenticated;


-- ============================================
-- VERIFY SETUP
-- ============================================

SELECT 
    'FINAL SETUP COMPLETE' as status,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'messages') as checks_messaging,
    (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'scheduled_reports') as checks_reporting,
    (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'call_logs') as checks_voice_recording,
    (SELECT count(*) FROM storage.buckets WHERE id = 'call-recordings') as checks_storage_recordings,
    (SELECT count(*) FROM storage.buckets WHERE id = 'avatars') as checks_storage_avatars;

-- ============================================
-- 5. GAMIFICATION & GOALS SYSTEM
-- ============================================

-- Agent Progress Table (XP & Level)
CREATE TABLE IF NOT EXISTS public.agent_progress (
    agent_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view progress" ON public.agent_progress;
CREATE POLICY "Everyone can view progress" 
    ON public.agent_progress FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "System can update progress" ON public.agent_progress;
CREATE POLICY "System can update progress" 
    ON public.agent_progress FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Goals Table (Monthly Targets)
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL, -- Format: 'YYYY-MM'
    target_sales INTEGER DEFAULT 0,
    target_calls INTEGER DEFAULT 0,
    current_sales INTEGER DEFAULT 0,
    current_calls INTEGER DEFAULT 0,
    is_achieved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, period_key)
);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can manage all goals" ON public.goals;
CREATE POLICY "Managers can manage all goals" 
    ON public.goals FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

DROP POLICY IF EXISTS "Agents can view own goals" ON public.goals;
CREATE POLICY "Agents can view own goals" 
    ON public.goals FOR SELECT 
    USING (agent_id = auth.uid());

-- Achievements Definitions
CREATE TABLE IF NOT EXISTS public.achievement_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('sales', 'calls', 'streak', 'speed')),
    xp_reward INTEGER DEFAULT 100,
    condition_threshold INTEGER NOT NULL -- e.g. 100 calls
);

-- Agent Achievements (Unlocked)
CREATE TABLE IF NOT EXISTS public.agent_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES public.achievement_definitions(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.agent_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view achievements" ON public.agent_achievements;
CREATE POLICY "Everyone can view achievements" 
    ON public.agent_achievements FOR SELECT 
    USING (true);

-- Initial Achievements Data
INSERT INTO public.achievement_definitions (slug, title, description, icon_name, category, xp_reward, condition_threshold) 
VALUES 
    ('first_blood', 'İlk Satış', 'İlk başarılı satışını gerçekleştir.', 'Trophy', 'sales', 500, 1),
    ('warm_up', 'Isınma Turları', '10 arama yap.', 'Phone', 'calls', 100, 10),
    ('call_machine', 'Telefon Makinesi', '50 arama yap.', 'Zap', 'calls', 500, 50),
    ('closer', 'Kapanışçı', '3 satış kapat.', 'Target', 'sales', 1000, 3),
    ('on_fire', 'Alev Aldın', '3 gün üst üste satış yap.', 'Flame', 'streak', 1500, 3)
ON CONFLICT (slug) DO NOTHING;

-- Function: Initialize Progress
CREATE OR REPLACE FUNCTION initialize_agent_progress(uid UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.agent_progress (agent_id)
    VALUES (uid)
    ON CONFLICT (agent_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

