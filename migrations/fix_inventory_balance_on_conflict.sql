-- ============================================================================
-- FIX: "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" when inserting into stock_movements (e.g. studio production
-- completion).
-- The trigger sync_inventory_balance_from_movement() uses ON CONFLICT;
-- inventory_balance must have matching UNIQUE indexes. Requires PostgreSQL 15+
-- for ON CONFLICT ... WHERE (partial index match). Run in Supabase SQL Editor.
-- ============================================================================

-- 1. Ensure inventory_balance exists (if not already from inventory_balance_and_packing.sql)
CREATE TABLE IF NOT EXISTS inventory_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  product_id UUID NOT NULL,
  branch_id UUID,
  qty NUMERIC NOT NULL DEFAULT 0,
  boxes NUMERIC NOT NULL DEFAULT 0,
  pieces NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add unique indexes required by the trigger's ON CONFLICT (run if not exist)
-- For (product_id, branch_id) when branch_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_balance_product_branch
  ON inventory_balance(product_id, branch_id) WHERE branch_id IS NOT NULL;

-- For (product_id) when branch_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_balance_product_null_branch
  ON inventory_balance(product_id) WHERE branch_id IS NULL;

-- 3. Recreate trigger function so ON CONFLICT matches the partial unique indexes
--    (required for "no unique or exclusion constraint" error to go away)
CREATE OR REPLACE FUNCTION sync_inventory_balance_from_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_branch_id UUID := NEW.branch_id;
  v_product_id UUID := NEW.product_id;
  v_company_id UUID := NEW.company_id;
  v_qty_delta NUMERIC := COALESCE(NEW.quantity, 0);
  v_box_delta NUMERIC := COALESCE(NEW.box_change, 0);
  v_piece_delta NUMERIC := COALESCE(NEW.piece_change, 0);
  v_unit TEXT := COALESCE(NEW.unit, 'pcs');
BEGIN
  IF v_branch_id IS NOT NULL THEN
    INSERT INTO inventory_balance (company_id, product_id, branch_id, qty, boxes, pieces, unit, updated_at)
    VALUES (v_company_id, v_product_id, v_branch_id, v_qty_delta, v_box_delta, v_piece_delta, v_unit, now())
    ON CONFLICT (product_id, branch_id) WHERE (branch_id IS NOT NULL)
    DO UPDATE SET
      qty = inventory_balance.qty + v_qty_delta,
      boxes = inventory_balance.boxes + v_box_delta,
      pieces = inventory_balance.pieces + v_piece_delta,
      unit = COALESCE(EXCLUDED.unit, inventory_balance.unit),
      updated_at = now();
  ELSE
    INSERT INTO inventory_balance (company_id, product_id, branch_id, qty, boxes, pieces, unit, updated_at)
    VALUES (v_company_id, v_product_id, NULL, v_qty_delta, v_box_delta, v_piece_delta, v_unit, now())
    ON CONFLICT (product_id) WHERE (branch_id IS NULL)
    DO UPDATE SET
      qty = inventory_balance.qty + v_qty_delta,
      boxes = inventory_balance.boxes + v_box_delta,
      pieces = inventory_balance.pieces + v_piece_delta,
      unit = COALESCE(EXCLUDED.unit, inventory_balance.unit),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
