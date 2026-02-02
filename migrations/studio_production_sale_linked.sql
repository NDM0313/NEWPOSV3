-- ============================================================================
-- STUDIO PRODUCTION – SALE-LINKED (OPTION A)
-- ============================================================================
-- Rule: Studio production must be linked to a sale. No standalone production.
-- Run after: studio_production_module.sql
-- ============================================================================

-- 1. Link studio_productions to sale (REQUIRED for new productions)
ALTER TABLE studio_productions
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_studio_productions_sale ON studio_productions(sale_id);
COMMENT ON COLUMN studio_productions.sale_id IS 'Sale this production belongs to. Required for new studio productions.';

-- 2. Stage type enum (Dyer, Stitching, Handwork)
DO $$ BEGIN
  CREATE TYPE studio_production_stage_type AS ENUM ('dyer', 'stitching', 'handwork');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE studio_production_stage_status AS ENUM ('pending', 'in_progress', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. studio_production_stages (one production → multiple stages; manager assigns worker, cost, marks complete)
CREATE TABLE IF NOT EXISTS studio_production_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES studio_productions(id) ON DELETE CASCADE,

  stage_type studio_production_stage_type NOT NULL,
  assigned_worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  cost NUMERIC(15,2) DEFAULT 0,
  status studio_production_stage_status NOT NULL DEFAULT 'pending',

  completed_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(production_id, stage_type)
);

CREATE INDEX IF NOT EXISTS idx_studio_production_stages_production ON studio_production_stages(production_id);
CREATE INDEX IF NOT EXISTS idx_studio_production_stages_worker ON studio_production_stages(assigned_worker_id);
COMMENT ON TABLE studio_production_stages IS 'Per-production stages (Dyer, Stitching, Handwork). Manager assigns worker, sets cost, marks complete.';

-- 4. Trigger: stages updated_at
CREATE OR REPLACE FUNCTION update_studio_production_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_studio_production_stages_updated_at ON studio_production_stages;
CREATE TRIGGER trigger_studio_production_stages_updated_at
  BEFORE UPDATE ON studio_production_stages
  FOR EACH ROW EXECUTE PROCEDURE update_studio_production_stages_updated_at();

-- 5. sales.studio_charges (added to customer bill on production complete)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS studio_charges NUMERIC(15,2) DEFAULT 0;
COMMENT ON COLUMN sales.studio_charges IS 'Sum of worker costs from linked studio production stages. Added to customer bill on completion.';

-- 6. worker_ledger_entries (separate from customer payments; for worker payment tracking)
CREATE TABLE IF NOT EXISTS worker_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  amount NUMERIC(15,2) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_ledger_entries_company ON worker_ledger_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_worker_ledger_entries_worker ON worker_ledger_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_ledger_entries_reference ON worker_ledger_entries(reference_type, reference_id);
COMMENT ON TABLE worker_ledger_entries IS 'Worker cost entries (studio stages). Separate from customer payments.';
