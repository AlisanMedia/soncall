-- Keep appointment pipeline state truthful and aligned with the application.
-- Previously every lead defaulted to meeting_status = 'scheduled', which made
-- the manager queue and dashboard treat untouched leads as appointments.
BEGIN;

ALTER TABLE public.leads
  ALTER COLUMN meeting_status DROP DEFAULT,
  ALTER COLUMN meeting_status DROP NOT NULL;

UPDATE public.leads
SET meeting_status = NULL
WHERE status <> 'appointment'
  AND meeting_status = 'scheduled';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_meeting_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_meeting_status_check
  CHECK (
    meeting_status IS NULL
    OR meeting_status = ANY (ARRAY['scheduled', 'completed', 'no_show', 'won', 'lost'])
  );

CREATE INDEX IF NOT EXISTS idx_leads_scheduled_meetings
  ON public.leads (closer_id, appointment_date)
  WHERE meeting_status = 'scheduled' AND appointment_date IS NOT NULL;

-- Match the upload limit and MIME types accepted by VoiceRecorder/transcribe.
UPDATE storage.buckets
SET file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
      'audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/ogg'
    ]::text[]
WHERE id = 'call-recordings';

-- TeamMonitoring currently polls, but enabling Realtime makes future live
-- subscriptions reliable without changing existing clients.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'lead_activity_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_activity_log;
  END IF;
END $$;

COMMIT;
