-- =============================================================================
-- Backfill missing opening-balance journal entries (idempotent)
-- Company: db1302ec-a8d7-4cff-81ad-3c8d7cb55509
--
-- Rules mirror app service openingBalanceJournalService:
--   opening_balance_contact_ar / _ap / opening_balance_contact_worker / opening_balance_account
--   Offset account: code 3000 (Owner Capital / Capital), else first equity account.
--
-- Run in Supabase SQL editor (or psql). Re-run safe: skips when active JE exists.
-- Audit: journal_entries.description, reference_type, reference_id.
-- =============================================================================

DO $$
DECLARE
  v_company CONSTANT uuid := 'db1302ec-a8d7-4cff-81ad-3c8d7cb55509';
  v_ar uuid;
  v_ap uuid;
  v_wp uuid;
  v_wa uuid;
  v_eq uuid;
  r RECORD;
  v_je uuid;
  v_amt numeric;
  v_ap_src numeric;
  acc_row RECORD;
  v_abal numeric;
BEGIN
  -- Self-heal: create missing control / offset accounts (no manual COA step required)
  -- Note: do not alias accounts as "a" here — PL/pgSQL record name must not shadow SQL aliases.
  INSERT INTO public.accounts (company_id, code, name, type, balance, is_active)
  SELECT v_company, ac.code, ac.name, ac.typ, 0, true
  FROM (
    VALUES
      ('3000', 'Owner Capital', 'equity'),
      ('1100', 'Accounts Receivable', 'asset'),
      ('2000', 'Accounts Payable', 'liability'),
      ('2010', 'Worker Payable', 'liability'),
      ('1180', 'Worker Advance', 'asset')
  ) AS ac(code, name, typ)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts ax
    WHERE ax.company_id = v_company AND trim(coalesce(ax.code, '')) = trim(ac.code)
  );

  SELECT id INTO v_ar FROM public.accounts WHERE company_id = v_company AND trim(code) = '1100' AND COALESCE(is_active, true) LIMIT 1;
  SELECT id INTO v_ap FROM public.accounts WHERE company_id = v_company AND trim(code) = '2000' AND COALESCE(is_active, true) LIMIT 1;
  SELECT id INTO v_wp FROM public.accounts WHERE company_id = v_company AND trim(code) = '2010' AND COALESCE(is_active, true) LIMIT 1;
  SELECT id INTO v_wa FROM public.accounts WHERE company_id = v_company AND trim(code) = '1180' AND COALESCE(is_active, true) LIMIT 1;
  SELECT id INTO v_eq FROM public.accounts WHERE company_id = v_company AND trim(code) = '3000' AND COALESCE(is_active, true) LIMIT 1;
  IF v_eq IS NULL THEN
    SELECT id INTO v_eq FROM public.accounts
    WHERE company_id = v_company AND lower(type::text) = 'equity' AND COALESCE(is_active, true)
    ORDER BY code NULLS LAST LIMIT 1;
  END IF;

  IF v_eq IS NULL THEN
    RAISE EXCEPTION 'Could not resolve equity account for company % after auto-seed', v_company;
  END IF;

  FOR r IN
    SELECT * FROM public.contacts
    WHERE company_id = v_company
      AND lower(type::text) IN ('customer', 'both')
      AND COALESCE(opening_balance, 0) <> 0
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.company_id = v_company
        AND je.reference_type = 'opening_balance_contact_ar'
        AND je.reference_id = r.id
        AND COALESCE(je.is_void, false) = false
    ) THEN
      CONTINUE;
    END IF;
    IF v_ar IS NULL THEN
      RAISE NOTICE 'Skip AR backfill — 1100 missing for contact %', r.id;
      CONTINUE;
    END IF;

    v_amt := round(COALESCE(r.opening_balance, 0)::numeric, 2);
    INSERT INTO public.journal_entries (
      company_id, branch_id, entry_date, description, reference_type, reference_id, is_void
    ) VALUES (
      v_company,
      r.branch_id,
      CURRENT_DATE,
      'Opening balance — customer AR — ' || COALESCE(r.name, r.id::text),
      'opening_balance_contact_ar',
      r.id,
      false
    ) RETURNING id INTO v_je;

    IF v_amt > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
        (v_je, v_ar, v_amt, 0, 'Opening balance — receivable'),
        (v_je, v_eq, 0, v_amt, 'Opening balance — offset (Owner Capital)');
    ELSE
      v_amt := abs(v_amt);
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
        (v_je, v_eq, v_amt, 0, 'Opening balance — offset (Owner Capital)'),
        (v_je, v_ar, 0, v_amt, 'Opening balance — receivable (credit)');
    END IF;
  END LOOP;

  -- supplier_opening_balance via JSON so older DBs without the column still work
  FOR r IN
    SELECT
      t.id,
      t.company_id,
      t.branch_id,
      t.type,
      t.name,
      t.opening_balance,
      NULLIF(trim(COALESCE(to_jsonb(t) ->> 'supplier_opening_balance', '')), '')::numeric AS supplier_opening_balance
    FROM public.contacts t
    WHERE t.company_id = v_company
      AND lower(t.type::text) IN ('supplier', 'both')
  LOOP
    IF lower(r.type::text) = 'supplier' THEN
      v_ap_src := CASE
        WHEN r.supplier_opening_balance IS NOT NULL THEN round(COALESCE(r.supplier_opening_balance, 0)::numeric, 2)
        ELSE round(COALESCE(r.opening_balance, 0)::numeric, 2)
      END;
    ELSE
      v_ap_src := round(COALESCE(r.supplier_opening_balance, 0)::numeric, 2);
    END IF;

    IF v_ap_src = 0 THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.company_id = v_company
        AND je.reference_type = 'opening_balance_contact_ap'
        AND je.reference_id = r.id
        AND COALESCE(je.is_void, false) = false
    ) THEN
      CONTINUE;
    END IF;
    IF v_ap IS NULL THEN
      RAISE NOTICE 'Skip AP backfill — 2000 missing for contact %', r.id;
      CONTINUE;
    END IF;

    INSERT INTO public.journal_entries (
      company_id, branch_id, entry_date, description, reference_type, reference_id, is_void
    ) VALUES (
      v_company,
      r.branch_id,
      CURRENT_DATE,
      'Opening balance — supplier AP — ' || COALESCE(r.name, r.id::text),
      'opening_balance_contact_ap',
      r.id,
      false
    ) RETURNING id INTO v_je;

    IF v_ap_src > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
        (v_je, v_eq, v_ap_src, 0, 'Opening balance — offset (Owner Capital)'),
        (v_je, v_ap, 0, v_ap_src, 'Opening balance — payable');
    ELSE
      v_amt := abs(v_ap_src);
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
        (v_je, v_ap, v_amt, 0, 'Opening balance — payable (debit)'),
        (v_je, v_eq, 0, v_amt, 'Opening balance — offset (Owner Capital)');
    END IF;
  END LOOP;

  FOR r IN
    SELECT * FROM public.contacts
    WHERE company_id = v_company
      AND lower(type::text) = 'worker'
      AND COALESCE(opening_balance, 0) <> 0
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.company_id = v_company
        AND je.reference_type = 'opening_balance_contact_worker'
        AND je.reference_id = r.id
        AND COALESCE(je.is_void, false) = false
    ) THEN
      CONTINUE;
    END IF;

    v_amt := round(COALESCE(r.opening_balance, 0)::numeric, 2);

    INSERT INTO public.journal_entries (
      company_id, branch_id, entry_date, description, reference_type, reference_id, is_void
    ) VALUES (
      v_company,
      r.branch_id,
      CURRENT_DATE,
      'Opening balance — worker — ' || COALESCE(r.name, r.id::text),
      'opening_balance_contact_worker',
      r.id,
      false
    ) RETURNING id INTO v_je;

    IF v_amt > 0 THEN
      IF v_wp IS NULL THEN
        RAISE NOTICE 'Skip worker payable backfill — 2010 missing for contact %', r.id;
        DELETE FROM public.journal_entries WHERE id = v_je;
        CONTINUE;
      END IF;
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
        (v_je, v_eq, v_amt, 0, 'Opening balance — offset (Owner Capital)'),
        (v_je, v_wp, 0, v_amt, 'Opening balance — worker payable');
    ELSE
      v_amt := abs(v_amt);
      IF v_wa IS NULL THEN
        RAISE NOTICE 'Skip worker advance backfill — 1180 missing for contact %', r.id;
        DELETE FROM public.journal_entries WHERE id = v_je;
        CONTINUE;
      END IF;
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
        (v_je, v_wa, v_amt, 0, 'Opening balance — worker advance'),
        (v_je, v_eq, 0, v_amt, 'Opening balance — offset (Owner Capital)');
    END IF;
  END LOOP;

  FOR acc_row IN
    SELECT *
    FROM public.accounts
    WHERE company_id = v_company
      AND COALESCE(is_active, true)
      AND COALESCE(balance, 0) <> 0
      AND lower(type::text) IN ('cash', 'bank', 'mobile_wallet')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.company_id = v_company
        AND je.reference_type = 'opening_balance_account'
        AND je.reference_id = acc_row.id
        AND COALESCE(je.is_void, false) = false
    ) THEN
      CONTINUE;
    END IF;

    v_abal := round(abs(COALESCE(acc_row.balance, 0))::numeric, 2);

    INSERT INTO public.journal_entries (
      company_id, branch_id, entry_date, description, reference_type, reference_id, is_void
    ) VALUES (
      v_company,
      NULL,
      CURRENT_DATE,
      'Opening balance — account ' || COALESCE(trim(acc_row.code), '') || ' — ' || COALESCE(acc_row.name, acc_row.id::text),
      'opening_balance_account',
      acc_row.id,
      false
    ) RETURNING id INTO v_je;

    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
      (v_je, acc_row.id, v_abal, 0, 'Opening balance — ' || COALESCE(acc_row.name, '')),
      (v_je, v_eq, 0, v_abal, 'Opening balance — offset (Owner Capital)');
  END LOOP;

  RAISE NOTICE 'Opening balance backfill finished for company %', v_company;
END $$;
