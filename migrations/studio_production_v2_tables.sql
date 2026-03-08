-- ============================================================================
-- STUDIO PRODUCTION V2 TABLES (Safe Zone)
-- ============================================================================
-- Separate tables for the advanced workflow. Existing studio_productions and
-- studio_production_stages are NOT modified. When feature flag is disabled,
-- these tables are ignored and legacy workflow is used.
-- Safe migrations: CREATE TABLE IF NOT EXISTS.
-- ============================================================================

-- 1. V2 production orders (linked to sale, like legacy but isolated)
CREATE TABLE IF NOT EXISTS studio_production_orders_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  production_no VARCHAR(50) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, production_no)
);

CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v2_company ON studio_production_orders_v2(company_id);
CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v2_sale ON studio_production_orders_v2(sale_id);
CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v2_status ON studio_production_orders_v2(status);

COMMENT ON TABLE studio_production_orders_v2 IS 'Studio Production V2: orders. Used only when feature_flags.studio_production_v2 is enabled.';

-- 2. V2 stages (per order)
CREATE TABLE IF NOT EXISTS studio_production_stages_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES studio_production_orders_v2(id) ON DELETE CASCADE,
  stage_type TEXT NOT NULL CHECK (stage_type IN ('dyer', 'stitching', 'handwork', 'embroidery', 'finishing', 'quality_check')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_production_stages_v2_order ON studio_production_stages_v2(order_id);

COMMENT ON TABLE studio_production_stages_v2 IS 'Studio Production V2: stages per order. Used only when feature flag enabled.';

-- 3. V2 stage assignments (worker assigned to stage)
CREATE TABLE IF NOT EXISTS studio_stage_assignments_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES studio_production_stages_v2(id) ON DELETE CASCADE,
  assigned_worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  expected_cost NUMERIC(15,2) DEFAULT 0,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stage_id)
);

CREATE INDEX IF NOT EXISTS idx_studio_stage_assignments_v2_stage ON studio_stage_assignments_v2(stage_id);
CREATE INDEX IF NOT EXISTS idx_studio_stage_assignments_v2_worker ON studio_stage_assignments_v2(assigned_worker_id);

COMMENT ON TABLE studio_stage_assignments_v2 IS 'Studio Production V2: worker assignment per stage. Used only when feature flag enabled.';

-- 4. V2 stage receipts (receive work, finalize cost)
CREATE TABLE IF NOT EXISTS studio_stage_receipts_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES studio_production_stages_v2(id) ON DELETE CASCADE,
  actual_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stage_id)
);

CREATE INDEX IF NOT EXISTS idx_studio_stage_receipts_v2_stage ON studio_stage_receipts_v2(stage_id);

COMMENT ON TABLE studio_stage_receipts_v2 IS 'Studio Production V2: receive and finalize cost per stage. Used only when feature flag enabled.';

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_studio_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_studio_production_orders_v2_updated_at ON studio_production_orders_v2;
CREATE TRIGGER trigger_studio_production_orders_v2_updated_at
  BEFORE UPDATE ON studio_production_orders_v2
  FOR EACH ROW EXECUTE PROCEDURE update_studio_v2_updated_at();

DROP TRIGGER IF EXISTS trigger_studio_production_stages_v2_updated_at ON studio_production_stages_v2;
CREATE TRIGGER trigger_studio_production_stages_v2_updated_at
  BEFORE UPDATE ON studio_production_stages_v2
  FOR EACH ROW EXECUTE PROCEDURE update_studio_v2_updated_at();

DROP TRIGGER IF EXISTS trigger_studio_stage_assignments_v2_updated_at ON studio_stage_assignments_v2;
CREATE TRIGGER trigger_studio_stage_assignments_v2_updated_at
  BEFORE UPDATE ON studio_stage_assignments_v2
  FOR EACH ROW EXECUTE PROCEDURE update_studio_v2_updated_at();
