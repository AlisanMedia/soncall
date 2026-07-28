-- Add missing artificial intelligence fields for the new CRM features
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_sentiment TEXT;
