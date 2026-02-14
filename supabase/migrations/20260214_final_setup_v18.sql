-- ============================================
-- ArtificAgent Cold Calling System
-- FINAL UNIFIED SETUP & FIX SCRIPT (V18 - SUPER FINAL)
-- Includes: Core, Messaging, SMS Logs, Reporting, Voice, Sales, Gamification
-- Fixes: Activity Stream Permissions + Achievement Security (RLS)
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TYPE DEFINITIONS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('manager', 'agent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'founder';

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

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'agent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'purple';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pending_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tc_number TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(4, 1) DEFAULT 0;

CREATE TABLE IF NOT EXISTS upload_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    total_leads INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

ALTER TABLE leads ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS lead_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  agent_id UUID REFERENCES profiles(id),
  amount DECIMAL NOT NULL,
  commission DECIMAL,
  status TEXT DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  manager_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('direct', 'broadcast', 'lead_comment')),
  mentions JSONB DEFAULT '[]'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sent_to TEXT NOT NULL,
    recipient_name TEXT,
    message_body TEXT,
    provider_response TEXT,
    status TEXT CHECK (status IN ('success', 'failed', 'pending')),
    trigger_type TEXT CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'manual', 'bulk', 'motivation')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS recipient_name TEXT;

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily_digest', 'weekly_performance', 'monthly_analytics', 'custom')),
  title TEXT DEFAULT 'Scheduled Report',
  schedule_config JSONB NOT NULL,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  template_name TEXT NOT NULL,
  template_config JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.agent_progress (
    agent_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_progress ADD COLUMN IF NOT EXISTS last_motivation_sent TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL,
    target_sales INTEGER DEFAULT 0,
    target_calls INTEGER DEFAULT 0,
    current_sales INTEGER DEFAULT 0,
    current_calls INTEGER DEFAULT 0,
    is_achieved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, period_key)
);

CREATE TABLE IF NOT EXISTS public.achievement_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('sales', 'calls', 'streak', 'speed')),
    xp_reward INTEGER DEFAULT 100,
    condition_threshold INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES public.achievement_definitions(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_batch_id ON leads(batch_id);
CREATE INDEX IF NOT EXISTS idx_leads_appointment_date ON leads(appointment_date) WHERE appointment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_agent_id ON lead_notes(agent_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_lead_id ON lead_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_agent_id ON lead_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_created_at ON lead_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_agent_id ON sales(agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_check ON sms_logs(lead_id, trigger_type, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_tc_number ON profiles(tc_number);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_achievements ENABLE ROW LEVEL SECURITY;
-- [NEW FIX] Enable RLS on definitions to remove security warning
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES (UPDATED & VERIFIED)
-- ============================================

-- Clean up old policies first
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Managers can update profiles" ON profiles;
DROP POLICY IF EXISTS "Privileged users can update profiles" ON profiles;

DROP POLICY IF EXISTS "Managers can view all leads" ON leads;
DROP POLICY IF EXISTS "Agents can view assigned leads" ON leads;
DROP POLICY IF EXISTS "Managers can insert leads" ON leads;
DROP POLICY IF EXISTS "Managers can update leads" ON leads;
DROP POLICY IF EXISTS "Agents can update assigned leads" ON leads;

DROP POLICY IF EXISTS "Privileged users can view all leads" ON leads;
DROP POLICY IF EXISTS "Privileged users can insert leads" ON leads;
DROP POLICY IF EXISTS "Privileged users can update leads" ON leads;

DROP POLICY IF EXISTS "Managers can view all batches" ON upload_batches;
DROP POLICY IF EXISTS "Managers can insert batches" ON upload_batches;
DROP POLICY IF EXISTS "Anyone can view notes" ON lead_notes;
DROP POLICY IF EXISTS "Agents can insert notes for assigned leads" ON lead_notes;

-- CLEANUP ACTIVITY POLICIES
DROP POLICY IF EXISTS "Anyone can view activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Authenticated can view all activity logs" ON lead_activity_log;
DROP POLICY IF EXISTS "Authenticated can insert activity logs" ON lead_activity_log;

DROP POLICY IF EXISTS "Agents can insert their own sales" ON sales;
DROP POLICY IF EXISTS "Agents can view their own sales" ON sales;
DROP POLICY IF EXISTS "Managers can view all sales" ON sales;
DROP POLICY IF EXISTS "Managers can update sales" ON sales;
DROP POLICY IF EXISTS "Privileged users can view all sales" ON sales;
DROP POLICY IF EXISTS "Privileged users can update sales" ON sales;

DROP POLICY IF EXISTS "Everyone can view progress" ON public.agent_progress;
DROP POLICY IF EXISTS "System can update progress" ON public.agent_progress;
DROP POLICY IF EXISTS "Managers can manage all goals" ON public.goals;
DROP POLICY IF EXISTS "Privileged users can manage all goals" ON public.goals;
DROP POLICY IF EXISTS "Agents can view own goals" ON public.goals;
DROP POLICY IF EXISTS "Everyone can view achievements" ON public.agent_achievements;

DROP POLICY IF EXISTS "Managers can view all sms logs" ON sms_logs;
DROP POLICY IF EXISTS "System can insert logs" ON sms_logs;

-- Clean up Achievement Definitions policies
DROP POLICY IF EXISTS "Anyone can view definitions" ON public.achievement_definitions;
DROP POLICY IF EXISTS "Admins can manage definitions" ON public.achievement_definitions;

-- 1. PROFILES POLICIES
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);

CREATE POLICY "Privileged users can update profiles" ON profiles FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 2. LEADS POLICIES - CRITICAL FIX
CREATE POLICY "Privileged users can view all leads" ON leads FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

CREATE POLICY "Agents can view assigned leads" ON leads FOR SELECT USING (assigned_to = auth.uid());

CREATE POLICY "Privileged users can insert leads" ON leads FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

CREATE POLICY "Privileged users can update leads" ON leads FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

CREATE POLICY "Agents can update assigned leads" ON leads FOR UPDATE USING (assigned_to = auth.uid());

CREATE POLICY "Managers can view all batches" ON upload_batches FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Managers can insert batches" ON upload_batches FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 3. NOTES & LOGS POLICIES - CRITICAL FIX
CREATE POLICY "Anyone can view notes" ON lead_notes FOR SELECT USING (true);
CREATE POLICY "Agents can insert notes for assigned leads" ON lead_notes FOR INSERT WITH CHECK (
    agent_id = auth.uid() AND EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_id AND leads.assigned_to = auth.uid())
);

-- FIXED ACTIVITY LOG POLICIES (More Permissive for Dashboard) - CRITICAL FIX
CREATE POLICY "Authenticated can view all activity logs" ON lead_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert activity logs" ON lead_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- 3.5 SMS LOGS POLICIES
CREATE POLICY "Managers can view all sms logs" 
ON sms_logs FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'manager', 'founder')
    )
);

CREATE POLICY "System can insert logs" 
ON sms_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 4. SALES POLICIES
CREATE POLICY "Agents can insert their own sales" ON sales FOR INSERT WITH CHECK (auth.uid() = agent_id);
CREATE POLICY "Agents can view their own sales" ON sales FOR SELECT USING (auth.uid() = agent_id);

CREATE POLICY "Privileged users can view all sales" ON sales FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

CREATE POLICY "Privileged users can update sales" ON sales FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 5. AGENT PROGRESS POLICIES
CREATE POLICY "Everyone can view progress" ON public.agent_progress FOR SELECT USING (true);
CREATE POLICY "System can update progress" ON public.agent_progress FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Privileged users can manage all goals" ON public.goals FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

CREATE POLICY "Agents can view own goals" ON public.goals FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Everyone can view achievements" ON public.agent_achievements FOR SELECT USING (true);

-- [NEW FIX] ACHIEVEMENT DEFINITIONS POLICIES
CREATE POLICY "Anyone can view definitions" 
ON public.achievement_definitions FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can manage definitions" 
ON public.achievement_definitions FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'founder')
    )
);

-- 6. MESSAGING POLICIES
DROP POLICY IF EXISTS "users_can_view_sent_messages" ON messages;
DROP POLICY IF EXISTS "users_can_view_received_messages" ON messages;
DROP POLICY IF EXISTS "managers_can_view_all_messages" ON messages;
DROP POLICY IF EXISTS "unified_view_messages_policy" ON messages;
DROP POLICY IF EXISTS "unified_send_messages_policy" ON messages;
DROP POLICY IF EXISTS "unified_update_messages_policy" ON messages;
DROP POLICY IF EXISTS "unified_delete_messages_policy" ON messages;

CREATE POLICY "unified_view_messages_policy"
  ON messages FOR SELECT
  USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR
    (message_type = 'broadcast') OR
    (message_type = 'lead_comment' AND (sender_id = auth.uid() OR lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid()))) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
  );

CREATE POLICY "unified_send_messages_policy" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "unified_update_messages_policy" ON messages FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "unified_delete_messages_policy" ON messages FOR DELETE USING (
    sender_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- Message Participants
DROP POLICY IF EXISTS "users_can_view_own_participations" ON message_participants;
DROP POLICY IF EXISTS "system_can_create_participations" ON message_participants;
DROP POLICY IF EXISTS "users_can_update_own_participations" ON message_participants;

CREATE POLICY "users_can_view_own_participations" ON message_participants FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "system_can_create_participations" ON message_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "users_can_update_own_participations" ON message_participants FOR UPDATE USING (user_id = auth.uid());

-- Reporting Policies
DROP POLICY IF EXISTS "Managers can view own scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Managers can manage own scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Managers can view own report executions" ON report_executions;
DROP POLICY IF EXISTS "Managers can trigger executions" ON report_executions;

CREATE POLICY "Managers can view own scheduled reports" ON scheduled_reports FOR SELECT USING (manager_id = auth.uid());
CREATE POLICY "Managers can manage own scheduled reports" ON scheduled_reports FOR ALL USING (manager_id = auth.uid());
CREATE POLICY "Managers can view own report executions" ON report_executions FOR SELECT USING (EXISTS (SELECT 1 FROM scheduled_reports WHERE scheduled_reports.id = report_executions.scheduled_report_id AND scheduled_reports.manager_id = auth.uid()));
CREATE POLICY "Managers can trigger executions" ON report_executions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM scheduled_reports WHERE scheduled_reports.id = scheduled_report_id AND scheduled_reports.manager_id = auth.uid()));

-- Voice Recording Policies
DROP POLICY IF EXISTS "Managers can view all call logs" ON call_logs;
DROP POLICY IF EXISTS "Agents can view their own call logs" ON call_logs;
DROP POLICY IF EXISTS "Agents can insert call logs" ON call_logs;

CREATE POLICY "Managers can view all call logs" ON public.call_logs FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Agents can view their own call logs" ON public.call_logs FOR SELECT TO authenticated USING (agent_id = auth.uid());
CREATE POLICY "Agents can insert call logs" ON public.call_logs FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());

-- ============================================
-- STORAGE SETUP
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access to Call Recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload recordings" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete own avatars" ON storage.objects;

CREATE POLICY "Public Access to Call Recordings" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'call-recordings' );
CREATE POLICY "Authenticated users can upload recordings" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'call-recordings' );

CREATE POLICY "Public can view avatars" ON storage.objects FOR SELECT TO public USING ( bucket_id = 'avatars' );
CREATE POLICY "Auth users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );
CREATE POLICY "Auth users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' AND owner = auth.uid() );
CREATE POLICY "Auth users can delete own avatars" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'avatars' AND owner = auth.uid() );

-- ============================================
-- CORE FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
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

CREATE OR REPLACE FUNCTION create_broadcast_participants() RETURNS TRIGGER AS $$
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
CREATE TRIGGER trg_create_broadcast_participants AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION create_broadcast_participants();

CREATE OR REPLACE FUNCTION update_messages_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_messages_updated_at ON messages;
CREATE TRIGGER trg_update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_messages_updated_at();

-- ============================================
-- ADVANCED GAMIFICATION LOGIC
-- ============================================

CREATE OR REPLACE FUNCTION check_and_grant_achievement(
  p_agent_id UUID, 
  p_slug TEXT, 
  p_current_value INTEGER
) RETURNS VOID AS $$
DECLARE
  v_achievement_id UUID;
  v_threshold INTEGER;
  v_reward INTEGER;
BEGIN
  SELECT id, condition_threshold, xp_reward 
  INTO v_achievement_id, v_threshold, v_reward
  FROM public.achievement_definitions 
  WHERE slug = p_slug;

  IF FOUND AND p_current_value >= v_threshold THEN
    INSERT INTO public.agent_achievements (agent_id, achievement_id)
    VALUES (p_agent_id, v_achievement_id)
    ON CONFLICT (agent_id, achievement_id) DO NOTHING;
    
    IF FOUND THEN
        UPDATE public.agent_progress 
        SET total_xp = total_xp + v_reward
        WHERE agent_id = p_agent_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert Achievements
INSERT INTO public.achievement_definitions (slug, title, description, icon_name, category, xp_reward, condition_threshold) 
VALUES 
    ('first_blood', 'İlk Satış', 'İlk başarılı satışını gerçekleştir.', 'Trophy', 'sales', 500, 1),
    ('warm_up', 'Isınma Turları', '10 arama yap.', 'Phone', 'calls', 100, 10),
    ('call_machine', 'Telefon Makinesi', '50 arama yap.', 'Zap', 'calls', 500, 50),
    ('closer', 'Kapanışçı', '3 satış kapat.', 'Target', 'sales', 1000, 3),
    ('on_fire', 'Alev Aldın', '3 gün üst üste satış yap.', 'Flame', 'streak', 1500, 3),
    ('scribe', 'Kâtip', '20 adet detaylı not al.', 'Feather', 'speed', 300, 20),
    ('networker', 'İletişim Uzmanı', '50 lead statüsünü güncelle.', 'Share2', 'streak', 400, 50)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION initialize_agent_progress(uid UUID) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.agent_progress (agent_id) VALUES (uid) ON CONFLICT (agent_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-Level Function
CREATE OR REPLACE FUNCTION auto_update_agent_level() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_level := GREATEST(1, FLOOR(NEW.total_xp / 1000::float) + 1);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_level_up ON public.agent_progress;
CREATE TRIGGER trg_auto_level_up
    BEFORE UPDATE OF total_xp ON public.agent_progress
    FOR EACH ROW
    WHEN (NEW.total_xp != OLD.total_xp)
    EXECUTE FUNCTION auto_update_agent_level();

UPDATE public.agent_progress
SET current_level = GREATEST(1, FLOOR(total_xp / 1000::float) + 1),
    updated_at = NOW();

-- Triggers for XP Logic

CREATE OR REPLACE FUNCTION handle_call_gamification() RETURNS TRIGGER AS $$
DECLARE
  v_total_calls INTEGER;
BEGIN
    UPDATE public.agent_progress
    SET total_xp = total_xp + 20, last_activity_date = CURRENT_DATE
    WHERE agent_id = NEW.agent_id;

    UPDATE public.goals
    SET current_calls = current_calls + 1
    WHERE agent_id = NEW.agent_id 
    AND is_achieved = false 
    AND period_key = to_char(CURRENT_DATE, 'YYYY-MM');

    SELECT COUNT(*) INTO v_total_calls FROM call_logs WHERE agent_id = NEW.agent_id;
    PERFORM check_and_grant_achievement(NEW.agent_id, 'warm_up', v_total_calls);      
    PERFORM check_and_grant_achievement(NEW.agent_id, 'call_machine', v_total_calls); 

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_call_xp ON call_logs;
CREATE TRIGGER trg_call_xp AFTER INSERT ON call_logs FOR EACH ROW EXECUTE FUNCTION handle_call_gamification();

CREATE OR REPLACE FUNCTION handle_sales_gamification() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.agent_progress
    SET total_xp = total_xp + 100, last_activity_date = CURRENT_DATE
    WHERE agent_id = NEW.agent_id;

    UPDATE public.goals
    SET current_sales = current_sales + 1
    WHERE agent_id = NEW.agent_id 
    AND period_key = to_char(CURRENT_DATE, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sales_gamification ON sales;
CREATE TRIGGER trg_sales_gamification AFTER UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION handle_sales_gamification();

CREATE OR REPLACE FUNCTION handle_note_gamification() RETURNS TRIGGER AS $$
DECLARE
    v_xp_amount INTEGER := 10;
    v_total_notes INTEGER;
BEGIN
    IF LENGTH(NEW.note) > 50 THEN
        v_xp_amount := 25;
    END IF;

    UPDATE public.agent_progress
    SET total_xp = total_xp + v_xp_amount, last_activity_date = CURRENT_DATE
    WHERE agent_id = NEW.agent_id;

    SELECT COUNT(*) INTO v_total_notes FROM lead_notes WHERE agent_id = NEW.agent_id;
    PERFORM check_and_grant_achievement(NEW.agent_id, 'scribe', v_total_notes);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_note_xp ON lead_notes;
CREATE TRIGGER trg_note_xp AFTER INSERT ON lead_notes FOR EACH ROW EXECUTE FUNCTION handle_note_gamification();

CREATE OR REPLACE FUNCTION handle_lead_update_gamification() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status AND NEW.current_agent_id IS NOT NULL THEN
        UPDATE public.agent_progress
        SET total_xp = total_xp + 5 
        WHERE agent_id = NEW.current_agent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lead_update_xp ON leads;
CREATE TRIGGER trg_lead_update_xp AFTER UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION handle_lead_update_gamification();

CREATE OR REPLACE FUNCTION handle_goal_completion() RETURNS TRIGGER AS $$
DECLARE
    v_xp_reward INTEGER := 0;
BEGIN
    IF OLD.current_sales < OLD.target_sales AND NEW.current_sales >= NEW.target_sales AND NEW.target_sales > 0 THEN
        v_xp_reward := v_xp_reward + (NEW.target_sales * 100);
    END IF;

    IF OLD.current_calls < OLD.target_calls AND NEW.current_calls >= NEW.target_calls AND NEW.target_calls > 0 THEN
         v_xp_reward := v_xp_reward + (NEW.target_calls * 5);
    END IF;

    IF v_xp_reward > 0 THEN
        NEW.is_achieved := true;
        UPDATE public.agent_progress
        SET total_xp = total_xp + v_xp_reward
        WHERE agent_id = NEW.agent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_goal_check ON goals;
CREATE TRIGGER trg_goal_check BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION handle_goal_completion();

-- ============================================
-- REALTIME ENABLE
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'agent_progress'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE agent_progress;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'agent_achievements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE agent_achievements;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'leads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE leads;
    END IF;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- ============================================
-- SAFE MIGRATIONS & UPDATES
-- ============================================

CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    title TEXT,
    company TEXT,
    notes TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers and Admin can view contacts" ON public.contacts;
CREATE POLICY "Managers and Admin can view contacts" ON public.contacts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
    );

DROP POLICY IF EXISTS "Managers and Admin can manage contacts" ON public.contacts;
CREATE POLICY "Managers and Admin can manage contacts" ON public.contacts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
    );

ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound')) DEFAULT 'outbound';
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

COMMENT ON TABLE public.contacts IS 'VIP contacts and General Managers phonebook';
COMMENT ON COLUMN public.sms_logs.direction IS 'Direction of the message: inbound or outbound';

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_contact_id ON public.sms_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_direction ON public.sms_logs(direction);
