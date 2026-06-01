-- Section A from migrations/20260602120000 — defer bespoke lines at sale Final
SET search_path = public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_sale_final_stock_movement'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.handle_sale_final_stock_movement() OWNER TO supabase_admin';
  END IF;
END $$;

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
  v_has_bespoke_parent_col BOOLEAN;
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

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_items' AND column_name = 'bespoke_parent_item_id'
  ) INTO v_has_bespoke_parent_col;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items') THEN
    FOR v_item IN
      SELECT
        si.product_id,
        si.variation_id,
        si.quantity,
        si.unit_price,
        si.customization_details
      FROM sales_items si
      INNER JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = NEW.id
        AND (si.quantity IS NULL OR si.quantity > 0)
        AND COALESCE(p.track_stock, true) = true
        AND trim(COALESCE(p.sku, '')) NOT ILIKE 'CUSTOM-%'
        AND (
          NOT v_has_bespoke_parent_col
          OR si.bespoke_parent_item_id IS NULL
        )
        AND (
          si.customization_details IS NULL
          OR si.customization_details->'fabric_materials' IS NULL
          OR jsonb_typeof(si.customization_details->'fabric_materials') <> 'array'
          OR jsonb_array_length(si.customization_details->'fabric_materials') = 0
        )
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

COMMENT ON FUNCTION public.handle_sale_final_stock_movement() IS
  'Stock OUT on sale final. Skips bespoke generic SKUs, fabric children, track_stock=false, legacy fabric_materials JSON.';
