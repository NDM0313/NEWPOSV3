-- Canonical conversion workflow: draft/quotation/order (sales) and draft/ordered (purchases)
-- become NEW final documents; sources are soft-archived (converted=true) and hidden from default lists.

-- ---------------------------------------------------------------------------
-- sales: conversion audit columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS converted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS converted_to_document_id uuid NULL;

COMMENT ON COLUMN public.sales.converted IS 'True when this row was superseded by a new final sale (source kept for audit).';
COMMENT ON COLUMN public.sales.converted_to_document_id IS 'FK to the new final sales.id that replaced this document.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_converted_to_document_id_fkey'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_converted_to_document_id_fkey
      FOREIGN KEY (converted_to_document_id) REFERENCES public.sales(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_company_converted ON public.sales (company_id, converted) WHERE converted = true;

-- ---------------------------------------------------------------------------
-- purchases: conversion audit columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS converted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS converted_to_document_id uuid NULL;

COMMENT ON COLUMN public.purchases.converted IS 'True when this row was superseded by a new final purchase (source kept for audit).';
COMMENT ON COLUMN public.purchases.converted_to_document_id IS 'FK to the new final purchases.id that replaced this document.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_converted_to_document_id_fkey'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_converted_to_document_id_fkey
      FOREIGN KEY (converted_to_document_id) REFERENCES public.purchases(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_company_converted ON public.purchases (company_id, converted) WHERE converted = true;

-- ---------------------------------------------------------------------------
-- Sale stock trigger: also run on INSERT when status = final (new final row from conversion)
-- ---------------------------------------------------------------------------
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

  -- On UPDATE: skip if already was final (idempotent / no duplicate movements)
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
