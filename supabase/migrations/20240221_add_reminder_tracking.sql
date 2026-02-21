-- Add reminder tracking columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS reminder_5h_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false;

-- Add indexes for performance as these will be queried every 10 mins
CREATE INDEX IF NOT EXISTS idx_leads_reminders ON public.leads (appointment_at, reminder_5h_sent, reminder_1h_sent) 
WHERE appointment_date IS NOT NULL;
