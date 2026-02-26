-- Activity Timeline: table for sale/purchase/rental/payment activity logs.
-- Used by activityLogService and ViewSaleDetailsDrawer / ViewPurchaseDetailsDrawer.
-- Run in Supabase SQL Editor if Activity Timeline shows "No activity logs found".

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  entity_reference VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  field VARCHAR(100),
  old_value JSONB,
  new_value JSONB,
  amount DECIMAL(15,2),
  payment_method VARCHAR(50),
  payment_account_id UUID,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_name VARCHAR(255),
  performed_by_email VARCHAR(255),
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module_entity ON activity_logs(module, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated insert activity_logs" ON activity_logs;
CREATE POLICY "Allow authenticated insert activity_logs" ON activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read activity_logs" ON activity_logs;
CREATE POLICY "Allow authenticated read activity_logs" ON activity_logs
  FOR SELECT TO authenticated USING (true);
