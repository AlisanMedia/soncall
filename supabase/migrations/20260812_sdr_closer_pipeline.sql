-- SDR / Closer operating model.
-- Keeps auth/permission role separate from the sales function.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sales_role TEXT DEFAULT 'sdr';

UPDATE public.profiles
SET sales_role = 'sdr'
WHERE sales_role IS NULL;

ALTER TABLE public.profiles
ALTER COLUMN sales_role SET DEFAULT 'sdr';

ALTER TABLE public.profiles
ALTER COLUMN sales_role SET NOT NULL;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_sales_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_sales_role_check
CHECK (sales_role IN ('sdr', 'closer'));

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS sdr_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS closer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS meeting_url TEXT,
ADD COLUMN IF NOT EXISTS meeting_status TEXT DEFAULT 'scheduled';

UPDATE public.leads
SET sdr_id = assigned_to
WHERE sdr_id IS NULL
  AND assigned_to IS NOT NULL;

UPDATE public.leads
SET meeting_status = 'scheduled'
WHERE meeting_status IS NULL;

ALTER TABLE public.leads
ALTER COLUMN meeting_status SET DEFAULT 'scheduled';

ALTER TABLE public.leads
ALTER COLUMN meeting_status SET NOT NULL;

ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_meeting_status_check;

ALTER TABLE public.leads
ADD CONSTRAINT leads_meeting_status_check
CHECK (meeting_status IN ('scheduled', 'completed', 'no_show', 'won', 'lost'));

CREATE INDEX IF NOT EXISTS idx_profiles_sales_role ON public.profiles(sales_role);
CREATE INDEX IF NOT EXISTS idx_leads_sdr_id ON public.leads(sdr_id);
CREATE INDEX IF NOT EXISTS idx_leads_closer_id ON public.leads(closer_id);
CREATE INDEX IF NOT EXISTS idx_leads_meeting_pipeline
ON public.leads(closer_id, appointment_date)
WHERE appointment_date IS NOT NULL;

UPDATE public.achievement_definitions
SET title = 'Randevu İlk Adım',
    description = '10 toplantı organizasyonu hedefle.',
    icon_name = 'Calendar',
    category = 'appointments'
WHERE slug = 'warm_up';

UPDATE public.achievement_definitions
SET title = 'Randevu Ritmi',
    description = '50 toplantı organizasyonu hedefle.',
    icon_name = 'Zap',
    category = 'appointments'
WHERE slug = 'call_machine';

DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view owned SDR closer leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update owned SDR closer leads" ON public.leads;

CREATE POLICY "Agents can view owned SDR closer leads"
ON public.leads
FOR SELECT
USING (
  assigned_to = auth.uid()
  OR sdr_id = auth.uid()
  OR closer_id = auth.uid()
);

CREATE POLICY "Agents can update owned SDR closer leads"
ON public.leads
FOR UPDATE
USING (
  assigned_to = auth.uid()
  OR sdr_id = auth.uid()
  OR closer_id = auth.uid()
)
WITH CHECK (
  assigned_to = auth.uid()
  OR sdr_id = auth.uid()
  OR closer_id = auth.uid()
);

DROP POLICY IF EXISTS "Agents can insert notes for assigned leads" ON public.lead_notes;
DROP POLICY IF EXISTS "Agents can insert notes for owned SDR closer leads" ON public.lead_notes;

CREATE POLICY "Agents can insert notes for owned SDR closer leads"
ON public.lead_notes
FOR INSERT
WITH CHECK (
  agent_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.leads
    WHERE leads.id = lead_id
      AND (
        leads.assigned_to = auth.uid()
        OR leads.sdr_id = auth.uid()
        OR leads.closer_id = auth.uid()
      )
  )
);
