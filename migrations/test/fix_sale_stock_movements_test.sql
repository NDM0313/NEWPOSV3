-- ============================================================================
-- TEST ONLY — DO NOT RUN ON PRODUCTION
-- ============================================================================
-- Sale Final → Stock Movements (Studio Sale + all sales)
-- Use only on a test/staging database. Plan: MASTER_PROMPT_STUDIO_SAFETY.md
-- Production migration: ../sale_final_stock_movement_trigger.sql (apply after approval)
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_sale_final_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_count INT;
  v_unit_price NUMERIC;
  v_qty NUMERIC;
BEGIN
  -- Only when status changes TO 'final'
  IF (NEW.status IS DISTINCT FROM 'final') OR (OLD.status = 'final') THEN
    RETURN NEW;
  END IF;

  -- Skip if we already have sale movements for this sale (app may have created them)
  SELECT COUNT(*) INTO v_count
  FROM stock_movements
  WHERE reference_type = 'sale' AND reference_id = NEW.id
    AND LOWER(TRIM(movement_type)) = 'sale';
  IF v_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Insert from sales_items (primary)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items') THEN
    FOR v_item IN
      SELECT product_id, variation_id, quantity, unit_price
      FROM sales_items
      WHERE sale_id = NEW.id AND (quantity IS NULL OR quantity > 0)
    LOOP
      v_qty := COALESCE(v_item.quantity, 1)::NUMERIC;
      v_unit_price := COALESCE(v_item.unit_price, 0)::NUMERIC;
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
        -v_qty,
        v_unit_price,
        v_unit_price * v_qty,
        'SALE',
        'sale',
        NEW.id,
        'Sale ' || COALESCE(NEW.invoice_no, NEW.id::TEXT) || ' – final',
        NOW()
      );
    END LOOP;
    RETURN NEW;
  END IF;

  -- Fallback: sale_items (legacy)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_items') THEN
    FOR v_item IN
      SELECT product_id, variation_id, quantity, price AS unit_price
      FROM sale_items
      WHERE sale_id = NEW.id AND (quantity IS NULL OR quantity > 0)
    LOOP
      v_qty := COALESCE(v_item.quantity, 1)::NUMERIC;
      v_unit_price := COALESCE(v_item.unit_price, 0)::NUMERIC;
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
        -v_qty,
        v_unit_price,
        v_unit_price * v_qty,
        'SALE',
        'sale',
        NEW.id,
        'Sale ' || COALESCE(NEW.invoice_no, NEW.id::TEXT) || ' – final',
        NOW()
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_sale_final_stock_movement() IS 'TEST: Creates stock_movements (OUT) when sale.status becomes final. Idempotent. Do not use in production until approved.';

DROP TRIGGER IF EXISTS sale_final_stock_movement_trigger ON sales;
CREATE TRIGGER sale_final_stock_movement_trigger
  AFTER UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION handle_sale_final_stock_movement();

COMMENT ON TRIGGER sale_final_stock_movement_trigger ON sales IS 'TEST: On status→final: insert stock_movements for each sale line. Apply to production only after approval.';
