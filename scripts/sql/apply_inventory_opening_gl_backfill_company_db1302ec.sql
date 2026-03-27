-- =============================================================================
-- APPLY: inventory opening → GL (idempotent) — company db1302ec-a8d7-4cff-81ad-3c8d7cb55509
--
-- For each opening_balance stock_movement with positive value:
--   1) Void active legacy stock_adjustment JEs tied to that movement id
--   2) Skip if a non-void opening_balance_inventory JE already exists (reference_id = movement.id)
--   3) Insert opening_balance_inventory JE: Dr 1200 (or type inventory) / Cr 3000
--
-- Re-run safe. Does not delete rows.
-- Prefer entry_date = movement UTC date; falls back to CURRENT_DATE.
-- =============================================================================

DO $$
DECLARE
  v_company CONSTANT uuid := 'db1302ec-a8d7-4cff-81ad-3c8d7cb55509';
  v_inv uuid;
  v_eq uuid;
  r RECORD;
  v_je uuid;
  v_amt numeric;
  v_entry_date date;
  v_entry_no text;
BEGIN
  INSERT INTO public.accounts (company_id, code, name, type, balance, is_active)
  SELECT v_company, ac.code, ac.name, ac.typ, 0, true
  FROM (
    VALUES
      ('1200', 'Inventory', 'inventory'),
      ('3000', 'Owner Capital', 'equity')
  ) AS ac(code, name, typ)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts ax
    WHERE ax.company_id = v_company AND trim(coalesce(ax.code, '')) = trim(ac.code)
  );

  SELECT id INTO v_inv FROM public.accounts
  WHERE company_id = v_company AND trim(code) = '1200' AND COALESCE(is_active, true) LIMIT 1;
  IF v_inv IS NULL THEN
    SELECT id INTO v_inv FROM public.accounts
    WHERE company_id = v_company AND lower(COALESCE(type::text, '')) = 'inventory' AND COALESCE(is_active, true)
    ORDER BY code NULLS LAST LIMIT 1;
  END IF;

  SELECT id INTO v_eq FROM public.accounts
  WHERE company_id = v_company AND trim(code) = '3000' AND COALESCE(is_active, true) LIMIT 1;
  IF v_eq IS NULL THEN
    SELECT id INTO v_eq FROM public.accounts
    WHERE company_id = v_company AND lower(type::text) = 'equity' AND COALESCE(is_active, true)
    ORDER BY code NULLS LAST LIMIT 1;
  END IF;

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Could not resolve inventory asset account (1200 or type inventory) for company %', v_company;
  END IF;
  IF v_eq IS NULL THEN
    RAISE EXCEPTION 'Could not resolve equity account (3000) for company %', v_company;
  END IF;

  FOR r IN
    SELECT m.*
    FROM public.stock_movements m
    WHERE m.company_id = v_company
      AND m.movement_type = 'adjustment'
      AND lower(trim(COALESCE(m.reference_type, ''))) = 'opening_balance'
  LOOP
    v_amt := round(
      COALESCE(NULLIF(r.total_cost, 0), r.quantity * COALESCE(r.unit_cost, 0), 0)::numeric,
      2
    );
    IF v_amt <= 0 THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.company_id = v_company
        AND je.reference_type = 'opening_balance_inventory'
        AND je.reference_id = r.id
        AND COALESCE(je.is_void, false) = false
    ) THEN
      CONTINUE;
    END IF;

    UPDATE public.journal_entries je
    SET is_void = true, updated_at = NOW()
    WHERE je.reference_type = 'stock_adjustment'
      AND je.reference_id = r.id
      AND COALESCE(je.is_void, false) = false;

    v_entry_date := COALESCE((r.created_at AT TIME ZONE 'UTC')::date, CURRENT_DATE);
    v_entry_no := 'INV-OB-' || SUBSTRING(REPLACE(r.id::text, '-', ''), 1, 12);

    INSERT INTO public.journal_entries (
      company_id,
      branch_id,
      entry_no,
      entry_date,
      description,
      reference_type,
      reference_id,
      is_void
    ) VALUES (
      v_company,
      r.branch_id,
      v_entry_no,
      v_entry_date,
      'Opening inventory (backfill) — stock movement ' || r.id::text,
      'opening_balance_inventory',
      r.id,
      false
    ) RETURNING id INTO v_je;

    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
      (v_je, v_inv, v_amt, 0, 'Opening inventory (asset)'),
      (v_je, v_eq, 0, v_amt, 'Opening inventory offset (Owner Capital)');
  END LOOP;

  RAISE NOTICE 'Inventory opening GL backfill finished for company %', v_company;
END $$;
