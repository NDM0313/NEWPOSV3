-- Studio module performance indexes
-- Run after: fix_after_drop_studio_orders.sql, studio_production_v2_tables.sql (and V3 tables if present)
-- Safe: CREATE INDEX IF NOT EXISTS

-- Legacy: studio_productions (used by Studio Dashboard, Studio Sales, Pipeline)
CREATE INDEX IF NOT EXISTS idx_studio_productions_company_id ON studio_productions(company_id);
CREATE INDEX IF NOT EXISTS idx_studio_productions_sale_id ON studio_productions(sale_id);
CREATE INDEX IF NOT EXISTS idx_studio_productions_company_branch ON studio_productions(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_studio_productions_created_at ON studio_productions(created_at DESC);

-- Legacy: studio_production_stages (production_id already in fix_after_drop_studio_orders)
CREATE INDEX IF NOT EXISTS idx_studio_production_stages_production_id ON studio_production_stages(production_id);
CREATE INDEX IF NOT EXISTS idx_studio_production_stages_worker_id ON studio_production_stages(assigned_worker_id) WHERE assigned_worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_studio_production_stages_status ON studio_production_stages(status);

-- V3: studio_production_orders_v3 (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_orders_v3') THEN
    CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v3_company ON studio_production_orders_v3(company_id);
    CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v3_sale ON studio_production_orders_v3(sale_id);
    CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v3_created_at ON studio_production_orders_v3(created_at DESC);
  END IF;
END $$;

-- V3: studio_production_stages_v3 (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages_v3') THEN
    CREATE INDEX IF NOT EXISTS idx_studio_production_stages_v3_order_id ON studio_production_stages_v3(order_id);
    CREATE INDEX IF NOT EXISTS idx_studio_production_stages_v3_worker_id ON studio_production_stages_v3(worker_id) WHERE worker_id IS NOT NULL;
  END IF;
END $$;
