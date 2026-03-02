-- ============================================
-- ArtificAgent Cold Calling System
-- FINAL UNIFIED SETUP & FIX SCRIPT (V23 - THE ULTIMATE UNIFIED SETUP)
-- Includes: Core, Messaging, SMS Logs, Reporting, Voice, Sales, Gamification, Contacts
-- Optimized for: Fresh Setup or Correction of Existing Systems
-- ============================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TYPE DEFINITIONS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('manager', 'agent', 'admin', 'founder');
    ELSE
        -- Ensure all values exist if type already exists
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'founder';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE lead_status AS ENUM ('pending', 'in_progress', 'contacted', 'appointment', 'not_interested', 'callback');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'potential_level') THEN
        CREATE TYPE potential_level AS ENUM ('high', 'medium', 'low', 'not_assessed');
    END IF;
END $$;

-- ============================================
-- 2. CORE TABLES & MIGRATION HELPER
-- ============================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
    phone_number TEXT,
    tc_number TEXT UNIQUE,
    birth_date DATE,
    city TEXT,
    district TEXT,
    role user_role NOT NULL DEFAULT 'agent',
    theme_color TEXT DEFAULT 'purple',
    commission_rate NUMERIC(4, 1) DEFAULT 0,
    pending_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
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
    reminder_5h_sent BOOLEAN DEFAULT false,
    reminder_1h_sent BOOLEAN DEFAULT false,
    lead_number SERIAL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead Activity Log
CREATE TABLE IF NOT EXISTS public.lead_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB,
    ai_summary TEXT,
    ai_score NUMERIC(3, 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS Logs
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    sent_to TEXT NOT NULL,
    recipient_name TEXT,
    message_body TEXT,
    provider_response TEXT,
    status TEXT CHECK (status IN ('success', 'failed', 'pending')),
    trigger_type TEXT CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'manual', 'bulk', 'motivation', 'inbound')),
    direction TEXT CHECK (direction IN ('inbound', 'outbound')) DEFAULT 'outbound',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENSURE COLUMNS EXIST (Critical Migration Block)
DO $$ 
BEGIN
    -- Leads columns
    ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_number SERIAL;
    ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reminder_5h_sent BOOLEAN DEFAULT false;
    ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false;
    ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;
    
    -- Profiles columns
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tc_number TEXT;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tc_number_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_tc_number_key UNIQUE (tc_number);
    END IF;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(4, 1) DEFAULT 0;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'purple';
    
    -- Lead Activity Log columns (FIX FOR ERROR)
    ALTER TABLE public.lead_activity_log ADD COLUMN IF NOT EXISTS ai_summary TEXT;
    ALTER TABLE public.lead_activity_log ADD COLUMN IF NOT EXISTS ai_score NUMERIC(3, 1);
    
    -- SMS Logs columns
    ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound';
    ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;
    ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

    -- Update SMS Trigger Type Constraint
    ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_trigger_type_check;
    ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_trigger_type_check 
    CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'manual', 'bulk', 'motivation', 'inbound'));

EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Migration step skipped or failed: %', SQLERRM;
END $$;

-- Reporting
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
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

CREATE TABLE IF NOT EXISTS public.report_executions (
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

CREATE TABLE IF NOT EXISTS public.report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    template_name TEXT NOT NULL,
    template_config JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice
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

-- Gamification (Progress, Goals, Achievements)
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

-- ============================================
-- 3. INDICES
-- ============================================
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
CREATE INDEX IF NOT EXISTS idx_leads_lead_number ON public.leads(lead_number);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_contact_id ON public.sms_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_direction ON public.sms_logs(direction);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS for all tables
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

-- CLEANUP OLD POLICIES
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 4.1 PROFILES POLICIES
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Privileged users can update profiles" ON profiles FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 4.2 LEADS POLICIES
CREATE POLICY "Privileged users view leads" ON leads FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));
CREATE POLICY "Agents view assigned leads" ON leads FOR SELECT USING (assigned_to = auth.uid() OR current_agent_id = auth.uid());
CREATE POLICY "Privileged users manage leads" ON leads FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));
CREATE POLICY "Agents update assigned leads" ON leads FOR UPDATE USING (assigned_to = auth.uid() OR current_agent_id = auth.uid());

-- 4.3 UPLOAD BATCHES
CREATE POLICY "Privileged users manage batches" ON upload_batches FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 4.4 NOTES & LOGS (MAX PERMISSIVE FOR DASHBOARD)
CREATE POLICY "Anyone can view notes" ON lead_notes FOR SELECT USING (true);
CREATE POLICY "Agents can insert notes" ON lead_notes FOR INSERT WITH CHECK (
    agent_id = auth.uid() AND EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_id AND (leads.assigned_to = auth.uid() OR leads.current_agent_id = auth.uid()))
);

-- Dashboard visibility fix
CREATE POLICY "Authenticated can select all activity logs" ON lead_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert activity logs" ON lead_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- 4.5 SMS LOGS
CREATE POLICY "Authenticated users can view sms logs" ON public.sms_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert logs" ON sms_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 4.6 SALES
CREATE POLICY "Agents can manage own sales" ON sales FOR ALL USING (auth.uid() = agent_id);
CREATE POLICY "Privileged users view/manage all sales" ON sales FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 4.7 GAMIFICATION & PROGRESS
CREATE POLICY "Everyone can view progress" ON public.agent_progress FOR SELECT USING (true);
CREATE POLICY "System can update progress" ON public.agent_progress FOR ALL USING (true);
CREATE POLICY "Privileged users manage goals" ON public.goals FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Agents view own goals" ON public.goals FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Everyone can view achievements" ON public.agent_achievements FOR SELECT USING (true);
CREATE POLICY "Anyone view achievement definitions" ON public.achievement_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage definitions" ON public.achievement_definitions FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'founder'))
);

-- 4.8 MESSAGING
CREATE POLICY "unified_view_messages" ON messages FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid() OR (message_type = 'broadcast') OR
    (message_type = 'lead_comment' AND (sender_id = auth.uid() OR lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid()))) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "unified_send_messages" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "unified_update_messages" ON messages FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "unified_delete_messages" ON messages FOR DELETE USING (
    sender_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

CREATE POLICY "users_read_participations" ON message_participants FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "system_create_participations" ON message_participants FOR INSERT WITH CHECK (true);

-- 4.9 REPORTING
CREATE POLICY "Managers manage reports" ON scheduled_reports FOR ALL USING (manager_id = auth.uid());
CREATE POLICY "Managers view report executions" ON report_executions FOR SELECT USING (
    EXISTS (SELECT 1 FROM scheduled_reports sr WHERE sr.id = report_executions.scheduled_report_id AND sr.manager_id = auth.uid())
);

-- 4.10 VOICE
CREATE POLICY "View/Record call logs" ON public.call_logs FOR ALL USING (
    agent_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 4.11 CONTACTS
CREATE POLICY "Managers view/manage contacts" ON public.contacts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
);

-- ============================================
-- 5. STORAGE SETUP
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES
DROP POLICY IF EXISTS "Call Recordings Read" ON storage.objects;
DROP POLICY IF EXISTS "Call Recordings Insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatars User Update" ON storage.objects;
DROP POLICY IF EXISTS "Avatars User Delete" ON storage.objects;

CREATE POLICY "Call Recordings Read" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'call-recordings' );
CREATE POLICY "Call Recordings Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'call-recordings' );
CREATE POLICY "Avatars Public Read" ON storage.objects FOR SELECT TO public USING ( bucket_id = 'avatars' );
CREATE POLICY "Avatars Auth Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );
CREATE POLICY "Avatars User Update" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' AND owner = auth.uid() );
CREATE POLICY "Avatars User Delete" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'avatars' AND owner = auth.uid() );

-- ============================================
-- 6. FUNCTIONS & TRIGGERS (SECURITY DEFINER)
-- ============================================

-- Global Updated At function
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Updated At triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_update_messages_updated_at ON messages;
CREATE TRIGGER trg_update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Broadcast Automation
CREATE OR REPLACE FUNCTION create_broadcast_participants() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message_type = 'broadcast' THEN
    INSERT INTO message_participants (message_id, user_id)
    SELECT NEW.id, id FROM profiles WHERE role = 'agent' AND id != NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_broadcast_participants ON messages;
CREATE TRIGGER trg_create_broadcast_participants AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION create_broadcast_participants();

-- Achievement Granting Function
CREATE OR REPLACE FUNCTION check_and_grant_achievement(p_agent_id UUID, p_slug TEXT, p_current_value INTEGER) 
RETURNS VOID AS $$
DECLARE
  v_achievement_id UUID;
  v_threshold INTEGER;
  v_reward INTEGER;
BEGIN
  SELECT id, condition_threshold, xp_reward INTO v_achievement_id, v_threshold, v_reward
  FROM public.achievement_definitions WHERE slug = p_slug;

  IF FOUND AND p_current_value >= v_threshold THEN
    INSERT INTO public.agent_achievements (agent_id, achievement_id)
    VALUES (p_agent_id, v_achievement_id)
    ON CONFLICT (agent_id, achievement_id) DO NOTHING;
    
    IF FOUND THEN
        UPDATE public.agent_progress SET total_xp = total_xp + v_reward WHERE agent_id = p_agent_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-Level Logic
CREATE OR REPLACE FUNCTION auto_update_agent_level() RETURNS TRIGGER AS $$
BEGIN
    NEW.current_level := GREATEST(1, FLOOR(NEW.total_xp / 1000::float) + 1);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_level_up ON public.agent_progress;
CREATE TRIGGER trg_auto_level_up BEFORE UPDATE OF total_xp ON public.agent_progress
FOR EACH ROW WHEN (NEW.total_xp != OLD.total_xp) EXECUTE FUNCTION auto_update_agent_level();

-- XP & Gamification Triggers
CREATE OR REPLACE FUNCTION handle_call_gamification() RETURNS TRIGGER AS $$
DECLARE v_total_calls INTEGER;
BEGIN
    UPDATE public.agent_progress SET total_xp = total_xp + 20, last_activity_date = CURRENT_DATE WHERE agent_id = NEW.agent_id;
    UPDATE public.goals SET current_calls = current_calls + 1 WHERE agent_id = NEW.agent_id AND is_achieved = false AND period_key = to_char(CURRENT_DATE, 'YYYY-MM');
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
    UPDATE public.agent_progress SET total_xp = total_xp + 100, last_activity_date = CURRENT_DATE WHERE agent_id = NEW.agent_id;
    UPDATE public.goals SET current_sales = current_sales + 1 WHERE agent_id = NEW.agent_id AND period_key = to_char(CURRENT_DATE, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sales_gamification ON sales;
CREATE TRIGGER trg_sales_gamification AFTER UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION handle_sales_gamification();

-- Lead Note XP logic
CREATE OR REPLACE FUNCTION handle_note_gamification() RETURNS TRIGGER AS $$
DECLARE
    v_xp_amount INTEGER := 10;
    v_total_notes INTEGER;
BEGIN
    IF LENGTH(NEW.note) > 50 THEN v_xp_amount := 25; END IF;
    UPDATE public.agent_progress SET total_xp = total_xp + v_xp_amount, last_activity_date = CURRENT_DATE WHERE agent_id = NEW.agent_id;
    SELECT COUNT(*) INTO v_total_notes FROM lead_notes WHERE agent_id = NEW.agent_id;
    PERFORM check_and_grant_achievement(NEW.agent_id, 'scribe', v_total_notes);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_note_xp ON lead_notes;
CREATE TRIGGER trg_note_xp AFTER INSERT ON lead_notes FOR EACH ROW EXECUTE FUNCTION handle_note_gamification();

-- Lead Status Update XP
CREATE OR REPLACE FUNCTION handle_lead_update_gamification() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status AND NEW.current_agent_id IS NOT NULL THEN
        UPDATE public.agent_progress SET total_xp = total_xp + 5 WHERE agent_id = NEW.current_agent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lead_update_xp ON leads;
CREATE TRIGGER trg_lead_update_xp AFTER UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION handle_lead_update_gamification();

-- Goal Completion Reward logic
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
        UPDATE public.agent_progress SET total_xp = total_xp + v_xp_reward WHERE agent_id = NEW.agent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_goal_check ON goals;
CREATE TRIGGER trg_goal_check BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION handle_goal_completion();

-- ============================================
-- 7. DATA INITIALIZATION
-- ============================================

-- Achievements
INSERT INTO public.achievement_definitions (slug, title, description, icon_name, category, xp_reward, condition_threshold) 
VALUES 
    ('first_blood', 'İlk Satış', 'İlk başarılı satışını gerçekleştir.', 'Trophy', 'sales', 500, 1),
    ('warm_up', 'Isınma Turları', '10 arama yap.', 'Phone', 'calls', 100, 10),
    ('call_machine', 'Telefon Makinesi', '50 arama yap.', 'Zap', 'calls', 500, 50),
    ('closer', 'Kapanışçı', '3 satış kapat.', 'Target', 'sales', 1000, 3),
    ('on_fire', 'Alev Aldın', '3 gün üst üste satış yap.', 'Flame', 'streak', 1500, 3),
    ('scribe', 'Kâtip', '20 adet detaylı not al.', 'Feather', 'speed', 300, 20),
    ('networker', 'İletişim Uzmanı', '50 lead statüsünü güncelle.', 'Share2', 'streak', 400, 50)
ON CONFLICT (slug) DO UPDATE SET xp_reward = EXCLUDED.xp_reward;

-- Initialize progress for existing profiles
INSERT INTO public.agent_progress (agent_id)
SELECT id FROM profiles
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================
-- 8. REALTIME CONFIGURATION
-- ============================================
DO $$
BEGIN
    -- Create publication if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Safely add tables to publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages, agent_progress, agent_achievements, leads, sms_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- GRANTS
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================
-- DONE. ULTIMATE V23 SYSTEM READY.
-- ============================================
