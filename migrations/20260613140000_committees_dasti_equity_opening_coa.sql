-- =============================================================================
-- Additive COA + opening balances — single company (idempotent, forward-only)
-- Company: 597a5292-14c8-4cd8-96bd-c61b5a0d8c92
--
-- Creates equity 3003/3005, asset group 1170 + 14 committee/dasti ledgers (1171–1187,
-- skips 1180 Worker Advance), and opening_balance_account JEs offset to 3000 only.
--
-- Safety: INSERT accounts ON CONFLICT (company_id, code) DO NOTHING — no UPDATE on
-- existing accounts, contacts, or journal entries. accounts.balance stays 0.
-- Re-run safe: skips active opening_balance_account JE per account.
--
-- Apply: Supabase SQL editor or psql against production Postgres for this company.
-- =============================================================================

DO $$
DECLARE
  v_company CONSTANT uuid := '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
  v_offset uuid;
  v_equity_parent uuid;
  v_committee_parent uuid;
  v_entry_date date;
  r RECORD;
  v_acct uuid;
  v_je uuid;
  v_amt numeric;
  v_parent uuid;
  v_accounts_inserted int := 0;
  v_jes_posted int := 0;
  v_jes_skipped int := 0;
  v_name_mismatch int := 0;
  v_existing_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = v_company) THEN
    RAISE EXCEPTION 'Company % not found — aborting additive COA migration', v_company;
  END IF;

  SELECT COALESCE(c.financial_year_start, '2026-01-01'::date)
  INTO v_entry_date
  FROM public.companies c
  WHERE c.id = v_company;

  -- Offset: Owner Capital 3000 (seed only if missing)
  INSERT INTO public.accounts (company_id, code, name, type, balance, is_active, is_group)
  VALUES (v_company, '3000', 'Owner Capital', 'equity', 0, true, false)
  ON CONFLICT (company_id, code) DO NOTHING
  RETURNING id INTO v_acct;
  IF v_acct IS NOT NULL THEN
    v_accounts_inserted := v_accounts_inserted + 1;
  END IF;

  SELECT a.id INTO v_offset
  FROM public.accounts a
  WHERE a.company_id = v_company
    AND trim(coalesce(a.code, '')) = '3000'
    AND coalesce(a.is_active, true)
  LIMIT 1;

  IF v_offset IS NULL THEN
    RAISE EXCEPTION 'Could not resolve Owner Capital (3000) for company %', v_company;
  END IF;

  SELECT a.id INTO v_equity_parent
  FROM public.accounts a
  WHERE a.company_id = v_company
    AND trim(coalesce(a.code, '')) = '3090'
  LIMIT 1;

  -- ---------------------------------------------------------------------------
  -- Account seeds: (code, name, type, parent_code, is_group, opening_side, amount)
  -- opening_side: debit | credit | NULL (group / no JE)
  -- ---------------------------------------------------------------------------
  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('1170', 'Committees & Dasti Accounts', 'asset', NULL::text, true, NULL::text, 0::numeric),
        ('1171', 'Noor Khan Committee', 'asset', '1170', false, 'credit', 1800000::numeric),
        ('1172', 'M. Ullah Committee', 'asset', '1170', false, 'debit', 500000::numeric),
        ('1173', 'SKT Committee', 'asset', '1170', false, 'debit', 3000000::numeric),
        ('1174', 'Wali WK Dasti', 'asset', '1170', false, 'debit', 2000000::numeric),
        ('1175', 'NSR Dasti', 'asset', '1170', false, 'debit', 450000::numeric),
        ('1176', 'Jilani Dasti', 'asset', '1170', false, 'debit', 381000::numeric),
        ('1177', 'Laiq Shah Dasti', 'asset', '1170', false, 'debit', 326000::numeric),
        ('1181', 'Shahzaman Dasti', 'asset', '1170', false, 'debit', 306000::numeric),
        ('1182', 'Mushtaq Dasti', 'asset', '1170', false, 'debit', 300000::numeric),
        ('1183', 'Javed Carier Dasti', 'asset', '1170', false, 'debit', 190000::numeric),
        ('1184', 'Qadeem Dasti', 'asset', '1170', false, 'debit', 160000::numeric),
        ('1185', 'Telawat Shah Dasti', 'asset', '1170', false, 'debit', 150000::numeric),
        ('1186', 'Qadar Dasti', 'asset', '1170', false, 'debit', 122000::numeric),
        ('1187', 'Irshad Dasti', 'asset', '1170', false, 'credit', 85000::numeric),
        ('3003', 'HOME EXPENSES', 'equity', '3090', false, 'debit', 234696::numeric),
        ('3005', 'Saeed Ajmal Capital', 'equity', '3090', false, 'credit', 1000000::numeric)
    ) AS seed(code, name, typ, parent_code, is_group, opening_side, opening_amount)
    ORDER BY
      CASE WHEN seed.code = '1170' THEN 0
           WHEN seed.parent_code = '1170' THEN 1
           ELSE 2 END,
      seed.code
  LOOP
    v_parent := NULL;
    IF r.parent_code IS NOT NULL THEN
      IF r.parent_code = '1170' THEN
        SELECT a.id INTO v_parent
        FROM public.accounts a
        WHERE a.company_id = v_company AND trim(coalesce(a.code, '')) = '1170'
        LIMIT 1;
      ELSIF r.parent_code = '3090' THEN
        v_parent := v_equity_parent;
      END IF;
    END IF;

    v_acct := NULL;
    INSERT INTO public.accounts (
      company_id, code, name, type, balance, is_active, is_group, parent_id
    )
    VALUES (
      v_company,
      r.code,
      r.name,
      r.typ,
      0,
      true,
      r.is_group,
      v_parent
    )
    ON CONFLICT (company_id, code) DO NOTHING
    RETURNING id INTO v_acct;

    IF v_acct IS NOT NULL THEN
      v_accounts_inserted := v_accounts_inserted + 1;
    ELSE
      SELECT a.id, a.name INTO v_acct, v_existing_name
      FROM public.accounts a
      WHERE a.company_id = v_company
        AND trim(coalesce(a.code, '')) = trim(r.code)
      LIMIT 1;

      IF v_acct IS NOT NULL
         AND trim(coalesce(v_existing_name, '')) <> trim(r.name) THEN
        v_name_mismatch := v_name_mismatch + 1;
        RAISE NOTICE 'Account % exists with different name — not renaming (id %)', r.code, v_acct;
      END IF;
    END IF;

    IF r.is_group OR coalesce(r.opening_amount, 0) <= 0 OR r.opening_side IS NULL THEN
      CONTINUE;
    END IF;

    IF v_acct IS NULL THEN
      RAISE NOTICE 'Skip opening JE — account % not found after insert', r.code;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.journal_entries je
      WHERE je.company_id = v_company
        AND je.reference_type = 'opening_balance_account'
        AND je.reference_id = v_acct
        AND coalesce(je.is_void, false) = false
    ) THEN
      v_jes_skipped := v_jes_skipped + 1;
      CONTINUE;
    END IF;

    v_amt := round(r.opening_amount::numeric, 2);

    INSERT INTO public.journal_entries (
      company_id, branch_id, entry_date, description, reference_type, reference_id, is_void
    )
    VALUES (
      v_company,
      NULL,
      v_entry_date,
      'Opening balance — account ' || r.code || ' — ' || r.name,
      'opening_balance_account',
      v_acct,
      false
    )
    RETURNING id INTO v_je;

    IF lower(trim(r.opening_side)) = 'debit' THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_je, v_acct, v_amt, 0, 'Opening balance — ' || r.name),
        (v_je, v_offset, 0, v_amt, 'Opening balance — offset (Owner Capital)');
    ELSIF lower(trim(r.opening_side)) = 'credit' THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_je, v_offset, v_amt, 0, 'Opening balance — offset (Owner Capital)'),
        (v_je, v_acct, 0, v_amt, 'Opening balance — ' || r.name);
    ELSE
      DELETE FROM public.journal_entries WHERE id = v_je;
      RAISE NOTICE 'Skip opening JE — unknown opening_side % for account %', r.opening_side, r.code;
      CONTINUE;
    END IF;

    v_jes_posted := v_jes_posted + 1;
  END LOOP;

  SELECT a.id INTO v_committee_parent
  FROM public.accounts a
  WHERE a.company_id = v_company AND trim(coalesce(a.code, '')) = '1170'
  LIMIT 1;

  RAISE NOTICE
    'committees_dasti_equity_opening_coa company=% entry_date=% accounts_inserted=% jes_posted=% jes_skipped=% name_mismatches=% committee_parent=% offset=%',
    v_company,
    v_entry_date,
    v_accounts_inserted,
    v_jes_posted,
    v_jes_skipped,
    v_name_mismatch,
    v_committee_parent,
    v_offset;
END $$;

-- =============================================================================
-- VERIFICATION (run manually after apply; expected on first run)
-- =============================================================================
-- New leaf accounts: 16 rows (3003, 3005, 1171–1187; group 1170 = 17 account rows total)
-- Active opening_balance_account JEs: 16 (one per leaf; none on 1170)
-- No UPDATE paths in this migration — re-run should show jes_posted=0, jes_skipped=16
--
-- SELECT code, name, type, parent_id, is_group
-- FROM accounts
-- WHERE company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
--   AND (code IN ('3003','3005','1170') OR code BETWEEN '1171' AND '1187')
-- ORDER BY code;
--
-- SELECT a.code, je.reference_type,
--        SUM(jel.debit) AS dr, SUM(jel.credit) AS cr
-- FROM accounts a
-- JOIN journal_entries je
--   ON je.reference_id = a.id
--  AND je.reference_type = 'opening_balance_account'
--  AND COALESCE(je.is_void, false) = false
-- JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
-- WHERE a.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
--   AND (a.code IN ('3003','3005') OR a.code BETWEEN '1171' AND '1187')
-- GROUP BY a.code, je.reference_type
-- ORDER BY a.code;
--
-- Idempotency check (second run NOTICE): accounts_inserted=0, jes_posted=0, jes_skipped=16
