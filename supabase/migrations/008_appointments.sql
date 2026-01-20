-- ============================================
-- Appointment Scheduling & Reminders
-- ============================================

-- 1. Add appointment_at to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS appointment_at TIMESTAMPTZ;

-- 2. Index for faster cron queries
CREATE INDEX IF NOT EXISTS leads_appointment_at_idx ON public.leads(appointment_at);

-- 3. Add phone_number to profiles if not exists (for Agent SMS)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT;
