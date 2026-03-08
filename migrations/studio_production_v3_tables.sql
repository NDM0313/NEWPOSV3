-- ============================================================================
-- STUDIO PRODUCTION V3 TABLES (Safe Zone)
-- ============================================================================
-- Isolated from V2. Use only when feature_flags.studio_production_v3 is ON.
-- Do NOT modify studio_production_orders_v2 / studio_production_stages_v2.
-- ============================================================================

-- 1. V3 production orders
CREATE TABLE IF NOT EXISTS studio_production_orders_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_no VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  fabric TEXT,
  design_notes TEXT,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  production_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit_percent NUMERIC(8,2),
  profit_amount NUMERIC(15,2),
  final_price NUMERIC(15,2),
  generated_invoice_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, production_no)
);

CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v3_company ON studio_production_orders_v3(company_id);
CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v3_sale ON studio_production_orders_v3(sale_id);
CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v3_status ON studio_production_orders_v3(status);
CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v3_branch ON studio_production_orders_v3(branch_id);

COMMENT ON TABLE studio_production_orders_v3 IS 'Studio Production V3: orders. Used only when feature_flags.studio_production_v3 is enabled.';

-- 2. V3 stages (per order)
CREATE TABLE IF NOT EXISTS studio_production_stages_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES studio_production_orders_v3(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  expected_cost NUMERIC(15,2) DEFAULT 0,
  actual_cost NUMERIC(15,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_production_stages_v3_order ON studio_production_stages_v3(order_id);

COMMENT ON TABLE studio_production_stages_v3 IS 'Studio Production V3: stages per order. Worker cost stored in actual_cost.';

-- 3. V3 cost breakdown (for invoice display and storage)
CREATE TABLE IF NOT EXISTS studio_production_cost_breakdown_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES studio_production_orders_v3(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  worker_name TEXT,
  worker_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('worker_cost', 'profit'))
);

CREATE INDEX IF NOT EXISTS idx_studio_production_cost_breakdown_v3_production ON studio_production_cost_breakdown_v3(production_id);

COMMENT ON TABLE studio_production_cost_breakdown_v3 IS 'Studio Production V3: cost breakdown for invoice (worker costs + profit).';

-- Optional: sales column for "Show Production Detail" on generated invoice
ALTER TABLE sales ADD COLUMN IF NOT EXISTS show_studio_breakdown BOOLEAN DEFAULT false;
