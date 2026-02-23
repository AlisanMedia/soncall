-- ========================================================
-- ArtificAgent Cold Calling System
-- FINAL UNIFIED SETUP & FIX SCRIPT (V22 - ULTIMATE & COMPLETE)
-- Includes: Core, Messaging, SMS Logs, Reporting, Voice, Sales, Gamification
-- Fixes: admin/founder Roles, Activity Stream, and Achievement RLS
-- ========================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. TYPE DEFINITIONS
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('manager', 'agent');
    END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Guarantee admin and founder roles exist
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'founder';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE lead_status AS ENUM ('pending', 'in_progress', 'contacted', 'appointment', 'not_interested', 'callback');
    END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'potential_level') THEN
        CREATE TYPE potential_level AS ENUM ('high', 'medium', 'low', 'not_assessed');
    END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================
-- 2. CORE TABLES
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
    appointment_date TIMESTAMPTZ,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

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

-- ============================================
-- 3. MESSAGING & SMS
-- ============================================

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

CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sent_to TEXT NOT NULL,
    recipient_name TEXT,
    message_body TEXT,
    provider_response TEXT,
    status TEXT CHECK (status IN ('success', 'failed', 'pending')),
    trigger_type TEXT CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'manual', 'bulk', 'motivation')),
    direction TEXT CHECK (direction IN ('inbound', 'outbound')) DEFAULT 'outbound',
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. REPORTING & VOICE
-- ============================================

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

-- ============================================
-- 5. GAMIFICATION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_progress (
    agent_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    last_motivation_sent TIMESTAMPTZ DEFAULT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Indices
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
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_contact_id ON public.sms_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_direction ON public.sms_logs(direction);

-- ============================================
-- 6. ROW LEVEL SECURITY (MASTER FIX)
-- ============================================

-- Enable RLS on all tables
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
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Clean up and Apply Global Policies (Robust DROP/CREATE)
DO $$ 
DECLARE pol RECORD; 
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP; 
END $$;

-- 6.1 PROFILES POLICIES
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Privileged users can update profiles" ON profiles FOR UPDATE USING (
    auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 6.2 LEADS POLICIES (admin/founder/manager full access)
CREATE POLICY "Privileged users view leads" ON leads FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));
CREATE POLICY "Agents view assigned leads" ON leads FOR SELECT USING (assigned_to = auth.uid() OR current_agent_id = auth.uid());
CREATE POLICY "Privileged users manage leads" ON leads FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));
CREATE POLICY "Agents update assigned leads" ON leads FOR UPDATE USING (assigned_to = auth.uid() OR current_agent_id = auth.uid());

-- 6.3 BATCHES POLICIES
CREATE POLICY "Privileged users manage batches" ON upload_batches FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));

-- 6.4 NOTES & ACTIVITY (DASHBOARD FIX)
CREATE POLICY "Anyone view notes" ON lead_notes FOR SELECT USING (true);
CREATE POLICY "Agents insert notes" ON lead_notes FOR INSERT WITH CHECK (agent_id = auth.uid());

-- DASHBOARD LIVE FEED: MUST BE SELECTABLE BY ALL AUTHENTICATED USERS
CREATE POLICY "Authenticated select all activity" ON lead_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert all activity" ON lead_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- 6.5 MESSAGING & SMS POLICIES
CREATE POLICY "unified_view_messages" ON messages FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid() OR message_type = 'broadcast' OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "unified_send_messages" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "participant_access" ON message_participants FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));

CREATE POLICY "Privileged view sms logs" ON sms_logs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'founder')));
CREATE POLICY "System insert sms logs" ON sms_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Privileged manage contacts" ON public.contacts FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder')));

-- 6.6 SALES POLICIES
CREATE POLICY "Privileged manage sales" ON sales FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));
CREATE POLICY "Agent sales view/insert" ON sales FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Agent sales insert own" ON sales FOR INSERT WITH CHECK (auth.uid() = agent_id);

-- 6.7 GAMIFICATION POLICIES
CREATE POLICY "Anyone view definitions" ON public.achievement_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Privileged manage definitions" ON public.achievement_definitions FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'founder')));
CREATE POLICY "Public progress access" ON public.agent_progress FOR SELECT USING (true);
CREATE POLICY "System progress access" ON public.agent_progress FOR ALL USING (true);
CREATE POLICY "Anyone view achievements" ON public.agent_achievements FOR SELECT USING (true);
CREATE POLICY "Privileged manage goals" ON public.goals FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));

-- 6.8 VOICE & REPORTING
CREATE POLICY "Privileged call log view" ON public.call_logs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));
CREATE POLICY "Agent own call logs" ON public.call_logs FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Agent insert call logs" ON public.call_logs FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Manager reporting access" ON scheduled_reports FOR ALL USING (manager_id = auth.uid());
CREATE POLICY "Manager execution access" ON report_executions FOR ALL USING (EXISTS (SELECT 1 FROM scheduled_reports s WHERE s.id = scheduled_report_id AND s.manager_id = auth.uid()));

-- ============================================
-- 7. STORAGE SETUP
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Read Recordings" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'call-recordings' );
CREATE POLICY "Upload Recordings" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'call-recordings' );
CREATE POLICY "View Avatars" ON storage.objects FOR SELECT TO public USING ( bucket_id = 'avatars' );
CREATE POLICY "Upload Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );

-- ============================================
-- 8. FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_upd ON profiles;
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_leads_upd ON leads;
CREATE TRIGGER trg_leads_upd BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Broadcast Logic
CREATE OR REPLACE FUNCTION create_broadcast_participants() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message_type = 'broadcast' THEN
    INSERT INTO message_participants (message_id, user_id)
    SELECT NEW.id, id FROM profiles WHERE role = 'agent' AND id != NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_broadcast_participants ON messages;
CREATE TRIGGER trg_broadcast_participants AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION create_broadcast_participants();

-- Gamification Achievement Logic
CREATE OR REPLACE FUNCTION check_and_grant_achievement(p_agent_id UUID, p_slug TEXT, p_current_value INTEGER) RETURNS VOID AS $$
DECLARE v_id UUID; v_th INTEGER; v_rw INTEGER;
BEGIN
  SELECT id, condition_threshold, xp_reward INTO v_id, v_th, v_rw FROM achievement_definitions WHERE slug = p_slug;
  IF FOUND AND p_current_value >= v_th THEN
    INSERT INTO agent_achievements (agent_id, achievement_id) VALUES (p_agent_id, v_id) ON CONFLICT DO NOTHING;
    IF FOUND THEN UPDATE agent_progress SET total_xp = total_xp + v_rw WHERE agent_id = p_agent_id; END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-Level Function
CREATE OR REPLACE FUNCTION auto_update_agent_level() RETURNS TRIGGER AS $$
BEGIN
    NEW.current_level := GREATEST(1, FLOOR(NEW.total_xp / 1000::float) + 1);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_auto_level_up ON agent_progress;
CREATE TRIGGER trg_auto_level_up BEFORE UPDATE OF total_xp ON agent_progress FOR EACH ROW EXECUTE FUNCTION auto_update_agent_level();

-- Triggers for XP Logic (Simplified & Corrected)
CREATE OR REPLACE FUNCTION handle_call_gamification() RETURNS TRIGGER AS $$
DECLARE v_total INTEGER;
BEGIN
    UPDATE agent_progress SET total_xp = total_xp + 20, last_activity_date = CURRENT_DATE WHERE agent_id = NEW.agent_id;
    SELECT COUNT(*) INTO v_total FROM call_logs WHERE agent_id = NEW.agent_id;
    PERFORM check_and_grant_achievement(NEW.agent_id, 'warm_up', v_total);      
    PERFORM check_and_grant_achievement(NEW.agent_id, 'call_machine', v_total); 
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_call_xp ON call_logs;
CREATE TRIGGER trg_call_xp AFTER INSERT ON call_logs FOR EACH ROW EXECUTE FUNCTION handle_call_gamification();

-- ============================================
-- 9. REALTIME & GRANTS
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE messages, agent_progress, agent_achievements, leads;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================
-- 10. SEED DATA (ACHIEVEMENTS)
-- ============================================
INSERT INTO achievement_definitions (slug, title, description, icon_name, category, xp_reward, condition_threshold) 
VALUES 
    ('first_blood', 'İlk Satış', 'İlk başarılı satışını gerçekleştir.', 'Trophy', 'sales', 500, 1),
    ('warm_up', 'Isınma Turları', '10 arama yap.', 'Phone', 'calls', 100, 10),
    ('call_machine', 'Telefon Makinesi', '50 arama yap.', 'Zap', 'calls', 500, 50),
    ('closer', 'Kapanışçı', '3 satış kapat.', 'Target', 'sales', 1000, 3)
ON CONFLICT (slug) DO UPDATE SET xp_reward = EXCLUDED.xp_reward;

-- ============================================
-- DONE. ULTIMATE SYSTEM READY.
-- ============================================
