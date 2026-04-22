-- ============================================================================
-- 20260424 — Fix: purchase.status='received' should also post stock_movements
-- ============================================================================
-- Previously, handle_purchase_final_stock_movement early-returned unless
-- status='final'. Web's "Convert to Received" path posts the accounting JE
-- (record_purchase_with_accounting triggers for both received+final) but the
-- stock trigger never fired for 'received', so inventory stayed stale — a
-- dangerous mismatch between ledger and stock.
--
-- Fix: allow trigger to fire for NEW.status IN ('received','final').
-- Idempotency (existing rows-exist check) still prevents duplicates.
--
-- Also: one-shot BACKFILL for any purchase currently in ('received','final')
-- that has no corresponding stock_movements rows. Safe because the trigger
-- body is idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_purchase_final_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_count INT;
  v_qty NUMERIC;
  v_unit_price NUMERIC;
  v_total_cost NUMERIC;
BEGIN
  -- Post stock only when goods are in hand: 'received' or 'final'.
  IF NEW.status NOT IN ('received', 'final') THEN
    RETURN NEW;
  END IF;

  -- Skip if we already have purchase movements for this purchase (idempotent
  -- across ordered→received→final transitions).
  SELECT COUNT(*) INTO v_count
  FROM stock_movements
  WHERE reference_type = 'purchase' AND reference_id = NEW.id
    AND LOWER(TRIM(movement_type)) = 'purchase';
  IF v_count > 0 THEN
    RETURN NEW;
  END IF;

  FOR v_item IN
    SELECT product_id, variation_id, quantity, unit_price
    FROM purchase_items
    WHERE purchase_id = NEW.id AND (quantity IS NULL OR quantity > 0)
  LOOP
    v_qty := COALESCE(v_item.quantity, 1)::NUMERIC;
    v_unit_price := COALESCE(v_item.unit_price, 0)::NUMERIC;
    v_total_cost := v_unit_price * v_qty;
    INSERT INTO stock_movements (
      company_id,
      branch_id,
      product_id,
      variation_id,
      quantity,
      unit_cost,
      total_cost,
      movement_type,
      reference_type,
      reference_id,
      notes,
      created_at
    ) VALUES (
      NEW.company_id,
      NEW.branch_id,
      v_item.product_id,
      v_item.variation_id,
      v_qty,
      v_unit_price,
      v_total_cost,
      'purchase',
      'purchase',
      NEW.id,
      'Purchase ' || COALESCE(NEW.po_no, NEW.id::TEXT) || ' – ' || NEW.status,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_purchase_final_stock_movement() IS
  'Creates stock_movements (IN) when purchase.status is received or final. Idempotent.';

-- Re-attach trigger (CREATE OR REPLACE FUNCTION keeps the existing trigger; DROP+CREATE is safe).
DROP TRIGGER IF EXISTS purchase_final_stock_movement_trigger ON purchases;
CREATE TRIGGER purchase_final_stock_movement_trigger
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION handle_purchase_final_stock_movement();

COMMENT ON TRIGGER purchase_final_stock_movement_trigger ON purchases IS
  'On insert/update with status in (received, final): insert stock_movements for each purchase_items line.';

-- ============================================================================
-- Backfill: past purchases where status is already received/final but no
-- stock_movements exist. Use an UPDATE no-op to re-fire the trigger.
-- ============================================================================
DO $$
DECLARE
  v_p RECORD;
  v_fix_count INT := 0;
BEGIN
  FOR v_p IN
    SELECT p.id
    FROM purchases p
    WHERE p.status IN ('received', 'final')
      AND p.cancelled_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM stock_movements sm
        WHERE sm.reference_type = 'purchase'
          AND sm.reference_id = p.id
          AND LOWER(TRIM(sm.movement_type)) = 'purchase'
      )
  LOOP
    UPDATE purchases SET status = status WHERE id = v_p.id;
    v_fix_count := v_fix_count + 1;
  END LOOP;
  RAISE NOTICE '[20260424] Backfilled % purchase(s) with missing stock_movements', v_fix_count;
END $$;
