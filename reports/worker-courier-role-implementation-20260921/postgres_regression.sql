-- Isolated PostgreSQL regression for worker/courier role-model account domain.
-- Run against a disposable DB / local clone — NEVER production.
-- Example:
--   docker exec -i <pg> psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     -f migrations/20260922120000_worker_courier_role_model_account_domain.sql
--   docker exec -i <pg> psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     -f reports/worker-courier-role-implementation-20260921/postgres_regression.sql

\set ON_ERROR_STOP on
\pset pager off

DO $$
DECLARE
  v_company UUID := gen_random_uuid();
  v_branch UUID := gen_random_uuid();
  v_worker UUID := gen_random_uuid();
  v_supplier UUID := gen_random_uuid();
  v_courier_a UUID := gen_random_uuid();
  v_courier_b UUID := gen_random_uuid();
  v_cash UUID;
  v_wa1 UUID;
  v_wa2 UUID;
  v_wp1 UUID;
  v_wp2 UUID;
  v_c1 UUID;
  v_c2 UUID;
  v_c1b UUID;
  v_c1c UUID;
  v_expense UUID;
  v_je UUID;
  v_bal NUMERIC;
  v_tb_diff NUMERIC;
  v_wrong UUID;
BEGIN
  -- Minimal company + controls
  INSERT INTO companies (id, name, currency)
  VALUES (v_company, 'ROLE-MODEL-ISO-TEST', 'PKR')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO accounts (company_id, code, name, type, is_active, balance)
  VALUES
    (v_company, '1010', 'Cash', 'asset', true, 0),
    (v_company, '1180', 'Worker Advance', 'asset', true, 0),
    (v_company, '2010', 'Worker Payable', 'liability', true, 0),
    (v_company, '2030', 'Courier Payable (Control)', 'liability', true, 0),
    (v_company, '2000', 'Accounts Payable', 'liability', true, 0),
    (v_company, '5000', 'Operating Expense', 'expense', true, 0)
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO v_cash FROM accounts WHERE company_id = v_company AND code = '1010';
  SELECT id INTO v_expense FROM accounts WHERE company_id = v_company AND code = '5000';

  INSERT INTO contacts (id, company_id, name, type, code)
  VALUES
    (v_worker, v_company, 'ISO Worker', 'worker', 'WRK-ISO-001'),
    (v_supplier, v_company, 'ISO Supplier', 'supplier', 'SUP-ISO-001'),
    (v_courier_a, v_company, 'ISO Courier Local', 'courier', 'COU-ISO-A'),
    (v_courier_b, v_company, 'ISO Courier Other', 'courier', 'COU-ISO-B');

  -- WA ensure: create + idempotent
  v_wa1 := public._ensure_worker_advance_subaccount(v_company, v_worker);
  v_wa2 := public._ensure_worker_advance_subaccount(v_company, v_worker);
  IF v_wa1 IS DISTINCT FROM v_wa2 THEN
    RAISE EXCEPTION 'WA idempotency failed: % vs %', v_wa1, v_wa2;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = v_wa1 AND code LIKE 'WA-%' AND linked_contact_id = v_worker
      AND parent_id = (SELECT id FROM accounts WHERE company_id = v_company AND code = '1180')
  ) THEN
    RAISE EXCEPTION 'WA leaf shape invalid';
  END IF;

  -- WP ensure
  v_wp1 := public._ensure_worker_payable_subaccount(v_company, v_worker);
  v_wp2 := public._ensure_worker_payable_subaccount(v_company, v_worker);
  IF v_wp1 IS DISTINCT FROM v_wp2 THEN
    RAISE EXCEPTION 'WP idempotency failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM accounts WHERE id = v_wp1 AND code LIKE 'WP-%' AND linked_contact_id = v_worker
  ) THEN
    RAISE EXCEPTION 'WP leaf shape invalid';
  END IF;

  -- Non-worker must not create WA leaf (returns control)
  v_wrong := public._ensure_worker_advance_subaccount(v_company, v_supplier);
  IF EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company AND code LIKE 'WA-%' AND linked_contact_id = v_supplier) THEN
    RAISE EXCEPTION 'WA leaf wrongly created for supplier';
  END IF;
  IF v_wrong IS DISTINCT FROM (SELECT id FROM accounts WHERE company_id = v_company AND code = '1180') THEN
    RAISE EXCEPTION 'Supplier WA ensure should return 1180 control';
  END IF;

  -- Wrong company raises
  BEGIN
    PERFORM public._ensure_worker_advance_subaccount(gen_random_uuid(), v_worker);
    RAISE EXCEPTION 'expected WORKER_ADVANCE_WRONG_COMPANY';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- Courier ensure + linked_contact_id parity + DHL-local != DHL-PK style distinction
  v_c1 := public.get_or_create_courier_payable_account(v_company, v_courier_a, 'ISO Courier Local');
  v_c1b := public.get_or_create_courier_payable_account(v_company, v_courier_a, 'ISO Courier Local');
  v_c2 := public.get_or_create_courier_payable_account(v_company, v_courier_b, 'ISO Courier Other');
  IF v_c1 IS DISTINCT FROM v_c1b THEN
    RAISE EXCEPTION 'Courier ensure not idempotent';
  END IF;
  IF v_c1 = v_c2 THEN
    RAISE EXCEPTION 'Distinct courier contacts must not share leaf';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = v_c1 AND linked_contact_id = v_courier_a AND contact_id = v_courier_a
      AND code ~ '^203[0-9]+$' AND code <> '2030'
  ) THEN
    RAISE EXCEPTION 'Courier leaf missing linked_contact_id parity';
  END IF;
  -- Second ensure must not create extra leaf for same contact
  IF (
    SELECT count(*) FROM accounts
    WHERE company_id = v_company AND linked_contact_id = v_courier_a AND code ~ '^203[0-9]+$' AND code <> '2030'
  ) <> 1 THEN
    RAISE EXCEPTION 'Extra courier leaves created';
  END IF;

  -- Supplier AP still works (control path OK if ensure AP exists)
  IF public._ensure_ap_subaccount_for_contact(v_company, v_supplier) IS NULL THEN
    RAISE EXCEPTION 'Supplier AP ensure returned null';
  END IF;
  IF EXISTS (
    SELECT 1 FROM accounts WHERE company_id = v_company AND linked_contact_id = v_supplier AND code LIKE 'WA-%'
  ) THEN
    RAISE EXCEPTION 'Supplier regression: WA leaf created';
  END IF;

  -- Worker lifecycle: advance → bill → apply → payment
  -- A) Dr WA Cr Cash 1000
  INSERT INTO journal_entries (id, company_id, entry_no, entry_date, description, reference_type, reference_id, is_void)
  VALUES (gen_random_uuid(), v_company, 'JE-ISO-ADV', CURRENT_DATE, 'worker advance', 'worker_payment', v_worker, false)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_je, v_wa1, 1000, 0, 'advance'),
    (v_je, v_cash, 0, 1000, 'cash');

  -- B) Dr Expense Cr WP 800
  INSERT INTO journal_entries (id, company_id, entry_no, entry_date, description, reference_type, reference_id, is_void)
  VALUES (gen_random_uuid(), v_company, 'JE-ISO-BILL', CURRENT_DATE, 'work bill', 'studio_production_stage', gen_random_uuid(), false)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_je, v_expense, 800, 0, 'bill'),
    (v_je, v_wp1, 0, 800, 'wp');

  -- C) Apply advance Dr WP Cr WA 800
  INSERT INTO journal_entries (id, company_id, entry_no, entry_date, description, reference_type, reference_id, is_void)
  VALUES (gen_random_uuid(), v_company, 'JE-ISO-APPLY', CURRENT_DATE, 'apply advance', 'worker_advance_settlement', v_worker, false)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_je, v_wp1, 800, 0, 'reduce wp'),
    (v_je, v_wa1, 0, 800, 'clear wa');

  -- Excess advance remains on WA: 200
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_bal
  FROM journal_entry_lines jel WHERE jel.account_id = v_wa1;
  IF round(v_bal, 2) <> 200 THEN
    RAISE EXCEPTION 'WA residual expected 200 got %', v_bal;
  END IF;

  SELECT COALESCE(SUM(jel.credit - jel.debit), 0) INTO v_bal
  FROM journal_entry_lines jel WHERE jel.account_id = v_wp1;
  IF round(v_bal, 2) <> 0 THEN
    RAISE EXCEPTION 'WP residual expected 0 got %', v_bal;
  END IF;

  -- Courier lifecycle: deposit → charge (no AP-SUP)
  INSERT INTO journal_entries (id, company_id, entry_no, entry_date, description, reference_type, reference_id, is_void)
  VALUES (gen_random_uuid(), v_company, 'JE-ISO-CDEP', CURRENT_DATE, 'courier deposit', 'deposit', v_courier_a, false)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_je, v_c1, 500, 0, 'deposit'),
    (v_je, v_cash, 0, 500, 'cash');

  INSERT INTO journal_entries (id, company_id, entry_no, entry_date, description, reference_type, reference_id, is_void)
  VALUES (gen_random_uuid(), v_company, 'JE-ISO-CCHG', CURRENT_DATE, 'courier charge', 'shipment', gen_random_uuid(), false)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_je, v_expense, 200, 0, 'ship exp'),
    (v_je, v_c1, 0, 200, 'courier');

  IF EXISTS (
    SELECT 1 FROM accounts
    WHERE company_id = v_company AND linked_contact_id IN (v_courier_a, v_courier_b) AND code LIKE 'AP-%'
  ) THEN
    RAISE EXCEPTION 'Courier lifecycle accidentally created AP-SUP';
  END IF;

  SELECT round(SUM(jel.debit) - SUM(jel.credit), 2) INTO v_tb_diff
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company AND coalesce(je.is_void, false) = false;
  IF v_tb_diff <> 0 THEN
    RAISE EXCEPTION 'Company TB imbalance %', v_tb_diff;
  END IF;

  RAISE NOTICE 'ROLE_MODEL_POSTGRES_REGRESSION_PASS company=% wa=% wp=% courier_a=% courier_b=%',
    v_company, v_wa1, v_wp1, v_c1, v_c2;
END $$;
