-- Fix: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- inventory_balance_and_packing creates trigger with ON CONFLICT (product_id, branch_id) but
-- the table has partial unique indexes. Must use WHERE clause to match.
-- Runs after inventory_balance_and_packing (sorts later).

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
