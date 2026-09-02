-- ============================================
-- SonCall Production Update - 2026-09-02
-- Includes SDR/Closer, callback reminders, AI usage/onboarding, manager alerts, multi-market isolation, and personal language preference.
-- Run this once in Supabase SQL Editor before/with the production deployment.
-- ============================================


-- >>> BEGIN supabase/migrations/20260812_sdr_closer_pipeline.sql

-- SDR / Closer operating model.
-- Keeps auth/permission role separate from the sales function.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sales_role TEXT DEFAULT 'sdr';

UPDATE public.profiles
SET sales_role = 'sdr'
WHERE sales_role IS NULL;

ALTER TABLE public.profiles
ALTER COLUMN sales_role SET DEFAULT 'sdr';

ALTER TABLE public.profiles
ALTER COLUMN sales_role SET NOT NULL;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_sales_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_sales_role_check
CHECK (sales_role IN ('sdr', 'closer'));

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS sdr_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS closer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS meeting_url TEXT,
ADD COLUMN IF NOT EXISTS meeting_status TEXT DEFAULT 'scheduled';

UPDATE public.leads
SET sdr_id = assigned_to
WHERE sdr_id IS NULL
  AND assigned_to IS NOT NULL;

UPDATE public.leads
SET meeting_status = 'scheduled'
WHERE meeting_status IS NULL;

ALTER TABLE public.leads
ALTER COLUMN meeting_status SET DEFAULT 'scheduled';

ALTER TABLE public.leads
ALTER COLUMN meeting_status SET NOT NULL;

ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_meeting_status_check;

ALTER TABLE public.leads
ADD CONSTRAINT leads_meeting_status_check
CHECK (meeting_status IN ('scheduled', 'completed', 'no_show', 'won', 'lost'));

CREATE INDEX IF NOT EXISTS idx_profiles_sales_role ON public.profiles(sales_role);
CREATE INDEX IF NOT EXISTS idx_leads_sdr_id ON public.leads(sdr_id);
CREATE INDEX IF NOT EXISTS idx_leads_closer_id ON public.leads(closer_id);
CREATE INDEX IF NOT EXISTS idx_leads_meeting_pipeline
ON public.leads(closer_id, appointment_date)
WHERE appointment_date IS NOT NULL;

UPDATE public.achievement_definitions
SET title = 'Randevu İlk Adım',
    description = '10 toplantı organizasyonu hedefle.',
    icon_name = 'Calendar',
    category = 'appointments'
WHERE slug = 'warm_up';

UPDATE public.achievement_definitions
SET title = 'Randevu Ritmi',
    description = '50 toplantı organizasyonu hedefle.',
    icon_name = 'Zap',
    category = 'appointments'
WHERE slug = 'call_machine';

DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view owned SDR closer leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update owned SDR closer leads" ON public.leads;

CREATE POLICY "Agents can view owned SDR closer leads"
ON public.leads
FOR SELECT
USING (
  assigned_to = auth.uid()
  OR sdr_id = auth.uid()
  OR closer_id = auth.uid()
);

CREATE POLICY "Agents can update owned SDR closer leads"
ON public.leads
FOR UPDATE
USING (
  assigned_to = auth.uid()
  OR sdr_id = auth.uid()
  OR closer_id = auth.uid()
)
WITH CHECK (
  assigned_to = auth.uid()
  OR sdr_id = auth.uid()
  OR closer_id = auth.uid()
);

DROP POLICY IF EXISTS "Agents can insert notes for assigned leads" ON public.lead_notes;
DROP POLICY IF EXISTS "Agents can insert notes for owned SDR closer leads" ON public.lead_notes;

CREATE POLICY "Agents can insert notes for owned SDR closer leads"
ON public.lead_notes
FOR INSERT
WITH CHECK (
  agent_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.leads
    WHERE leads.id = lead_id
      AND (
        leads.assigned_to = auth.uid()
        OR leads.sdr_id = auth.uid()
        OR leads.closer_id = auth.uid()
      )
  )
);

-- <<< END supabase/migrations/20260812_sdr_closer_pipeline.sql


-- >>> BEGIN supabase/migrations/20260901_callback_reminders.sql

-- Callback reminders for SDR repeat-call workflow.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS callback_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS callback_reason TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS callback_reminder_10m_sent BOOLEAN DEFAULT false;

ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_trigger_type_check;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_trigger_type_check
CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'callback_10m', 'manual', 'bulk', 'motivation', 'inbound'));

CREATE INDEX IF NOT EXISTS idx_leads_callback_at
ON public.leads(callback_at)
WHERE callback_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_callback_reminder
ON public.leads(callback_at, callback_reminder_10m_sent)
WHERE callback_at IS NOT NULL AND status = 'callback';

-- <<< END supabase/migrations/20260901_callback_reminders.sql


-- >>> BEGIN supabase/migrations/20260902_ai_usage_and_onboarding.sql

-- ============================================
-- SonCall AI Usage Cost Tracking + Agent Onboarding
-- Date: 2026-09-02
-- ============================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    feature TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    audio_seconds INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_usage_logs_feature_check CHECK (
        feature IN (
            'assistant_chat',
            'call_transcription',
            'call_analysis',
            'sms_generate',
            'sms_correct',
            'lead_enrich'
        )
    ),
    CONSTRAINT ai_usage_logs_status_check CHECK (status IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_lead_id ON public.ai_usage_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature ON public.ai_usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON public.ai_usage_logs(model);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own ai usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can insert own ai usage logs"
    ON public.ai_usage_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own ai usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can view own ai usage logs"
    ON public.ai_usage_logs FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Managers can view all ai usage logs" ON public.ai_usage_logs;
CREATE POLICY "Managers can view all ai usage logs"
    ON public.ai_usage_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('manager', 'admin', 'founder')
        )
    );

CREATE TABLE IF NOT EXISTS public.agent_onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    sales_role TEXT NOT NULL DEFAULT 'sdr',
    completed_steps TEXT[] NOT NULL DEFAULT '{}'::text[],
    completed_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_onboarding_progress_user_id ON public.agent_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_onboarding_progress_completed_at ON public.agent_onboarding_progress(completed_at);

ALTER TABLE public.agent_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own onboarding progress" ON public.agent_onboarding_progress;
CREATE POLICY "Users can view own onboarding progress"
    ON public.agent_onboarding_progress FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own onboarding progress" ON public.agent_onboarding_progress;
CREATE POLICY "Users can insert own onboarding progress"
    ON public.agent_onboarding_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own onboarding progress" ON public.agent_onboarding_progress;
CREATE POLICY "Users can update own onboarding progress"
    ON public.agent_onboarding_progress FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Managers can view all onboarding progress" ON public.agent_onboarding_progress;
CREATE POLICY "Managers can view all onboarding progress"
    ON public.agent_onboarding_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('manager', 'admin', 'founder')
        )
    );

CREATE OR REPLACE FUNCTION public.update_agent_onboarding_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agent_onboarding_progress_updated_at ON public.agent_onboarding_progress;
CREATE TRIGGER update_agent_onboarding_progress_updated_at
    BEFORE UPDATE ON public.agent_onboarding_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.update_agent_onboarding_progress_updated_at();

GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_onboarding_progress TO authenticated;

-- <<< END supabase/migrations/20260902_ai_usage_and_onboarding.sql


-- >>> BEGIN supabase/migrations/20260902_manager_alerts.sql

-- ============================================
-- SonCall Manager Alert System
-- Callback compliance and operational alarms
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

-- <<< END supabase/migrations/20260902_manager_alerts.sql


-- >>> BEGIN supabase/migrations/20260902_multi_market_isolation.sql

-- ============================================
-- SonCall Multi-Market Isolation
-- Markets: Turkey, United States, Germany, Russia, Dubai/UAE
-- Date: 2026-09-02
-- ============================================

CREATE TABLE IF NOT EXISTS public.markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    default_language TEXT NOT NULL DEFAULT 'tr',
    timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    currency TEXT NOT NULL DEFAULT 'TRY',
    calling_country_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.markets (code, name, country, default_language, timezone, currency, calling_country_code)
VALUES
    ('TR', 'Türkiye', 'Turkey', 'tr', 'Europe/Istanbul', 'TRY', '+90'),
    ('US', 'United States', 'United States', 'en', 'America/New_York', 'USD', '+1'),
    ('DE', 'Germany', 'Germany', 'de', 'Europe/Berlin', 'EUR', '+49'),
    ('RU', 'Russia', 'Russia', 'ru', 'Europe/Moscow', 'RUB', '+7'),
    ('AE', 'Dubai / UAE', 'United Arab Emirates', 'en', 'Asia/Dubai', 'AED', '+971')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    country = EXCLUDED.country,
    default_language = EXCLUDED.default_language,
    timezone = EXCLUDED.timezone,
    currency = EXCLUDED.currency,
    calling_country_code = EXCLUDED.calling_country_code,
    updated_at = NOW();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE public.upload_batches ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.manager_alerts ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.ai_usage_logs ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);

UPDATE public.profiles
SET market_id = (SELECT id FROM public.markets WHERE code = 'TR')
WHERE market_id IS NULL;

UPDATE public.leads
SET
    market_id = COALESCE(
        market_id,
        (SELECT p.market_id FROM public.profiles p WHERE p.id = leads.assigned_to),
        (SELECT id FROM public.markets WHERE code = 'TR')
    ),
    country = COALESCE(country, 'Turkey'),
    timezone = COALESCE(timezone, 'Europe/Istanbul'),
    language = COALESCE(language, 'tr')
WHERE market_id IS NULL OR country IS NULL OR timezone IS NULL OR language IS NULL;

UPDATE public.upload_batches
SET market_id = COALESCE(
    market_id,
    (SELECT p.market_id FROM public.profiles p WHERE p.id = upload_batches.uploaded_by),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.messages
SET market_id = COALESCE(
    market_id,
    (SELECT p.market_id FROM public.profiles p WHERE p.id = messages.sender_id),
    (SELECT l.market_id FROM public.leads l WHERE l.id = messages.lead_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.manager_alerts
SET market_id = COALESCE(
    market_id,
    (SELECT l.market_id FROM public.leads l WHERE l.id = manager_alerts.lead_id),
    (SELECT p.market_id FROM public.profiles p WHERE p.id = manager_alerts.agent_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.ai_usage_logs
SET market_id = COALESCE(
    market_id,
    (SELECT l.market_id FROM public.leads l WHERE l.id = ai_usage_logs.lead_id),
    (SELECT p.market_id FROM public.profiles p WHERE p.id = ai_usage_logs.user_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.call_logs
SET market_id = COALESCE(
    market_id,
    (SELECT l.market_id FROM public.leads l WHERE l.id = call_logs.lead_id),
    (SELECT p.market_id FROM public.profiles p WHERE p.id = call_logs.agent_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.sms_logs
SET market_id = COALESCE(
    market_id,
    (SELECT l.market_id FROM public.leads l WHERE l.id = sms_logs.lead_id),
    (SELECT c.market_id FROM public.contacts c WHERE c.id = sms_logs.contact_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.contacts
SET market_id = COALESCE(market_id, (SELECT id FROM public.markets WHERE code = 'TR'))
WHERE market_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_market_id ON public.profiles(market_id);
CREATE INDEX IF NOT EXISTS idx_leads_market_id ON public.leads(market_id);
CREATE INDEX IF NOT EXISTS idx_upload_batches_market_id ON public.upload_batches(market_id);
CREATE INDEX IF NOT EXISTS idx_messages_market_id ON public.messages(market_id);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_market_id ON public.manager_alerts(market_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_market_id ON public.ai_usage_logs(market_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_market_id ON public.call_logs(market_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_market_id ON public.sms_logs(market_id);
CREATE INDEX IF NOT EXISTS idx_contacts_market_id ON public.contacts(market_id);

CREATE OR REPLACE FUNCTION public.current_user_market_id()
RETURNS UUID AS $$
    SELECT market_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_global_user()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role::text IN ('admin', 'founder')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_market_manager()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role::text = 'manager'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.same_market(target_market_id UUID)
RETURNS BOOLEAN AS $$
    SELECT public.is_global_user()
        OR target_market_id = public.current_user_market_id();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_profile_market_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.market_id IS NULL THEN
        NEW.market_id := (SELECT id FROM public.markets WHERE code = 'TR');
    END IF;
    IF NEW.preferred_language IS NULL THEN
        NEW.preferred_language := (SELECT default_language FROM public.markets WHERE id = NEW.market_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_profile_market_defaults ON public.profiles;
CREATE TRIGGER set_profile_market_defaults
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_profile_market_defaults();

CREATE OR REPLACE FUNCTION public.set_lead_market_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.market_id IS NULL THEN
        NEW.market_id := COALESCE(
            (SELECT market_id FROM public.profiles WHERE id = NEW.assigned_to),
            (SELECT id FROM public.markets WHERE code = 'TR')
        );
    END IF;
    IF NEW.country IS NULL THEN
        NEW.country := (SELECT country FROM public.markets WHERE id = NEW.market_id);
    END IF;
    IF NEW.timezone IS NULL THEN
        NEW.timezone := (SELECT timezone FROM public.markets WHERE id = NEW.market_id);
    END IF;
    IF NEW.language IS NULL THEN
        NEW.language := (SELECT default_language FROM public.markets WHERE id = NEW.market_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_lead_market_defaults ON public.leads;
CREATE TRIGGER set_lead_market_defaults
    BEFORE INSERT OR UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.set_lead_market_defaults();

CREATE OR REPLACE FUNCTION public.set_message_market_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.market_id IS NULL THEN
        NEW.market_id := COALESCE(
            (SELECT market_id FROM public.leads WHERE id = NEW.lead_id),
            (SELECT market_id FROM public.profiles WHERE id = NEW.sender_id),
            (SELECT id FROM public.markets WHERE code = 'TR')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_message_market_defaults ON public.messages;
CREATE TRIGGER set_message_market_defaults
    BEFORE INSERT OR UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_message_market_defaults();

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view active markets" ON public.markets;
CREATE POLICY "Authenticated users view active markets"
ON public.markets FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Profiles market isolated select" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Profiles market isolated select"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR public.is_global_user()
    OR market_id = public.current_user_market_id()
);

DROP POLICY IF EXISTS "Profiles market isolated update" ON public.profiles;
DROP POLICY IF EXISTS "Privileged users can update profiles" ON public.profiles;
CREATE POLICY "Profiles market isolated update"
ON public.profiles FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
    OR public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
)
WITH CHECK (
    id = auth.uid()
    OR public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
);

DROP POLICY IF EXISTS "Leads market isolated manager view" ON public.leads;
DROP POLICY IF EXISTS "Privileged users view leads" ON public.leads;
CREATE POLICY "Leads market isolated manager view"
ON public.leads FOR SELECT
TO authenticated
USING (
    public.is_global_user()
    OR (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text = 'manager')
        AND market_id = public.current_user_market_id()
    )
);

DROP POLICY IF EXISTS "Leads market isolated manager manage" ON public.leads;
DROP POLICY IF EXISTS "Privileged users manage leads" ON public.leads;
CREATE POLICY "Leads market isolated manager manage"
ON public.leads FOR ALL
TO authenticated
USING (
    public.is_global_user()
    OR (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text = 'manager')
        AND market_id = public.current_user_market_id()
    )
)
WITH CHECK (
    public.is_global_user()
    OR (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text = 'manager')
        AND market_id = public.current_user_market_id()
    )
);

DROP POLICY IF EXISTS "Leads market isolated agent view" ON public.leads;
DROP POLICY IF EXISTS "Agents view owned SDR closer leads" ON public.leads;
CREATE POLICY "Leads market isolated agent view"
ON public.leads FOR SELECT
TO authenticated
USING (
    market_id = public.current_user_market_id()
    AND (
        assigned_to = auth.uid()
        OR sdr_id = auth.uid()
        OR closer_id = auth.uid()
        OR current_agent_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Lead notes market isolated select" ON public.lead_notes;
DROP POLICY IF EXISTS "Anyone can view notes" ON public.lead_notes;
CREATE POLICY "Lead notes market isolated select"
ON public.lead_notes FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_id
        AND (
            public.same_market(l.market_id)
            OR l.assigned_to = auth.uid()
            OR l.sdr_id = auth.uid()
            OR l.closer_id = auth.uid()
            OR l.current_agent_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Lead activity market isolated select" ON public.lead_activity_log;
DROP POLICY IF EXISTS "Authenticated can select all activity logs" ON public.lead_activity_log;
CREATE POLICY "Lead activity market isolated select"
ON public.lead_activity_log FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_id
        AND public.same_market(l.market_id)
    )
);

DROP POLICY IF EXISTS "Messages market isolated select" ON public.messages;
DROP POLICY IF EXISTS "unified_view_messages" ON public.messages;
CREATE POLICY "Messages market isolated select"
ON public.messages FOR SELECT
TO authenticated
USING (
    public.same_market(market_id)
    AND (
        sender_id = auth.uid()
        OR receiver_id = auth.uid()
        OR message_type = 'broadcast'
        OR (
            message_type = 'lead_comment'
            AND EXISTS (
                SELECT 1 FROM public.leads l
                WHERE l.id = lead_id
                AND public.same_market(l.market_id)
            )
        )
    )
);

DROP POLICY IF EXISTS "Messages market isolated insert" ON public.messages;
DROP POLICY IF EXISTS "unified_insert_messages" ON public.messages;
CREATE POLICY "Messages market isolated insert"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND public.same_market(market_id)
);

DROP POLICY IF EXISTS "Manager alerts market isolated select" ON public.manager_alerts;
DROP POLICY IF EXISTS "Managers can view all manager alerts" ON public.manager_alerts;
CREATE POLICY "Manager alerts market isolated select"
ON public.manager_alerts FOR SELECT
TO authenticated
USING (
    public.is_global_user()
    OR (
        public.is_market_manager()
        AND market_id = public.current_user_market_id()
    )
);

DROP POLICY IF EXISTS "AI usage market isolated select" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Managers can view all ai usage logs" ON public.ai_usage_logs;
CREATE POLICY "AI usage market isolated select"
ON public.ai_usage_logs FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_global_user()
    OR (
        public.is_market_manager()
        AND market_id = public.current_user_market_id()
    )
);

GRANT SELECT ON public.markets TO authenticated;

-- <<< END supabase/migrations/20260902_multi_market_isolation.sql


-- >>> BEGIN supabase/migrations/20260902_profile_language_preference.sql

-- ============================================
-- Personal Panel Language Preference
-- Date: 2026-09-02
-- ============================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT;

UPDATE public.profiles
SET preferred_language = COALESCE(preferred_language, 'tr')
WHERE preferred_language IS NULL;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_preferred_language_check
CHECK (preferred_language IN ('tr', 'en', 'de', 'ru', 'ar'));

-- <<< END supabase/migrations/20260902_profile_language_preference.sql

