-- ============================================================================
-- Purchase Final → Stock Movements (Web + Mobile)
-- ============================================================================
-- When a purchase is created or updated with status = 'final', create
-- stock_movements (IN) for each purchase_items line so inventory updates.
-- Idempotent: skips if movements for this purchase already exist.
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
  -- Only when status is 'final' (INSERT with status final, or UPDATE to final)
  IF NEW.status IS DISTINCT FROM 'final' THEN
    RETURN NEW;
  END IF;

  -- Skip if we already have purchase movements for this purchase
  SELECT COUNT(*) INTO v_count
  FROM stock_movements
  WHERE reference_type = 'purchase' AND reference_id = NEW.id
    AND LOWER(TRIM(movement_type)) = 'purchase';
  IF v_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Insert from purchase_items
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
      'Purchase ' || COALESCE(NEW.po_no, NEW.id::TEXT) || ' – final',
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_purchase_final_stock_movement() IS 'Creates stock_movements (IN) when purchase.status is final. Idempotent. Ensures mobile and web purchases update inventory.';

DROP TRIGGER IF EXISTS purchase_final_stock_movement_trigger ON purchases;
CREATE TRIGGER purchase_final_stock_movement_trigger
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION handle_purchase_final_stock_movement();

COMMENT ON TRIGGER purchase_final_stock_movement_trigger ON purchases IS 'On insert/update with status=final: insert stock_movements for each purchase_items line.';
