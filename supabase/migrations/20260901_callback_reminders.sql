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
