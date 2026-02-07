
-- Migration: Add recipient_name column to sms_logs

ALTER TABLE public.sms_logs 
ADD COLUMN IF NOT EXISTS recipient_name TEXT;

COMMENT ON COLUMN public.sms_logs.recipient_name IS 'Name of the recipient (Agent or Lead) at the time of sending';
