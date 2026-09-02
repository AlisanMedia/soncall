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
