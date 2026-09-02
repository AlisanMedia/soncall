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
