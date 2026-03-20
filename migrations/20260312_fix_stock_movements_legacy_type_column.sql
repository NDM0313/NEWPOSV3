-- ============================================================================
-- Fix: 42703 column "type" of relation "stock_movements" does not exist
-- ============================================================================
-- Legacy triggers from supabase-extract/functions.sql call update_stock_on_purchase /
-- update_stock_on_sale, which INSERT into stock_movements using columns `type` and
-- `balance_qty`. The live ERP schema uses `movement_type` (see 05_inventory_movement_engine).
-- Finalizing a purchase/sale then fails inside the trigger.
--
-- 1) Drop legacy triggers that call those functions.
-- 2) Replace the legacy functions with no-ops (safe if an old script re-attaches triggers).
-- 3) Ensure canonical triggers exist (movement_type + correct column set).
-- ============================================================================

-- --- Legacy triggers (wrong INSERT column list) ---
DROP TRIGGER IF EXISTS trigger_update_stock_on_purchase ON public.purchases;
DROP TRIGGER IF EXISTS trigger_update_stock_on_sale ON public.sales;

-- --- Stub legacy functions so re-running complete-fix.sql cannot break inserts again ---
CREATE OR REPLACE FUNCTION public.update_stock_on_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deprecated: was INSERT ... stock_movements(type, balance_qty). Use
  -- handle_purchase_final_stock_movement() via purchase_final_stock_movement_trigger.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_stock_on_purchase() IS
  'Deprecated stub. Inventory on purchase final is handled by handle_purchase_final_stock_movement.';

CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deprecated: was INSERT ... stock_movements(type, balance_qty). Use
  -- handle_sale_final_stock_movement() via sale_final_stock_movement_trigger.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_stock_on_sale() IS
  'Deprecated stub. Inventory on sale final is handled by handle_sale_final_stock_movement.';

-- --- Canonical purchase final → stock_movements (copied from purchase_final_stock_movement_trigger.sql) ---
CREATE OR REPLACE FUNCTION public.handle_purchase_final_stock_movement()
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
  IF NEW.status IS DISTINCT FROM 'final' THEN
    RETURN NEW;
  END IF;

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
      'Purchase ' || COALESCE(NEW.po_no, NEW.id::TEXT) || ' – final',
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_purchase_final_stock_movement() IS 'Creates stock_movements (IN) when purchase.status is final. Idempotent.';

DROP TRIGGER IF EXISTS purchase_final_stock_movement_trigger ON public.purchases;
CREATE TRIGGER purchase_final_stock_movement_trigger
  AFTER INSERT OR UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION handle_purchase_final_stock_movement();

COMMENT ON TRIGGER purchase_final_stock_movement_trigger ON public.purchases IS 'On insert/update with status=final: insert stock_movements for each purchase_items line.';

-- --- Canonical sale final → stock_movements (copied from sale_final_stock_movement_trigger.sql) ---
CREATE OR REPLACE FUNCTION public.handle_sale_final_stock_movement()
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
  IF (NEW.status IS DISTINCT FROM 'final') OR (OLD.status = 'final') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM stock_movements
  WHERE reference_type = 'sale' AND reference_id = NEW.id
    AND LOWER(TRIM(movement_type)) = 'sale';
  IF v_count > 0 THEN
    RETURN NEW;
  END IF;

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

COMMENT ON FUNCTION public.handle_sale_final_stock_movement() IS 'Creates stock_movements (OUT) when sale.status becomes final. Idempotent.';

DROP TRIGGER IF EXISTS sale_final_stock_movement_trigger ON public.sales;
CREATE TRIGGER sale_final_stock_movement_trigger
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION handle_sale_final_stock_movement();

COMMENT ON TRIGGER sale_final_stock_movement_trigger ON public.sales IS 'On status→final: insert stock_movements for each sale line.';
