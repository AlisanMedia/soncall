-- ============================================
-- V27 Strict Multi-Market RLS Completion
-- Date: 2026-09-02
-- ============================================

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.agent_progress ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.agent_achievements ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.scheduled_reports ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.report_executions ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id);

UPDATE public.sales
SET market_id = COALESCE(
    market_id,
    (SELECT l.market_id FROM public.leads l WHERE l.id = sales.lead_id),
    (SELECT p.market_id FROM public.profiles p WHERE p.id = sales.agent_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.goals
SET market_id = COALESCE(
    market_id,
    (SELECT p.market_id FROM public.profiles p WHERE p.id = goals.agent_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.agent_progress
SET market_id = COALESCE(
    market_id,
    (SELECT p.market_id FROM public.profiles p WHERE p.id = agent_progress.agent_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.agent_achievements
SET market_id = COALESCE(
    market_id,
    (SELECT p.market_id FROM public.profiles p WHERE p.id = agent_achievements.agent_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.scheduled_reports
SET market_id = COALESCE(
    market_id,
    (SELECT p.market_id FROM public.profiles p WHERE p.id = scheduled_reports.manager_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.report_templates
SET market_id = COALESCE(
    market_id,
    (SELECT p.market_id FROM public.profiles p WHERE p.id = report_templates.manager_id),
    (SELECT id FROM public.markets WHERE code = 'TR')
)
WHERE market_id IS NULL;

UPDATE public.profiles
SET preferred_language = COALESCE(
    preferred_language,
    (SELECT default_language FROM public.markets WHERE id = profiles.market_id),
    'tr'
)
WHERE preferred_language IS NULL;

ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_default_language_check;
ALTER TABLE public.markets ADD CONSTRAINT markets_default_language_check
CHECK (default_language IN ('tr', 'en', 'de', 'ru', 'ar'));

ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_code_check;
ALTER TABLE public.markets ADD CONSTRAINT markets_code_check
CHECK (code IN ('TR', 'US', 'DE', 'RU', 'AE'));

CREATE INDEX IF NOT EXISTS idx_sales_market_id ON public.sales(market_id);
CREATE INDEX IF NOT EXISTS idx_goals_market_id ON public.goals(market_id);
CREATE INDEX IF NOT EXISTS idx_agent_progress_market_id ON public.agent_progress(market_id);
CREATE INDEX IF NOT EXISTS idx_agent_achievements_market_id ON public.agent_achievements(market_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_market_id ON public.scheduled_reports(market_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_market_id ON public.report_templates(market_id);

CREATE OR REPLACE FUNCTION public.set_sales_market_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.market_id IS NULL THEN
        NEW.market_id := COALESCE(
            (SELECT market_id FROM public.leads WHERE id = NEW.lead_id),
            (SELECT market_id FROM public.profiles WHERE id = NEW.agent_id),
            (SELECT id FROM public.markets WHERE code = 'TR')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_sales_market_defaults ON public.sales;
CREATE TRIGGER set_sales_market_defaults
BEFORE INSERT OR UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.set_sales_market_defaults();

CREATE OR REPLACE FUNCTION public.set_goal_market_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.market_id IS NULL THEN
        NEW.market_id := COALESCE(
            (SELECT market_id FROM public.profiles WHERE id = NEW.agent_id),
            (SELECT id FROM public.markets WHERE code = 'TR')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_goal_market_defaults ON public.goals;
CREATE TRIGGER set_goal_market_defaults
BEFORE INSERT OR UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.set_goal_market_defaults();

DROP POLICY IF EXISTS "Managers view manage contacts" ON public.contacts;
DROP POLICY IF EXISTS "Contacts market isolated manage" ON public.contacts;
CREATE POLICY "Contacts market isolated manage"
ON public.contacts FOR ALL
TO authenticated
USING (
    created_by = auth.uid()
    OR public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
)
WITH CHECK (
    created_by = auth.uid()
    OR public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
);

DROP POLICY IF EXISTS "Authenticated users can view sms logs" ON public.sms_logs;
DROP POLICY IF EXISTS "SMS logs market isolated select" ON public.sms_logs;
CREATE POLICY "SMS logs market isolated select"
ON public.sms_logs FOR SELECT
TO authenticated
USING (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
    OR EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = sms_logs.lead_id
        AND (
            l.assigned_to = auth.uid()
            OR l.sdr_id = auth.uid()
            OR l.closer_id = auth.uid()
            OR l.current_agent_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Authenticated users can insert sms logs" ON public.sms_logs;
DROP POLICY IF EXISTS "SMS logs market isolated insert" ON public.sms_logs;
CREATE POLICY "SMS logs market isolated insert"
ON public.sms_logs FOR INSERT
TO authenticated
WITH CHECK (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
    OR market_id = public.current_user_market_id()
);

DROP POLICY IF EXISTS "Authenticated users can update sms logs" ON public.sms_logs;
DROP POLICY IF EXISTS "SMS logs market isolated update" ON public.sms_logs;
CREATE POLICY "SMS logs market isolated update"
ON public.sms_logs FOR UPDATE
TO authenticated
USING (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
)
WITH CHECK (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
);

DROP POLICY IF EXISTS "Agents can manage own sales" ON public.sales;
DROP POLICY IF EXISTS "Sales market isolated own" ON public.sales;
CREATE POLICY "Sales market isolated own"
ON public.sales FOR ALL
TO authenticated
USING (agent_id = auth.uid() AND market_id = public.current_user_market_id())
WITH CHECK (agent_id = auth.uid() AND market_id = public.current_user_market_id());

DROP POLICY IF EXISTS "Privileged users view manage all sales" ON public.sales;
DROP POLICY IF EXISTS "Sales market isolated privileged" ON public.sales;
CREATE POLICY "Sales market isolated privileged"
ON public.sales FOR ALL
TO authenticated
USING (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
)
WITH CHECK (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
);

DROP POLICY IF EXISTS "Agents can view own goals" ON public.goals;
DROP POLICY IF EXISTS "Goals market isolated own" ON public.goals;
CREATE POLICY "Goals market isolated own"
ON public.goals FOR SELECT
TO authenticated
USING (agent_id = auth.uid() AND market_id = public.current_user_market_id());

DROP POLICY IF EXISTS "Privileged users manage all goals" ON public.goals;
DROP POLICY IF EXISTS "Goals market isolated privileged" ON public.goals;
CREATE POLICY "Goals market isolated privileged"
ON public.goals FOR ALL
TO authenticated
USING (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
)
WITH CHECK (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
);

DROP POLICY IF EXISTS "Everyone can view progress" ON public.agent_progress;
DROP POLICY IF EXISTS "Agent progress market isolated select" ON public.agent_progress;
CREATE POLICY "Agent progress market isolated select"
ON public.agent_progress FOR SELECT
TO authenticated
USING (
    agent_id = auth.uid()
    OR public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
);

DROP POLICY IF EXISTS "Everyone can view achievements" ON public.agent_achievements;
DROP POLICY IF EXISTS "Agent achievements market isolated select" ON public.agent_achievements;
CREATE POLICY "Agent achievements market isolated select"
ON public.agent_achievements FOR SELECT
TO authenticated
USING (
    agent_id = auth.uid()
    OR public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
);

DROP POLICY IF EXISTS "Managers can view manager alerts" ON public.manager_alerts;
DROP POLICY IF EXISTS "Managers can view all manager alerts" ON public.manager_alerts;
DROP POLICY IF EXISTS "Manager alerts market isolated select" ON public.manager_alerts;
CREATE POLICY "Manager alerts market isolated select"
ON public.manager_alerts FOR SELECT
TO authenticated
USING (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
);

DROP POLICY IF EXISTS "Managers can update manager alerts" ON public.manager_alerts;
DROP POLICY IF EXISTS "Manager alerts market isolated update" ON public.manager_alerts;
CREATE POLICY "Manager alerts market isolated update"
ON public.manager_alerts FOR UPDATE
TO authenticated
USING (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
)
WITH CHECK (
    public.is_global_user()
    OR (public.is_market_manager() AND market_id = public.current_user_market_id())
);

DROP POLICY IF EXISTS "Managers can view all onboarding progress" ON public.agent_onboarding_progress;
CREATE POLICY "Managers can view all onboarding progress"
ON public.agent_onboarding_progress FOR SELECT
TO authenticated
USING (
    public.is_global_user()
    OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = agent_onboarding_progress.user_id
        AND p.market_id = public.current_user_market_id()
        AND public.is_market_manager()
    )
);

GRANT SELECT ON public.markets TO authenticated;
GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_onboarding_progress TO authenticated;
GRANT ALL ON public.markets TO service_role;
GRANT ALL ON public.ai_usage_logs TO service_role;
GRANT ALL ON public.agent_onboarding_progress TO service_role;
