-- ============================================================================
-- STUDIO PRODUCTION MODULE
-- ============================================================================
-- Production jobs: draft → in_progress → completed / cancelled
-- Inventory impact ONLY when status = completed (finished goods ADD via stock_movements)
-- Audit: studio_production_logs for every create/update/status_change
-- ============================================================================

-- 1. Production status enum
DO $$ BEGIN
  CREATE TYPE studio_production_status AS ENUM ('draft', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. studio_productions table
CREATE TABLE IF NOT EXISTS studio_productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,

  production_no VARCHAR(50) NOT NULL,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,

  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,

  quantity NUMERIC(15,2) NOT NULL CHECK (quantity > 0),
  boxes NUMERIC(15,2),
  pieces NUMERIC(15,2),
  unit VARCHAR(50) DEFAULT 'piece',

  estimated_cost NUMERIC(15,2) DEFAULT 0,
  actual_cost NUMERIC(15,2) DEFAULT 0,

  status studio_production_status NOT NULL DEFAULT 'draft',

  start_date DATE,
  expected_date DATE,
  completed_at TIMESTAMPTZ,

  assigned_worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  assigned_machine_or_karigar TEXT,

  notes TEXT,
  instructions TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, production_no)
);

CREATE INDEX IF NOT EXISTS idx_studio_productions_company ON studio_productions(company_id);
CREATE INDEX IF NOT EXISTS idx_studio_productions_branch ON studio_productions(branch_id);
CREATE INDEX IF NOT EXISTS idx_studio_productions_status ON studio_productions(status);
CREATE INDEX IF NOT EXISTS idx_studio_productions_product ON studio_productions(product_id);
CREATE INDEX IF NOT EXISTS idx_studio_productions_date ON studio_productions(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_studio_productions_created_at ON studio_productions(created_at DESC);

-- 3. studio_production_logs (activity / audit)
CREATE TABLE IF NOT EXISTS studio_production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES studio_productions(id) ON DELETE CASCADE,

  action_type VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,

  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_production_logs_production ON studio_production_logs(production_id);
CREATE INDEX IF NOT EXISTS idx_studio_production_logs_performed_at ON studio_production_logs(performed_at DESC);

-- 4. Allow PRODUCTION_IN in stock_movements (for completed production → add finished goods)
-- If your stock_movements table has a CHECK on movement_type, add 'PRODUCTION_IN' to the allowed values.
-- Example (run separately if needed):
--   ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
--   ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check
--     CHECK (movement_type IN ('PURCHASE','SALE','RETURN','ADJUSTMENT','TRANSFER','SELL_RETURN','PURCHASE_RETURN','RENTAL_OUT','RENTAL_RETURN','RENTAL_IN','PRODUCTION_IN'));

-- 5. Trigger: updated_at
CREATE OR REPLACE FUNCTION update_studio_productions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_studio_productions_updated_at ON studio_productions;
CREATE TRIGGER trigger_studio_productions_updated_at
  BEFORE UPDATE ON studio_productions
  FOR EACH ROW EXECUTE FUNCTION update_studio_productions_updated_at();

COMMENT ON TABLE studio_productions IS 'Studio production jobs: draft → in_progress → completed. Inventory impact only on completed.';
COMMENT ON TABLE studio_production_logs IS 'Audit trail for production create/update/status change (admin).';
