-- Stock adjustment GL: resolve cost from product when movement has zero cost; skip zero-amount JEs.
-- Aligns DB trigger with opening_balance_inventory / app stockMovementValuation fallback.

CREATE OR REPLACE FUNCTION public.post_stock_adjustment_to_accounting()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory_account_id UUID;
  v_adjustment_account_id UUID;
  v_journal_id UUID;
  v_amount DECIMAL(15,2);
  v_entry_no TEXT;
  v_notes TEXT;
  v_product_cost DECIMAL(15,2);
  v_abs_qty DECIMAL(15,4);
BEGIN
  IF NEW.movement_type IS DISTINCT FROM 'adjustment' THEN
    RETURN NEW;
  END IF;

  IF lower(trim(COALESCE(NEW.reference_type, ''))) = 'opening_balance' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.reference_type = 'stock_adjustment' AND je.reference_id = NEW.id
      AND COALESCE(je.is_void, false) = false
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NULLIF(NEW.total_cost, 0), ABS(NEW.quantity) * COALESCE(NEW.unit_cost, 0), 0);
  v_abs_qty := ABS(COALESCE(NEW.quantity, 0));

  IF v_amount = 0 AND v_abs_qty > 0 AND NEW.product_id IS NOT NULL THEN
    IF NEW.variation_id IS NOT NULL THEN
      SELECT COALESCE(pv.cost_price, pv.purchase_price, 0)
        INTO v_product_cost
      FROM public.product_variations pv
      WHERE pv.id = NEW.variation_id
      LIMIT 1;
    ELSE
      v_product_cost := 0;
    END IF;

    IF COALESCE(v_product_cost, 0) = 0 THEN
      SELECT COALESCE(p.cost_price, 0)
        INTO v_product_cost
      FROM public.products p
      WHERE p.id = NEW.product_id
      LIMIT 1;
    END IF;

    IF COALESCE(v_product_cost, 0) > 0 THEN
      v_amount := round((v_abs_qty * v_product_cost)::numeric, 2);
      UPDATE public.stock_movements
      SET unit_cost = v_product_cost,
          total_cost = v_amount
      WHERE id = NEW.id;
    END IF;
  END IF;

  IF COALESCE(v_amount, 0) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT a.id INTO v_inventory_account_id
  FROM public.accounts a
  WHERE a.company_id = NEW.company_id AND COALESCE(a.is_active, TRUE)
    AND (trim(COALESCE(a.code, '')) = '1200' OR lower(COALESCE(a.type, '')) = 'inventory')
  LIMIT 1;

  SELECT a.id INTO v_adjustment_account_id
  FROM public.accounts a
  WHERE a.company_id = NEW.company_id AND COALESCE(a.is_active, TRUE)
    AND (
      trim(COALESCE(a.code, '')) IN ('5000', '5100', '5110', '5120', '6000', '6100')
      OR lower(COALESCE(a.type, '')) IN ('expense', 'cost')
    )
  LIMIT 1;

  IF v_inventory_account_id IS NULL THEN
    RAISE WARNING 'post_stock_adjustment_to_accounting: No inventory account (1200) for company %. Skipping journal for movement %', NEW.company_id, NEW.id;
    RETURN NEW;
  END IF;

  IF v_adjustment_account_id IS NULL THEN
    RAISE WARNING 'post_stock_adjustment_to_accounting: No adjustment/expense account for company %. Skipping journal for movement %', NEW.company_id, NEW.id;
    RETURN NEW;
  END IF;

  v_notes := COALESCE(NEW.notes, 'Stock adjustment');
  v_entry_no := 'ADJ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);

  INSERT INTO public.journal_entries (
    company_id,
    branch_id,
    entry_no,
    entry_date,
    description,
    reference_type,
    reference_id,
    created_by
  ) VALUES (
    NEW.company_id,
    NEW.branch_id,
    v_entry_no,
    (NEW.created_at AT TIME ZONE 'UTC')::DATE,
    'Stock adjustment: ' || v_notes,
    'stock_adjustment',
    NEW.id,
    NEW.created_by
  ) RETURNING id INTO v_journal_id;

  IF COALESCE(NEW.quantity, 0) >= 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_inventory_account_id, v_amount, 0, 'Inventory increase - ' || v_notes);
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_adjustment_account_id, 0, v_amount, 'Stock adjustment - ' || v_notes);
  ELSE
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_adjustment_account_id, v_amount, 0, 'Stock adjustment - ' || v_notes);
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_inventory_account_id, 0, v_amount, 'Inventory decrease - ' || v_notes);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.post_stock_adjustment_to_accounting() IS
  'Posts stock_adjustment JEs for generic adjustments; skips opening_balance; product cost_price fallback when movement cost is zero; skips JE when amount remains zero.';
