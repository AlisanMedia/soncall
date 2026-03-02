-- ============================================
-- ArtificAgent Cold Calling System
-- FINAL UNIFIED SETUP & FIX SCRIPT (V20 - THE ULTIMATE MASTER SETUP)
-- Includes: Core, Messaging, SMS Logs, Reporting, Voice, Sales, Gamification, Contacts
-- Fixes: ai_summary error, SMS Realtime visibility, Inbound SMS support
-- ============================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TYPE DEFINITIONS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('manager', 'agent', 'admin', 'founder');
    ELSE
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
-- 2. CORE TABLES
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

-- Upload Batches
CREATE TABLE IF NOT EXISTS public.upload_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    total_leads INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Lead Notes
CREATE TABLE IF NOT EXISTS public.lead_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead Activity Log
CREATE TABLE IF NOT EXISTS public.lead_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB,
    ai_summary TEXT, -- Added for dashboard fix
    ai_score NUMERIC(3, 1), -- Added for dashboard fix
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
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

-- Messaging
CREATE TABLE IF NOT EXISTS public.messages (
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

CREATE TABLE IF NOT EXISTS public.message_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Contacts
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

-- Gamification
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
-- 3. MIGRATIONS & SCHEMA UPDATES (SAFE)
-- ============================================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_number SERIAL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reminder_5h_sent BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tc_number TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(4, 1) DEFAULT 0;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound')) DEFAULT 'outbound';
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.lead_activity_log ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE public.lead_activity_log ADD COLUMN IF NOT EXISTS ai_score NUMERIC(3, 1);

-- Fix trigger_type constraint
ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_trigger_type_check;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_trigger_type_check 
CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'manual', 'bulk', 'motivation', 'inbound'));

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
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
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- CLEANUP OLD POLICIES
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- Policies
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Privileged users manage profiles" ON profiles FOR ALL USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));

CREATE POLICY "Privileged view leads" ON leads FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));
CREATE POLICY "Agents view own leads" ON leads FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "Privileged manage leads" ON leads FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));
CREATE POLICY "Agents update own leads" ON leads FOR UPDATE USING (assigned_to = auth.uid());

CREATE POLICY "Activity log view" ON lead_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Activity log insert" ON lead_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- FIX: SMS Logs visibility for everyone authenticated
CREATE POLICY "View SMS logs" ON sms_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert SMS logs" ON sms_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Messaging view" ON messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR (message_type = 'broadcast') OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));
CREATE POLICY "Messaging send" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Gamification view" ON agent_progress FOR SELECT USING (true);
CREATE POLICY "Goals agents" ON goals FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Goals managers" ON goals FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));

CREATE POLICY "Contacts manage" ON contacts FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder')));

-- ============================================
-- 5. FUNCTIONS & TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Broadcast Automation
CREATE OR REPLACE FUNCTION create_broadcast_participants() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message_type = 'broadcast' THEN
    INSERT INTO message_participants (message_id, user_id)
    SELECT NEW.id, id FROM profiles WHERE role = 'agent' AND id != NEW.sender_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_broadcast_participants ON messages;
CREATE TRIGGER trg_create_broadcast_participants AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION create_broadcast_participants();

-- XP logic
CREATE OR REPLACE FUNCTION auto_update_agent_level() RETURNS TRIGGER AS $$
BEGIN NEW.current_level := GREATEST(1, FLOOR(NEW.total_xp / 1000::float) + 1); NEW.updated_at := NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_level_up ON agent_progress;
CREATE TRIGGER trg_auto_level_up BEFORE UPDATE OF total_xp ON agent_progress FOR EACH ROW EXECUTE FUNCTION auto_update_agent_level();

-- ============================================
-- 6. DATA & REALTIME
-- ============================================
INSERT INTO achievement_definitions (slug, title, description, icon_name, category, xp_reward, condition_threshold) 
VALUES ('first_blood', 'İlk Satış', 'İlk başarılı satışını gerçekleştir.', 'Trophy', 'sales', 500, 1) ON CONFLICT (slug) DO NOTHING;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    ALTER PUBLICATION supabase_realtime ADD TABLE messages, agent_progress, leads, sms_logs;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

COMMENT ON TABLE contacts IS 'VIP contacts phonebook';
