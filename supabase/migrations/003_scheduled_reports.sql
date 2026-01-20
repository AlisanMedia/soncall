-- ============================================
-- Scheduled Reporting System Schema
-- ============================================

-- Scheduled Reports Configuration
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily_digest', 'weekly_performance', 'monthly_analytics', 'custom')),
  title TEXT DEFAULT 'Scheduled Report',
  schedule_config JSONB NOT NULL, -- {frequency, time, timezone, days}
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{email, name}]
  filters JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Execution History
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('pending', 'processing', 'success', 'failed')),
  recipients_count INTEGER DEFAULT 0,
  pdf_url TEXT,
  error_message TEXT,
  metrics_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Report Templates (for future customizability)
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  template_name TEXT NOT NULL,
  template_config JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_manager ON scheduled_reports(manager_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_scheduled_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON report_executions(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_created ON report_executions(created_at DESC);

-- Enable RLS
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Managed can only see their own scheduled reports
CREATE POLICY "Managers can view own scheduled reports"
  ON scheduled_reports FOR SELECT
  USING (manager_id = auth.uid());

CREATE POLICY "Managers can manage own scheduled reports"
  ON scheduled_reports FOR ALL
  USING (manager_id = auth.uid());

-- Managers can view executions for their reports
CREATE POLICY "Managers can view own report executions"
  ON report_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_reports 
      WHERE scheduled_reports.id = report_executions.scheduled_report_id 
      AND scheduled_reports.manager_id = auth.uid()
    )
  );

-- System can insert executions (service role override needed ideally, or auth user triggers it)
-- For cron jobs running as service role, RLS is bypassed. 
-- But if triggered manually by user:
CREATE POLICY "Managers can trigger executions"
  ON report_executions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduled_reports 
      WHERE scheduled_reports.id = scheduled_report_id 
      AND scheduled_reports.manager_id = auth.uid()
    )
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_update_scheduled_reports_updated_at ON scheduled_reports;
CREATE TRIGGER trg_update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON scheduled_reports TO authenticated;
GRANT ALL ON report_executions TO authenticated;
GRANT ALL ON report_templates TO authenticated;
