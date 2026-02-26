-- ============================================================================
-- STUDIO–SALES REAL-TIME SYNC & ACCOUNTING INTEGRITY
-- ============================================================================
-- 1. Ensure sales.studio_charges exists (add if missing).
-- 2. Accountability: created_by, completed_by, updated_by on studio_production_stages.
-- 3. RPC/trigger: on any studio_production_stages change, recalc sale studio_charges
--    and due_amount = total + studio_charges - paid_amount (server-side only).
-- 4. Worker payments stay separate (worker_ledger_entries); balance_due = customer only.
-- ============================================================================

-- 1. sales.studio_charges (may already exist from studio_production_sale_linked.sql)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS studio_charges NUMERIC(15,2) DEFAULT 0;
COMMENT ON COLUMN sales.studio_charges IS 'Sum of worker costs from linked studio production stages. Final bill = total + studio_charges. Balance due = total + studio_charges - paid_amount.';

-- 2. Accountability columns on studio_production_stages
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
COMMENT ON COLUMN studio_production_stages.created_by IS 'User who created the task.';
COMMENT ON COLUMN studio_production_stages.completed_by IS 'User who marked the task completed.';
COMMENT ON COLUMN studio_production_stages.updated_by IS 'User who last updated cost/worker.';

-- 3. Function: compute total studio cost for a sale (sum of all stage costs for productions linked to this sale)
CREATE OR REPLACE FUNCTION get_sale_studio_charges(p_sale_id UUID)
RETURNS NUMERIC(15,2) AS $$
  SELECT COALESCE(SUM(s.cost), 0)::NUMERIC(15,2)
  FROM studio_production_stages s
  INNER JOIN studio_productions p ON p.id = s.production_id
  WHERE p.sale_id = p_sale_id;
$$ LANGUAGE sql STABLE;

-- 4. Function: sync sales.studio_charges and sales.due_amount for a given sale
--    Rule: due_amount = total + studio_charges - paid_amount (customer balance only; worker payments separate)
CREATE OR REPLACE FUNCTION sync_sale_studio_charges_for_sale(p_sale_id UUID)
RETURNS void AS $$
DECLARE
  v_studio_charges NUMERIC(15,2);
  v_total NUMERIC(15,2);
  v_paid NUMERIC(15,2);
  v_due NUMERIC(15,2);
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;

  v_studio_charges := get_sale_studio_charges(p_sale_id);

  SELECT total, paid_amount INTO v_total, v_paid
  FROM sales WHERE id = p_sale_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_total := COALESCE(v_total, 0);
  v_paid := COALESCE(v_paid, 0);
  v_due := GREATEST(0, (v_total + v_studio_charges) - v_paid);

  UPDATE sales
  SET studio_charges = v_studio_charges,
      due_amount = v_due,
      updated_at = NOW()
  WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger function: on studio_production_stages change, sync the affected sale(s)
CREATE OR REPLACE FUNCTION trigger_sync_sale_studio_charges()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT p.sale_id INTO v_sale_id FROM studio_productions p WHERE p.id = OLD.production_id;
    IF v_sale_id IS NOT NULL THEN
      PERFORM sync_sale_studio_charges_for_sale(v_sale_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT p.sale_id INTO v_sale_id FROM studio_productions p WHERE p.id = NEW.production_id;
    IF v_sale_id IS NOT NULL THEN
      PERFORM sync_sale_studio_charges_for_sale(v_sale_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_after_studio_stage_sync_sale ON studio_production_stages;
CREATE TRIGGER trigger_after_studio_stage_sync_sale
  AFTER INSERT OR UPDATE OR DELETE ON studio_production_stages
  FOR EACH ROW EXECUTE FUNCTION trigger_sync_sale_studio_charges();

COMMENT ON FUNCTION get_sale_studio_charges(UUID) IS 'Sum of stage costs for productions linked to sale. Used by sync trigger.';
COMMENT ON FUNCTION sync_sale_studio_charges_for_sale(UUID) IS 'Recalc sales.studio_charges and due_amount (total + studio_charges - paid_amount).';
