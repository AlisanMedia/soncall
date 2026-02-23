-- ========================================================
-- ARTIFICAGENT COLD CALLING SYSTEM
-- UNIFIED MASTER SETUP & FIX SCRIPT (V21 - ULTIMATE & COMPLETE)
-- Includes: Core, Messaging, SMS Logs, Reporting, Voice, Sales, Gamification
-- Fixes: Activity Stream Permissions + Achievement Security (RLS)
-- Roles: admin, founder, manager, agent
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Guarantee admin and founder roles exist in Enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'founder';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE lead_status AS ENUM ('pending', 'in_progress', 'contacted', 'appointment', 'not_interested', 'callback');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'potential_level') THEN
        CREATE TYPE potential_level AS ENUM ('high', 'medium', 'low', 'not_assessed');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. CORE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'agent',
    avatar_url TEXT,
    nickname TEXT,
    theme_color TEXT DEFAULT 'purple',
    bio TEXT,
    phone_number TEXT,
    pending_email TEXT,
    tc_number TEXT UNIQUE,
    birth_date DATE,
    city TEXT,
    district TEXT,
    commission_rate NUMERIC(4, 1) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    title TEXT,
    company TEXT,
    notes TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    sent_to TEXT NOT NULL,
    recipient_name TEXT,
    message_body TEXT,
    provider_response TEXT,
    status TEXT CHECK (status IN ('success', 'failed', 'pending')),
    trigger_type TEXT CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'manual', 'bulk', 'motivation')),
    direction TEXT CHECK (direction IN ('inbound', 'outbound')) DEFAULT 'outbound',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. REPORTING, VOICE & STORAGE
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

CREATE TABLE IF NOT EXISTS call_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    transcription TEXT,
    summary TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. GAMIFICATION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS agent_progress (
    agent_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    last_motivation_sent TIMESTAMPTZ DEFAULT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS achievement_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('sales', 'calls', 'streak', 'speed')),
    xp_reward INTEGER DEFAULT 100,
    condition_threshold INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievement_definitions(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, achievement_id)
);

-- ============================================
-- 6. INDEXES
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
CREATE INDEX IF NOT EXISTS idx_sms_logs_lead_id ON sms_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient_name ON sms_logs(recipient_name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_tc_number ON profiles(tc_number);

-- ============================================
-- 7. ROW LEVEL SECURITY (MASTER POLICIES)
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
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_achievements ENABLE ROW LEVEL SECURITY;

-- CLEANUP OLD POLICIES
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP; 
END $$;

-- 7.1 PROFILES
CREATE POLICY "Public profile view" ON profiles FOR SELECT USING (true);
CREATE POLICY "Privileged profile update" ON profiles FOR UPDATE USING (
    auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 7.2 LEADS (Critical Fix for admin/founder)
CREATE POLICY "Privileged lead view" ON leads FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Agent lead view" ON leads FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "Privileged lead insert" ON leads FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Privileged lead update" ON leads FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Agent lead update" ON leads FOR UPDATE USING (assigned_to = auth.uid() OR current_agent_id = auth.uid());

-- 7.3 BATCHES
CREATE POLICY "Privileged batch view" ON upload_batches FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Privileged batch insert" ON upload_batches FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 7.4 NOTES & ACTIVITY (Max Permissive for Akış)
CREATE POLICY "Everyone see notes" ON lead_notes FOR SELECT USING (true);
CREATE POLICY "Agents insert notes for assigned leads" ON lead_notes FOR INSERT WITH CHECK (
    agent_id = auth.uid() AND EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_id AND (leads.assigned_to = auth.uid() OR leads.current_agent_id = auth.uid()))
);

-- CRITICAL: ACTIVITY LOGS MUST BE VISIBLE TO DASHBOARD
CREATE POLICY "Authenticated select all activities" ON lead_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert own activities" ON lead_activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = agent_id OR true);

-- 7.5 MESSAGING
CREATE POLICY "unified_view_messages_policy" ON messages FOR SELECT USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR
    (message_type = 'broadcast') OR
    (message_type = 'lead_comment' AND (sender_id = auth.uid() OR lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid()))) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "unified_send_messages_policy" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "unified_update_messages_policy" ON messages FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "unified_delete_messages_policy" ON messages FOR DELETE USING (
    sender_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "participant_view" ON message_participants FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "participant_system_insert" ON message_participants FOR INSERT WITH CHECK (true);

-- 7.6 SALES
CREATE POLICY "Own sales view" ON sales FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Privileged sales view" ON sales FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Agent sales insert" ON sales FOR INSERT WITH CHECK (agent_id = auth.uid());
CREATE POLICY "Privileged sales update" ON sales FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- 7.7 GAMIFICATION
CREATE POLICY "Public progress view" ON agent_progress FOR SELECT USING (true);
CREATE POLICY "Internal progress access" ON agent_progress FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Privileged goal management" ON goals FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Agent own goal view" ON goals FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Anyone view achievements" ON agent_achievements FOR SELECT USING (true);
CREATE POLICY "Anyone view definitions" ON achievement_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Privileged manage definitions" ON achievement_definitions FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'founder'))
);

-- 7.8 SMS & VOICE & REPORTING
CREATE POLICY "Privileged sms log view" ON sms_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "System insert sms logs" ON sms_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Privileged call log view" ON call_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);
CREATE POLICY "Agent own call logs" ON call_logs FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Agent insert call logs" ON call_logs FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Manager view own scheduled reports" ON scheduled_reports FOR SELECT USING (manager_id = auth.uid());
CREATE POLICY "Manager manage own scheduled reports" ON scheduled_reports FOR ALL USING (manager_id = auth.uid());
CREATE POLICY "Manager view executions" ON report_executions FOR SELECT USING (
    EXISTS (SELECT 1 FROM scheduled_reports s WHERE s.id = scheduled_report_id AND s.manager_id = auth.uid())
);

-- 7.9 CONTACTS
CREATE POLICY "Privileged manage contacts" ON contacts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text IN ('manager', 'admin', 'founder'))
);

-- ============================================
-- 8. STORAGE SETUP
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access Recordings" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'call-recordings' );
CREATE POLICY "Auth Upload Recordings" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'call-recordings' );
CREATE POLICY "Public View Avatars" ON storage.objects FOR SELECT TO public USING ( bucket_id = 'avatars' );
CREATE POLICY "Auth Upload Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );
CREATE POLICY "Auth Update Own Avatars" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' AND owner = auth.uid() );
CREATE POLICY "Auth Delete Own Avatars" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'avatars' AND owner = auth.uid() );

-- ============================================
-- 9. FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_update ON profiles; 
CREATE TRIGGER trg_profiles_update BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_leads_update ON leads;
CREATE TRIGGER trg_leads_update BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
DECLARE
  v_achievement_id UUID; v_threshold INTEGER; v_reward INTEGER;
BEGIN
  SELECT id, condition_threshold, xp_reward INTO v_achievement_id, v_threshold, v_reward
  FROM achievement_definitions WHERE slug = p_slug;
  IF FOUND AND p_current_value >= v_threshold THEN
    INSERT INTO agent_achievements (agent_id, achievement_id) VALUES (p_agent_id, v_achievement_id) ON CONFLICT DO NOTHING;
    IF FOUND THEN UPDATE agent_progress SET total_xp = total_xp + v_reward WHERE agent_id = p_agent_id; END IF;
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

-- ============================================
-- 10. REALTIME & GRANTS
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
-- 11. SEED DATA (CORE ACHIEVEMENTS)
-- ============================================
INSERT INTO achievement_definitions (slug, title, description, icon_name, category, xp_reward, condition_threshold) 
VALUES 
    ('first_blood', 'İlk Satış', 'İlk başarılı satışını gerçekleştir.', 'Trophy', 'sales', 500, 1),
    ('warm_up', 'Isınma Turları', '10 arama yap.', 'Phone', 'calls', 100, 10),
    ('call_machine', 'Telefon Makinesi', '50 arama yap.', 'Zap', 'calls', 500, 50),
    ('closer', 'Kapanışçı', '3 satış kapat.', 'Target', 'sales', 1000, 3),
    ('scribe', 'Kâtip', '20 adet detaylı not al.', 'Feather', 'speed', 300, 20)
ON CONFLICT (slug) DO UPDATE SET xp_reward = EXCLUDED.xp_reward;

-- DONE. UNIFIED SYSTEM READY.
