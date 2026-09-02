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
