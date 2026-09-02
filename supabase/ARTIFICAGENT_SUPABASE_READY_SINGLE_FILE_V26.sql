-- ============================================
-- ArtificAgent SDR / Closer Operating System
-- FINAL UNIFIED SETUP & FIX SCRIPT
-- Version: V26 - SDR / CLOSER + CALLBACK + MANAGER ALERTS READY
-- Includes: Core CRM, Lead Pipeline, SDR/Closer roles, Google Meet meetings,
-- Callback SMS reminders, Messaging, SMS Logs, Reporting, Voice, Sales,
-- Gamification, Contacts, RLS
-- Optimized for: Fresh setup or correction of existing Supabase projects
-- ============================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. TYPE DEFINITIONS
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('manager', 'agent', 'admin', 'founder');
    ELSE
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'agent';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'founder';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE lead_status AS ENUM ('pending', 'in_progress', 'contacted', 'appointment', 'not_interested', 'callback');
    ELSE
        ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'pending';
        ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'in_progress';
        ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'contacted';
        ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'appointment';
        ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'not_interested';
        ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'callback';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'potential_level') THEN
        CREATE TYPE potential_level AS ENUM ('high', 'medium', 'low', 'not_assessed');
    ELSE
        ALTER TYPE potential_level ADD VALUE IF NOT EXISTS 'high';
        ALTER TYPE potential_level ADD VALUE IF NOT EXISTS 'medium';
        ALTER TYPE potential_level ADD VALUE IF NOT EXISTS 'low';
        ALTER TYPE potential_level ADD VALUE IF NOT EXISTS 'not_assessed';
    END IF;
END $$;

-- ============================================
-- 2. CORE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
    phone_number TEXT,
    tc_number TEXT,
    birth_date DATE,
    city TEXT,
    district TEXT,
    role user_role NOT NULL DEFAULT 'agent',
    sales_role TEXT NOT NULL DEFAULT 'sdr',
    theme_color TEXT DEFAULT 'purple',
    commission_rate NUMERIC(4, 1) DEFAULT 0,
    pending_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.upload_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    total_leads INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sdr_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    closer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    current_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    locked_at TIMESTAMP WITH TIME ZONE,
    batch_id UUID REFERENCES public.upload_batches(id) ON DELETE SET NULL,
    appointment_date TIMESTAMPTZ,
    callback_at TIMESTAMPTZ,
    callback_reason TEXT,
    callback_reminder_10m_sent BOOLEAN DEFAULT false,
    meeting_url TEXT,
    meeting_status TEXT NOT NULL DEFAULT 'scheduled',
    reminder_5h_sent BOOLEAN DEFAULT false,
    reminder_1h_sent BOOLEAN DEFAULT false,
    lead_number SERIAL UNIQUE,
    processed_at TIMESTAMP WITH TIME ZONE,
    ai_summary TEXT,
    next_action_date TIMESTAMP WITH TIME ZONE,
    ai_sentiment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB,
    ai_summary TEXT,
    ai_score NUMERIC(3, 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    commission NUMERIC(12, 2),
    status TEXT DEFAULT 'pending',
    approved_at TIMESTAMPTZ,
    manager_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    message_type TEXT NOT NULL,
    mentions JSONB DEFAULT '[]'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.message_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    sent_to TEXT NOT NULL,
    recipient_name TEXT,
    message_body TEXT,
    provider_response TEXT,
    status TEXT,
    trigger_type TEXT,
    direction TEXT DEFAULT 'outbound',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    report_type TEXT NOT NULL,
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
    scheduled_report_id UUID REFERENCES public.scheduled_reports(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL,
    execution_status TEXT NOT NULL,
    recipients_count INTEGER DEFAULT 0,
    pdf_url TEXT,
    error_message TEXT,
    metrics_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    template_name TEXT NOT NULL,
    template_config JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    transcription TEXT,
    summary TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_progress (
    agent_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    last_activity_timestamp TIMESTAMPTZ DEFAULT NOW(),
    last_motivation_sent TIMESTAMPTZ DEFAULT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    category TEXT NOT NULL,
    xp_reward INTEGER DEFAULT 100,
    condition_threshold INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES public.achievement_definitions(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, achievement_id)
);

-- ============================================
-- 3. MIGRATION / COLUMN GUARANTEE BLOCK
-- ============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tc_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'purple';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(4, 1) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pending_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sales_role TEXT DEFAULT 'sdr';

UPDATE public.profiles
SET sales_role = 'sdr'
WHERE sales_role IS NULL OR role::text <> 'agent';

ALTER TABLE public.profiles ALTER COLUMN sales_role SET DEFAULT 'sdr';
ALTER TABLE public.profiles ALTER COLUMN sales_role SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tc_number_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tc_number_key UNIQUE (tc_number);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sales_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sales_role_check
CHECK (sales_role IN ('sdr', 'closer'));

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sdr_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS closer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meeting_status TEXT DEFAULT 'scheduled';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS current_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS callback_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS callback_reason TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS callback_reminder_10m_sent BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reminder_5h_sent BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_sentiment TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_number INTEGER;

CREATE SEQUENCE IF NOT EXISTS public.leads_lead_number_seq;
ALTER SEQUENCE public.leads_lead_number_seq OWNED BY public.leads.lead_number;
ALTER TABLE public.leads ALTER COLUMN lead_number SET DEFAULT nextval('public.leads_lead_number_seq');

WITH numbered AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY created_at, id)
        + COALESCE((SELECT MAX(lead_number) FROM public.leads WHERE lead_number IS NOT NULL), 0) AS next_number
    FROM public.leads
    WHERE lead_number IS NULL
)
UPDATE public.leads l
SET lead_number = numbered.next_number
FROM numbered
WHERE l.id = numbered.id;

SELECT setval(
    'public.leads_lead_number_seq',
    GREATEST(COALESCE((SELECT MAX(lead_number) FROM public.leads), 1), 1),
    COALESCE((SELECT MAX(lead_number) FROM public.leads), 0) > 0
);

UPDATE public.leads
SET sdr_id = assigned_to
WHERE sdr_id IS NULL AND assigned_to IS NOT NULL;

UPDATE public.leads
SET meeting_status = 'scheduled'
WHERE meeting_status IS NULL;

ALTER TABLE public.leads ALTER COLUMN meeting_status SET DEFAULT 'scheduled';
ALTER TABLE public.leads ALTER COLUMN meeting_status SET NOT NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_meeting_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_meeting_status_check
CHECK (meeting_status IN ('scheduled', 'completed', 'no_show', 'won', 'lost'));

ALTER TABLE public.lead_activity_log ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.lead_activity_log ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE public.lead_activity_log ADD COLUMN IF NOT EXISTS ai_score NUMERIC(3, 1);

ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound';
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_status_check;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_status_check
CHECK (status IN ('success', 'failed', 'pending'));

ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_trigger_type_check;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_trigger_type_check
CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'callback_10m', 'manual', 'bulk', 'motivation', 'inbound'));

ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_direction_check;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_direction_check
CHECK (direction IN ('inbound', 'outbound'));

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
CHECK (message_type IN ('direct', 'broadcast', 'lead_comment'));

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_status_check
CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.scheduled_reports DROP CONSTRAINT IF EXISTS scheduled_reports_report_type_check;
ALTER TABLE public.scheduled_reports ADD CONSTRAINT scheduled_reports_report_type_check
CHECK (report_type IN ('daily_digest', 'weekly_performance', 'monthly_analytics', 'custom'));

ALTER TABLE public.report_executions DROP CONSTRAINT IF EXISTS report_executions_execution_status_check;
ALTER TABLE public.report_executions ADD CONSTRAINT report_executions_execution_status_check
CHECK (execution_status IN ('pending', 'processing', 'success', 'failed'));

ALTER TABLE public.achievement_definitions DROP CONSTRAINT IF EXISTS achievement_definitions_category_check;
ALTER TABLE public.achievement_definitions ADD CONSTRAINT achievement_definitions_category_check
CHECK (category IN ('sales', 'calls', 'appointments', 'meetings', 'streak', 'speed'));

ALTER TABLE public.agent_progress ADD COLUMN IF NOT EXISTS last_activity_timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.agent_progress ADD COLUMN IF NOT EXISTS last_motivation_sent TIMESTAMPTZ DEFAULT NULL;

-- ============================================
-- 4. INDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_sales_role ON public.profiles(sales_role);
CREATE INDEX IF NOT EXISTS idx_profiles_tc_number ON public.profiles(tc_number);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_sdr_id ON public.leads(sdr_id);
CREATE INDEX IF NOT EXISTS idx_leads_closer_id ON public.leads(closer_id);
CREATE INDEX IF NOT EXISTS idx_leads_current_agent_id ON public.leads(current_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_batch_id ON public.leads(batch_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_number ON public.leads(lead_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_lead_number_unique ON public.leads(lead_number) WHERE lead_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_appointment_date ON public.leads(appointment_date) WHERE appointment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_callback_at ON public.leads(callback_at) WHERE callback_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_callback_reminder ON public.leads(callback_at, callback_reminder_10m_sent)
WHERE callback_at IS NOT NULL AND status = 'callback';
CREATE INDEX IF NOT EXISTS idx_leads_meeting_pipeline ON public.leads(closer_id, appointment_date) WHERE appointment_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_agent_id ON public.lead_notes(agent_id);

CREATE INDEX IF NOT EXISTS idx_lead_activity_log_lead_id ON public.lead_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_agent_id ON public.lead_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_created_at ON public.lead_activity_log(created_at);

CREATE INDEX IF NOT EXISTS idx_sales_agent_id ON public.sales(agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_lead_id ON public.sales(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON public.messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_participants_user ON public.message_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_number);

CREATE INDEX IF NOT EXISTS idx_sms_logs_check ON public.sms_logs(lead_id, trigger_type, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_logs_contact_id ON public.sms_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_direction ON public.sms_logs(direction);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_to ON public.sms_logs(sent_to);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs(created_at DESC);

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_achievements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 5.1 PROFILES
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY "Privileged users can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

CREATE POLICY "Privileged users can update profiles"
ON public.profiles
FOR UPDATE
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
)
WITH CHECK (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

-- 5.2 LEADS
CREATE POLICY "Privileged users view leads"
ON public.leads
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

CREATE POLICY "Agents view owned SDR closer leads"
ON public.leads
FOR SELECT
USING (
    assigned_to = auth.uid()
    OR sdr_id = auth.uid()
    OR closer_id = auth.uid()
    OR current_agent_id = auth.uid()
);

CREATE POLICY "Privileged users manage leads"
ON public.leads
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

CREATE POLICY "Agents update owned SDR closer leads"
ON public.leads
FOR UPDATE
USING (
    assigned_to = auth.uid()
    OR sdr_id = auth.uid()
    OR closer_id = auth.uid()
    OR current_agent_id = auth.uid()
)
WITH CHECK (
    assigned_to = auth.uid()
    OR sdr_id = auth.uid()
    OR closer_id = auth.uid()
    OR current_agent_id = auth.uid()
);

-- 5.3 UPLOAD BATCHES
CREATE POLICY "Privileged users manage batches"
ON public.upload_batches
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

-- 5.4 NOTES & ACTIVITY
CREATE POLICY "Anyone can view notes"
ON public.lead_notes
FOR SELECT
USING (true);

CREATE POLICY "Agents can insert notes for owned SDR closer leads"
ON public.lead_notes
FOR INSERT
WITH CHECK (
    agent_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.leads l
        WHERE l.id = lead_id
          AND (
              l.assigned_to = auth.uid()
              OR l.sdr_id = auth.uid()
              OR l.closer_id = auth.uid()
              OR l.current_agent_id = auth.uid()
          )
    )
);

CREATE POLICY "Privileged users delete notes"
ON public.lead_notes
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

CREATE POLICY "Authenticated can select all activity logs"
ON public.lead_activity_log
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert activity logs"
ON public.lead_activity_log
FOR INSERT
TO authenticated
WITH CHECK (
    agent_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

-- 5.5 SMS & CONTACTS
CREATE POLICY "Managers view manage contacts"
ON public.contacts
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

CREATE POLICY "Authenticated users can view sms logs"
ON public.sms_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert sms logs"
ON public.sms_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update sms logs"
ON public.sms_logs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 5.6 SALES
CREATE POLICY "Agents can manage own sales"
ON public.sales
FOR ALL
USING (auth.uid() = agent_id)
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Privileged users view manage all sales"
ON public.sales
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

-- 5.7 GAMIFICATION & GOALS
CREATE POLICY "Everyone can view progress"
ON public.agent_progress
FOR SELECT
USING (true);

CREATE POLICY "Agents can initialize own progress"
ON public.agent_progress
FOR INSERT
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Privileged users manage progress"
ON public.agent_progress
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

CREATE POLICY "Privileged users manage goals"
ON public.goals
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

CREATE POLICY "Agents view own goals"
ON public.goals
FOR SELECT
USING (agent_id = auth.uid());

CREATE POLICY "Everyone can view achievements"
ON public.agent_achievements
FOR SELECT
USING (true);

CREATE POLICY "Anyone view achievement definitions"
ON public.achievement_definitions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage achievement definitions"
ON public.achievement_definitions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('admin', 'founder')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('admin', 'founder')
    )
);

-- 5.8 MESSAGING
CREATE POLICY "unified_view_messages"
ON public.messages
FOR SELECT
USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR message_type = 'broadcast'
    OR (
        message_type = 'lead_comment'
        AND lead_id IN (
            SELECT id
            FROM public.leads
            WHERE assigned_to = auth.uid()
               OR sdr_id = auth.uid()
               OR closer_id = auth.uid()
               OR current_agent_id = auth.uid()
        )
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

CREATE POLICY "unified_send_messages"
ON public.messages
FOR INSERT
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "unified_update_messages"
ON public.messages
FOR UPDATE
USING (sender_id = auth.uid() OR receiver_id = auth.uid())
WITH CHECK (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "unified_delete_messages"
ON public.messages
FOR DELETE
USING (
    sender_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

CREATE POLICY "users_read_participations"
ON public.message_participants
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "users_update_participations"
ON public.message_participants
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "system_create_participations"
ON public.message_participants
FOR INSERT
WITH CHECK (true);

-- 5.9 REPORTING
CREATE POLICY "Managers manage reports"
ON public.scheduled_reports
FOR ALL
USING (
    manager_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('admin', 'founder')
    )
)
WITH CHECK (
    manager_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('admin', 'founder')
    )
);

CREATE POLICY "Managers view report executions"
ON public.report_executions
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.scheduled_reports sr
        WHERE sr.id = report_executions.scheduled_report_id
          AND (
              sr.manager_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.profiles p
                  WHERE p.id = auth.uid()
                    AND p.role::text IN ('admin', 'founder')
              )
          )
    )
);

CREATE POLICY "Everyone can view public or own report templates"
ON public.report_templates
FOR SELECT
USING (
    is_public = true
    OR manager_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('admin', 'founder')
    )
);

CREATE POLICY "Managers manage own report templates"
ON public.report_templates
FOR ALL
USING (
    manager_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('admin', 'founder')
    )
)
WITH CHECK (
    manager_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('admin', 'founder')
    )
);

-- 5.10 VOICE
CREATE POLICY "View record call logs"
ON public.call_logs
FOR ALL
USING (
    agent_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
)
WITH CHECK (
    agent_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role::text IN ('manager', 'admin', 'founder')
    )
);

-- ============================================
-- 6. STORAGE SETUP
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Call Recordings Read" ON storage.objects;
DROP POLICY IF EXISTS "Call Recordings Insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatars User Update" ON storage.objects;
DROP POLICY IF EXISTS "Avatars User Delete" ON storage.objects;

CREATE POLICY "Call Recordings Read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'call-recordings');

CREATE POLICY "Call Recordings Insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'call-recordings');

CREATE POLICY "Avatars Public Read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Avatars Auth Insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Avatars User Update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid());

CREATE POLICY "Avatars User Delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid());

-- ============================================
-- 7. FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_messages_updated_at ON public.messages;
CREATE TRIGGER trg_update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_reports_updated_at ON public.scheduled_reports;
CREATE TRIGGER update_scheduled_reports_updated_at
BEFORE UPDATE ON public.scheduled_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_templates_updated_at ON public.report_templates;
CREATE TRIGGER update_report_templates_updated_at
BEFORE UPDATE ON public.report_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_broadcast_participants()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.message_type = 'broadcast' THEN
        INSERT INTO public.message_participants (message_id, user_id)
        SELECT NEW.id, id
        FROM public.profiles
        WHERE role::text = 'agent'
          AND id <> NEW.sender_id
        ON CONFLICT (message_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_broadcast_participants ON public.messages;
CREATE TRIGGER trg_create_broadcast_participants
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.create_broadcast_participants();

CREATE OR REPLACE FUNCTION public.initialize_agent_progress()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.agent_progress (agent_id)
    VALUES (NEW.id)
    ON CONFLICT (agent_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_initialize_agent_progress ON public.profiles;
CREATE TRIGGER trg_initialize_agent_progress
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.initialize_agent_progress();

CREATE OR REPLACE FUNCTION public.check_and_grant_achievement(
    p_agent_id UUID,
    p_slug TEXT,
    p_current_value INTEGER
)
RETURNS VOID AS $$
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
            SET total_xp = total_xp + v_reward,
                last_activity_date = CURRENT_DATE,
                last_activity_timestamp = NOW(),
                updated_at = NOW()
            WHERE agent_id = p_agent_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.auto_update_agent_level()
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_level := GREATEST(1, FLOOR(NEW.total_xp / 1000.0) + 1);
    NEW.updated_at := NOW();
    NEW.last_activity_timestamp := COALESCE(NEW.last_activity_timestamp, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_level_up ON public.agent_progress;
CREATE TRIGGER trg_auto_level_up
BEFORE UPDATE OF total_xp ON public.agent_progress
FOR EACH ROW
WHEN (NEW.total_xp IS DISTINCT FROM OLD.total_xp)
EXECUTE FUNCTION public.auto_update_agent_level();

CREATE OR REPLACE FUNCTION public.handle_call_gamification()
RETURNS TRIGGER AS $$
DECLARE
    v_total_calls INTEGER;
BEGIN
    IF NEW.agent_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.agent_progress (agent_id, total_xp, current_level, current_streak, last_activity_date, last_activity_timestamp)
    VALUES (NEW.agent_id, 20, 1, 1, CURRENT_DATE, NOW())
    ON CONFLICT (agent_id) DO UPDATE
    SET total_xp = public.agent_progress.total_xp + 20,
        last_activity_date = CURRENT_DATE,
        last_activity_timestamp = NOW(),
        updated_at = NOW();

    UPDATE public.goals
    SET current_calls = current_calls + 1,
        updated_at = NOW()
    WHERE agent_id = NEW.agent_id
      AND is_achieved = false
      AND period_key = to_char(CURRENT_DATE, 'YYYY-MM');

    SELECT COUNT(*)
    INTO v_total_calls
    FROM public.call_logs
    WHERE agent_id = NEW.agent_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_call_xp ON public.call_logs;
CREATE TRIGGER trg_call_xp
AFTER INSERT ON public.call_logs
FOR EACH ROW
EXECUTE FUNCTION public.handle_call_gamification();

CREATE OR REPLACE FUNCTION public.handle_sales_gamification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.agent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
        INSERT INTO public.agent_progress (agent_id, total_xp, current_level, current_streak, last_activity_date, last_activity_timestamp)
        VALUES (NEW.agent_id, 100, 1, 1, CURRENT_DATE, NOW())
        ON CONFLICT (agent_id) DO UPDATE
        SET total_xp = public.agent_progress.total_xp + 100,
            last_activity_date = CURRENT_DATE,
            last_activity_timestamp = NOW(),
            updated_at = NOW();

        UPDATE public.goals
        SET current_sales = current_sales + 1,
            updated_at = NOW()
        WHERE agent_id = NEW.agent_id
          AND period_key = to_char(CURRENT_DATE, 'YYYY-MM');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sales_gamification ON public.sales;
CREATE TRIGGER trg_sales_gamification
AFTER UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_sales_gamification();

CREATE OR REPLACE FUNCTION public.handle_note_gamification()
RETURNS TRIGGER AS $$
DECLARE
    v_xp_amount INTEGER := 10;
    v_total_notes INTEGER;
BEGIN
    IF NEW.agent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF LENGTH(NEW.note) > 50 THEN
        v_xp_amount := 25;
    END IF;

    INSERT INTO public.agent_progress (agent_id, total_xp, current_level, current_streak, last_activity_date, last_activity_timestamp)
    VALUES (NEW.agent_id, v_xp_amount, 1, 1, CURRENT_DATE, NOW())
    ON CONFLICT (agent_id) DO UPDATE
    SET total_xp = public.agent_progress.total_xp + v_xp_amount,
        last_activity_date = CURRENT_DATE,
        last_activity_timestamp = NOW(),
        updated_at = NOW();

    SELECT COUNT(*)
    INTO v_total_notes
    FROM public.lead_notes
    WHERE agent_id = NEW.agent_id;

    PERFORM public.check_and_grant_achievement(NEW.agent_id, 'scribe', v_total_notes);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_note_xp ON public.lead_notes;
CREATE TRIGGER trg_note_xp
AFTER INSERT ON public.lead_notes
FOR EACH ROW
EXECUTE FUNCTION public.handle_note_gamification();

CREATE OR REPLACE FUNCTION public.handle_lead_update_gamification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.current_agent_id IS NOT NULL THEN
        INSERT INTO public.agent_progress (agent_id, total_xp, current_level, current_streak, last_activity_date, last_activity_timestamp)
        VALUES (NEW.current_agent_id, 5, 1, 1, CURRENT_DATE, NOW())
        ON CONFLICT (agent_id) DO UPDATE
        SET total_xp = public.agent_progress.total_xp + 5,
            last_activity_date = CURRENT_DATE,
            last_activity_timestamp = NOW(),
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lead_update_xp ON public.leads;
CREATE TRIGGER trg_lead_update_xp
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.handle_lead_update_gamification();

CREATE OR REPLACE FUNCTION public.handle_pipeline_activity_achievements()
RETURNS TRIGGER AS $$
DECLARE
    v_appointments INTEGER;
    v_wins INTEGER;
BEGIN
    IF NEW.agent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF COALESCE(NEW.metadata ->> 'action_taken', '') = 'appointment_scheduled'
       OR (NEW.metadata ->> 'status') = 'appointment' THEN
        SELECT COUNT(*)
        INTO v_appointments
        FROM public.lead_activity_log
        WHERE agent_id = NEW.agent_id
          AND (
              COALESCE(metadata ->> 'action_taken', '') = 'appointment_scheduled'
              OR (metadata ->> 'status') = 'appointment'
          );

        PERFORM public.check_and_grant_achievement(NEW.agent_id, 'warm_up', v_appointments);
        PERFORM public.check_and_grant_achievement(NEW.agent_id, 'call_machine', v_appointments);
    END IF;

    IF (NEW.metadata ->> 'meeting_outcome') = 'won' THEN
        SELECT COUNT(*)
        INTO v_wins
        FROM public.lead_activity_log
        WHERE agent_id = NEW.agent_id
          AND (metadata ->> 'meeting_outcome') = 'won';

        PERFORM public.check_and_grant_achievement(NEW.agent_id, 'closer', v_wins);
    END IF;

    UPDATE public.agent_progress
    SET last_activity_date = CURRENT_DATE,
        last_activity_timestamp = NOW(),
        updated_at = NOW()
    WHERE agent_id = NEW.agent_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pipeline_activity_achievements ON public.lead_activity_log;
CREATE TRIGGER trg_pipeline_activity_achievements
AFTER INSERT ON public.lead_activity_log
FOR EACH ROW
EXECUTE FUNCTION public.handle_pipeline_activity_achievements();

CREATE OR REPLACE FUNCTION public.handle_goal_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_xp_reward INTEGER := 0;
BEGIN
    IF OLD.current_sales < OLD.target_sales
       AND NEW.current_sales >= NEW.target_sales
       AND NEW.target_sales > 0 THEN
        v_xp_reward := v_xp_reward + (NEW.target_sales * 100);
    END IF;

    IF OLD.current_calls < OLD.target_calls
       AND NEW.current_calls >= NEW.target_calls
       AND NEW.target_calls > 0 THEN
        v_xp_reward := v_xp_reward + (NEW.target_calls * 5);
    END IF;

    IF v_xp_reward > 0 THEN
        NEW.is_achieved := true;

        UPDATE public.agent_progress
        SET total_xp = total_xp + v_xp_reward,
            last_activity_date = CURRENT_DATE,
            last_activity_timestamp = NOW(),
            updated_at = NOW()
        WHERE agent_id = NEW.agent_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_goal_check ON public.goals;
CREATE TRIGGER trg_goal_check
BEFORE UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.handle_goal_completion();

-- ============================================
-- 8. DATA INITIALIZATION
-- ============================================

INSERT INTO public.achievement_definitions
    (slug, title, description, icon_name, category, xp_reward, condition_threshold)
VALUES
    ('first_blood', 'İlk Satış', 'İlk başarılı satışı kapat.', 'Trophy', 'sales', 500, 1),
    ('warm_up', 'Randevu İlk Adım', '10 toplantı organizasyonu hedefle.', 'Calendar', 'appointments', 100, 10),
    ('call_machine', 'Randevu Ritmi', '50 toplantı organizasyonu hedefle.', 'Zap', 'appointments', 500, 50),
    ('closer', 'Kapanışçı', '3 satışı toplantıdan kapat.', 'Target', 'sales', 1000, 3),
    ('on_fire', 'Alev Aldın', '3 gün üst üste satış yap.', 'Flame', 'streak', 1500, 3),
    ('scribe', 'Katip', '20 adet detaylı not al.', 'Feather', 'speed', 300, 20),
    ('networker', 'İletişim Uzmanı', '50 lead statüsünü güncelle.', 'Share2', 'streak', 400, 50)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    category = EXCLUDED.category,
    xp_reward = EXCLUDED.xp_reward,
    condition_threshold = EXCLUDED.condition_threshold;

INSERT INTO public.agent_progress (agent_id)
SELECT id
FROM public.profiles
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================
-- 9. REALTIME CONFIGURATION
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_participants;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_progress;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_achievements;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
    END;
END $$;

-- ============================================
-- 10. MANAGER ALERT SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS public.manager_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    due_at TIMESTAMPTZ,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_note TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium';
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.manager_alerts SET severity = 'medium' WHERE severity IS NULL;
UPDATE public.manager_alerts SET status = 'open' WHERE status IS NULL;
UPDATE public.manager_alerts SET triggered_at = COALESCE(triggered_at, created_at, NOW()) WHERE triggered_at IS NULL;
UPDATE public.manager_alerts SET metadata = '{}'::jsonb WHERE metadata IS NULL;

ALTER TABLE public.manager_alerts ALTER COLUMN type SET NOT NULL;
ALTER TABLE public.manager_alerts ALTER COLUMN severity SET NOT NULL;
ALTER TABLE public.manager_alerts ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.manager_alerts ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.manager_alerts ALTER COLUMN message SET NOT NULL;
ALTER TABLE public.manager_alerts ALTER COLUMN triggered_at SET NOT NULL;

ALTER TABLE public.manager_alerts DROP CONSTRAINT IF EXISTS manager_alerts_type_check;
ALTER TABLE public.manager_alerts ADD CONSTRAINT manager_alerts_type_check
CHECK (type IN (
    'callback_missed',
    'callback_due',
    'appointment_unresolved',
    'appointment_missing_closer',
    'appointment_missing_meet',
    'high_potential_idle',
    'agent_inactive',
    'recording_missing',
    'ai_callback_needs_date',
    'repeat_miss'
));

ALTER TABLE public.manager_alerts DROP CONSTRAINT IF EXISTS manager_alerts_severity_check;
ALTER TABLE public.manager_alerts ADD CONSTRAINT manager_alerts_severity_check
CHECK (severity IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE public.manager_alerts DROP CONSTRAINT IF EXISTS manager_alerts_status_check;
ALTER TABLE public.manager_alerts ADD CONSTRAINT manager_alerts_status_check
CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed'));

CREATE INDEX IF NOT EXISTS idx_manager_alerts_status ON public.manager_alerts(status);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_type ON public.manager_alerts(type);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_severity ON public.manager_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_lead_id ON public.manager_alerts(lead_id);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_agent_id ON public.manager_alerts(agent_id);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_due_at ON public.manager_alerts(due_at);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_triggered_at ON public.manager_alerts(triggered_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_alerts_open_unique_callback_missed
ON public.manager_alerts(type, lead_id, due_at)
WHERE type = 'callback_missed' AND status IN ('open', 'acknowledged');

ALTER TABLE public.manager_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view manager alerts" ON public.manager_alerts;
CREATE POLICY "Managers can view manager alerts"
ON public.manager_alerts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('manager', 'admin', 'founder')
    )
);

DROP POLICY IF EXISTS "Managers can update manager alerts" ON public.manager_alerts;
CREATE POLICY "Managers can update manager alerts"
ON public.manager_alerts FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('manager', 'admin', 'founder')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('manager', 'admin', 'founder')
    )
);

DROP TRIGGER IF EXISTS trg_manager_alerts_updated_at ON public.manager_alerts;
CREATE TRIGGER trg_manager_alerts_updated_at
BEFORE UPDATE ON public.manager_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.manager_alerts;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
    END;
END $$;

-- ============================================
-- 11. GRANTS
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================
-- DONE. ARTIFICAGENT V26 SDR / CLOSER + MANAGER ALERT SYSTEM READY.
-- ============================================
