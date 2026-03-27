-- Inventory opening: stock_movements with reference_type = opening_balance must NOT get
-- trigger-based stock_adjustment JEs (Dr Inventory / Cr expense). Canonical posting is
-- opening_balance_inventory via app / openingBalanceJournalService (Dr Inventory / Cr equity).

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
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NULLIF(NEW.total_cost, 0), NEW.quantity * COALESCE(NEW.unit_cost, 0), 0);

  SELECT a.id INTO v_inventory_account_id
  FROM public.accounts a
  WHERE a.company_id = NEW.company_id AND COALESCE(a.is_active, TRUE)
    AND (trim(COALESCE(a.code, '')) = '1200' OR lower(COALESCE(a.type, '')) = 'inventory')
  LIMIT 1;

  SELECT a.id INTO v_adjustment_account_id
  FROM public.accounts a
  WHERE a.company_id = NEW.company_id AND COALESCE(a.is_active, TRUE)
    AND (
      trim(COALESCE(a.code, '')) IN ('5100', '5110', '5120', '6000', '6100')
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

  IF v_amount >= 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_inventory_account_id, v_amount, 0, 'Inventory increase - ' || v_notes);
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_adjustment_account_id, 0, v_amount, 'Stock adjustment - ' || v_notes);
  ELSE
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_adjustment_account_id, (-v_amount), 0, 'Stock adjustment - ' || v_notes);
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_inventory_account_id, 0, (-v_amount), 'Inventory decrease - ' || v_notes);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.post_stock_adjustment_to_accounting() IS
  'Posts stock_adjustment JEs for generic adjustments only; skips reference_type opening_balance (canonical: opening_balance_inventory).';
