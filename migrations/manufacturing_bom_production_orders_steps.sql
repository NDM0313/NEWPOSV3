-- ============================================================================
-- MANUFACTURING: Bill of Materials, Production Orders, Production Steps
-- ============================================================================
-- Step 4 — Manufacturing. Flow: BOM → Production Order → Steps (Cutting, Dyeing, Stitching, Handwork).
-- Integrates with Studio (dyeing/stitching/handwork as production steps).
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bill of Materials (product → materials with quantity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bill_of_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_required NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_bom_company ON bill_of_materials(company_id);
CREATE INDEX IF NOT EXISTS idx_bom_product ON bill_of_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_bom_material ON bill_of_materials(material_id);

COMMENT ON TABLE bill_of_materials IS 'BOM: finished product → raw material with quantity. Used for production orders.';

-- ----------------------------------------------------------------------------
-- 2. Production Orders (company, product, quantity, status, dates)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  order_number VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_orders_company ON production_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_product ON production_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_dates ON production_orders(start_date, end_date);

COMMENT ON TABLE production_orders IS 'Manufacturing: production order for a product and quantity. Steps: cutting, dyeing, stitching, handwork.';

-- ----------------------------------------------------------------------------
-- 3. Production Steps (per order: step name, worker, cost, status)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  cost NUMERIC(15,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_steps_order ON production_steps(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_steps_worker ON production_steps(worker_id);
CREATE INDEX IF NOT EXISTS idx_production_steps_status ON production_steps(status);

COMMENT ON TABLE production_steps IS 'Manufacturing: steps per order (e.g. cutting, dyeing, stitching, handwork). Links to workers.';

-- ----------------------------------------------------------------------------
-- 4. RLS (company-scoped)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE production_steps ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS bom_select ON bill_of_materials;
CREATE POLICY bom_select ON bill_of_materials FOR SELECT USING (company_id = get_user_company_id());
DROP POLICY IF EXISTS bom_insert ON bill_of_materials;
CREATE POLICY bom_insert ON bill_of_materials FOR INSERT WITH CHECK (company_id = get_user_company_id());
DROP POLICY IF EXISTS bom_update ON bill_of_materials;
CREATE POLICY bom_update ON bill_of_materials FOR UPDATE USING (company_id = get_user_company_id());
DROP POLICY IF EXISTS bom_delete ON bill_of_materials;
CREATE POLICY bom_delete ON bill_of_materials FOR DELETE USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS production_orders_select ON production_orders;
CREATE POLICY production_orders_select ON production_orders FOR SELECT USING (company_id = get_user_company_id());
DROP POLICY IF EXISTS production_orders_insert ON production_orders;
CREATE POLICY production_orders_insert ON production_orders FOR INSERT WITH CHECK (company_id = get_user_company_id());
DROP POLICY IF EXISTS production_orders_update ON production_orders;
CREATE POLICY production_orders_update ON production_orders FOR UPDATE USING (company_id = get_user_company_id());
DROP POLICY IF EXISTS production_orders_delete ON production_orders;
CREATE POLICY production_orders_delete ON production_orders FOR DELETE USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS production_steps_select ON production_steps;
CREATE POLICY production_steps_select ON production_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM production_orders po WHERE po.id = production_steps.production_order_id AND po.company_id = get_user_company_id())
);
DROP POLICY IF EXISTS production_steps_insert ON production_steps;
CREATE POLICY production_steps_insert ON production_steps FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM production_orders po WHERE po.id = production_steps.production_order_id AND po.company_id = get_user_company_id())
);
DROP POLICY IF EXISTS production_steps_update ON production_steps;
CREATE POLICY production_steps_update ON production_steps FOR UPDATE USING (
  EXISTS (SELECT 1 FROM production_orders po WHERE po.id = production_steps.production_order_id AND po.company_id = get_user_company_id())
);
DROP POLICY IF EXISTS production_steps_delete ON production_steps;
CREATE POLICY production_steps_delete ON production_steps FOR DELETE USING (
  EXISTS (SELECT 1 FROM production_orders po WHERE po.id = production_steps.production_order_id AND po.company_id = get_user_company_id())
);

-- ----------------------------------------------------------------------------
-- 5. updated_at triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION manufacturing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bom_updated_at ON bill_of_materials;
CREATE TRIGGER bom_updated_at BEFORE UPDATE ON bill_of_materials FOR EACH ROW EXECUTE FUNCTION manufacturing_updated_at();
DROP TRIGGER IF EXISTS production_orders_updated_at ON production_orders;
CREATE TRIGGER production_orders_updated_at BEFORE UPDATE ON production_orders FOR EACH ROW EXECUTE FUNCTION manufacturing_updated_at();
DROP TRIGGER IF EXISTS production_steps_updated_at ON production_steps;
CREATE TRIGGER production_steps_updated_at BEFORE UPDATE ON production_steps FOR EACH ROW EXECUTE FUNCTION manufacturing_updated_at();
