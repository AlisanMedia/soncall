
-- Create SMS Logs Table
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sent_to TEXT NOT NULL,
    message_body TEXT,
    provider_response TEXT,
    status TEXT CHECK (status IN ('success', 'failed', 'pending')),
    trigger_type TEXT CHECK (trigger_type IN ('5h_reminder', '1h_reminder', 'manual', 'bulk', 'motivation')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for checking duplicates quickly
CREATE INDEX IF NOT EXISTS idx_sms_logs_check ON sms_logs(lead_id, trigger_type, created_at);

-- Enable Row Level Security
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Managers can view all sms logs
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

-- System or authenticated users can insert logs
CREATE POLICY "System can insert logs" 
ON sms_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);
