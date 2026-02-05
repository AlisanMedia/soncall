-- Add last_activity_timestamp column to agent_progress table
-- This field tracks the precise timestamp of the last agent activity
-- Used for online/offline status indicator in manager dashboard

ALTER TABLE public.agent_progress 
ADD COLUMN IF NOT EXISTS last_activity_timestamp TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_agent_progress_last_activity 
ON public.agent_progress(last_activity_timestamp);

COMMENT ON COLUMN public.agent_progress.last_activity_timestamp IS 'Precise timestamp of last agent activity (used for online status indicator)';
