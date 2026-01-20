
-- Create call_logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    transcription TEXT,
    summary TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Policies for call_logs
CREATE POLICY "Managers can view all call logs" 
ON public.call_logs FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

CREATE POLICY "Agents can view their own call logs" 
ON public.call_logs FOR SELECT 
TO authenticated 
USING (
  agent_id = auth.uid()
);

CREATE POLICY "Agents can insert call logs" 
ON public.call_logs FOR INSERT 
TO authenticated 
WITH CHECK (
  agent_id = auth.uid()
);

-- Storage Bucket Setup
-- Note: This requires the storage schema to handle the bucket creation.
-- If running this in SQL Editor, it works. 
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- We need to drop existing policies if creating to avoid conflicts in re-runs, 
-- but IF NOT EXISTS isn't standard for Policies in Postgres without a function.
-- We'll just try to create them. Use DO block or just simple creation.

DROP POLICY IF EXISTS "Public Access to Call Recordings" ON storage.objects;
CREATE POLICY "Public Access to Call Recordings"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'call-recordings' );

DROP POLICY IF EXISTS "Authenticated users can upload recordings" ON storage.objects;
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'call-recordings' );
