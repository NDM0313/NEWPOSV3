-- Create audit_logs table required by log_audit_trail() trigger on sales, purchases, etc.
-- Without this table, INSERT into sales fails with "relation audit_logs does not exist".
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert (trigger runs as SECURITY DEFINER but RLS still applies to table)
DROP POLICY IF EXISTS "Allow authenticated insert audit" ON audit_logs;
CREATE POLICY "Allow authenticated insert audit" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read audit" ON audit_logs;
CREATE POLICY "Allow authenticated read audit" ON audit_logs
  FOR SELECT TO authenticated USING (true);
