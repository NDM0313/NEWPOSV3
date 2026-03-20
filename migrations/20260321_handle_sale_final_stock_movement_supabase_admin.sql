-- Apply as database owner if 20260320 failed on CREATE OR REPLACE FUNCTION (owner supabase_admin).
-- On self-hosted Supabase: docker exec supabase-db psql -U supabase_admin -d postgres -f ...
--
-- Fixes INSERT-final path for canonical conversion (OLD is null on INSERT; prior body used OLD.status incorrectly).

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
  IF NEW.status IS DISTINCT FROM 'final' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'final' THEN
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

COMMENT ON FUNCTION public.handle_sale_final_stock_movement() IS 'Creates stock_movements (OUT) when sale becomes final (INSERT final or UPDATE to final). Idempotent.';

DROP TRIGGER IF EXISTS sale_final_stock_movement_trigger ON public.sales;
CREATE TRIGGER sale_final_stock_movement_trigger
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sale_final_stock_movement();

COMMENT ON TRIGGER sale_final_stock_movement_trigger ON public.sales IS 'On insert/update with status=final: stock OUT for each line.';
