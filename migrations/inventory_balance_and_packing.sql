-- ============================================================================
-- INVENTORY BALANCE + PACKING (Single Source of Truth)
-- ============================================================================
-- Design: docs/INVENTORY_MANAGEMENT_DESIGN.md
-- 1. inventory_balance = current snapshot (never manually edited)
-- 2. stock_movements extended with box_change, piece_change, before_qty, after_qty, unit
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. inventory_balance (current snapshot per product per branch)
-- ----------------------------------------------------------------------------
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

-- One row per (product_id, branch_id) when branch_id is set; one row per product when branch_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_balance_product_branch
  ON inventory_balance(product_id, branch_id) WHERE branch_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_balance_product_null_branch
  ON inventory_balance(product_id) WHERE branch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_balance_company ON inventory_balance(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balance_product ON inventory_balance(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balance_branch ON inventory_balance(branch_id) WHERE branch_id IS NOT NULL;

COMMENT ON TABLE inventory_balance IS 'Current stock snapshot. Updated only by movements. Never edit manually.';
COMMENT ON COLUMN inventory_balance.qty IS 'Main quantity (meters/pcs)';
COMMENT ON COLUMN inventory_balance.boxes IS 'Box count';
COMMENT ON COLUMN inventory_balance.pieces IS 'Loose pieces';

-- ----------------------------------------------------------------------------
-- 2. Extend stock_movements with packing + audit columns (add if not exist)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'box_change') THEN
    ALTER TABLE stock_movements ADD COLUMN box_change NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'piece_change') THEN
    ALTER TABLE stock_movements ADD COLUMN piece_change NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'before_qty') THEN
    ALTER TABLE stock_movements ADD COLUMN before_qty NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'after_qty') THEN
    ALTER TABLE stock_movements ADD COLUMN after_qty NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'unit') THEN
    ALTER TABLE stock_movements ADD COLUMN unit TEXT;
  END IF;
END $$;

COMMENT ON COLUMN stock_movements.box_change IS 'Change in box count (+/-)';
COMMENT ON COLUMN stock_movements.piece_change IS 'Change in loose pieces (+/-)';
COMMENT ON COLUMN stock_movements.before_qty IS 'Balance before this movement';
COMMENT ON COLUMN stock_movements.after_qty IS 'Balance after this movement';

-- ----------------------------------------------------------------------------
-- 3. Function: upsert inventory_balance after stock_movement insert
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_inventory_balance_from_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_branch_id UUID := NEW.branch_id;
  v_product_id UUID := NEW.product_id;
  v_company_id UUID := NEW.company_id;
  v_qty_delta NUMERIC := COALESCE(NEW.quantity, 0);
  v_box_delta NUMERIC := COALESCE(NEW.box_change, 0);
  v_piece_delta NUMERIC := COALESCE(NEW.piece_change, 0);
BEGIN
  IF v_branch_id IS NOT NULL THEN
    INSERT INTO inventory_balance (company_id, product_id, branch_id, qty, boxes, pieces, unit, updated_at)
    VALUES (v_company_id, v_product_id, v_branch_id, v_qty_delta, v_box_delta, v_piece_delta, COALESCE(NEW.unit, 'pcs'), now())
    ON CONFLICT (product_id, branch_id) WHERE (branch_id IS NOT NULL)
    DO UPDATE SET
      qty = inventory_balance.qty + v_qty_delta,
      boxes = inventory_balance.boxes + v_box_delta,
      pieces = inventory_balance.pieces + v_piece_delta,
      unit = COALESCE(EXCLUDED.unit, inventory_balance.unit),
      updated_at = now();
  ELSE
    INSERT INTO inventory_balance (company_id, product_id, branch_id, qty, boxes, pieces, unit, updated_at)
    VALUES (v_company_id, v_product_id, NULL, v_qty_delta, v_box_delta, v_piece_delta, COALESCE(NEW.unit, 'pcs'), now())
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

-- Trigger: after insert on stock_movements → sync inventory_balance
DROP TRIGGER IF EXISTS trigger_sync_inventory_balance_from_movement ON stock_movements;
CREATE TRIGGER trigger_sync_inventory_balance_from_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION sync_inventory_balance_from_movement();

-- ----------------------------------------------------------------------------
-- 4. Backfill inventory_balance from current stock_movements (optional, run once)
-- ----------------------------------------------------------------------------
-- Uncomment to backfill from existing movements (sum quantity/box/piece per product_id, branch_id):
/*
INSERT INTO inventory_balance (company_id, product_id, branch_id, qty, boxes, pieces, unit, updated_at)
SELECT
  company_id,
  product_id,
  branch_id,
  COALESCE(SUM(quantity), 0),
  COALESCE(SUM(box_change), 0),
  COALESCE(SUM(piece_change), 0),
  MAX(unit),
  now()
FROM stock_movements
GROUP BY company_id, product_id, branch_id
ON CONFLICT (product_id, branch_id)
DO UPDATE SET
  qty = EXCLUDED.qty,
  boxes = EXCLUDED.boxes,
  pieces = EXCLUDED.pieces,
  updated_at = now();
*/
