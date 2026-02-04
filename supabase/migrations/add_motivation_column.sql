-- Add column to track when the last motivation SMS was sent
ALTER TABLE public.agent_progress 
ADD COLUMN IF NOT EXISTS last_motivation_sent TIMESTAMPTZ DEFAULT NULL;

-- Comment on column
COMMENT ON COLUMN public.agent_progress.last_motivation_sent IS 'Timestamp of the last motivational SMS sent to the agent';
