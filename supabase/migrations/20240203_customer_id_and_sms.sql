-- 1. Add Customer ID (lead_number)
-- using SERIAL will automatically populate existing rows with 1, 2, 3...
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_number SERIAL;

-- Restart sequence at 1000 for prestige if it's currently low
select setval(pg_get_serial_sequence('leads', 'lead_number'), greatest(1000, (select max(lead_number) from leads)) + 1);

-- Index for searching
CREATE INDEX IF NOT EXISTS idx_leads_lead_number ON leads(lead_number);

-- 2. Create SMS Logs Table for robust auditing
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sent_to TEXT NOT NULL,
    message_body TEXT,
    provider_response TEXT,
    status TEXT CHECK (status IN ('success', 'failed', 'pending')),
    trigger_type TEXT CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'manual', 'bulk')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for checking duplicates quickly
CREATE INDEX IF NOT EXISTS idx_sms_logs_check ON sms_logs(lead_id, trigger_type, created_at);

-- 3. Add RLS Policies for SMS Logs (Managers only usually, or Agent can see their own leads' logs)
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all sms logs" 
ON sms_logs FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'manager', 'founder')
    )
);

CREATE POLICY "System can insert logs" 
ON sms_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);
