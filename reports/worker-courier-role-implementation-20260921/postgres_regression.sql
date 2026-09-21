-- Isolated PostgreSQL regression for worker/courier role-model account domain.
-- Applies against the ACTUAL migration functions (not approximations).
-- Run via: reports/worker-courier-role-implementation-20260922/verification/run_isolated_pg.sh
-- NEVER production.

\set ON_ERROR_STOP on
\pset pager off

DO $$
BEGIN
  EXECUTE 'GRANT authenticated TO CURRENT_USER';
  EXECUTE 'GRANT anon TO CURRENT_USER';
  EXECUTE 'GRANT service_role TO CURRENT_USER';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- =============================================================================
-- A) ACL matrix
-- =============================================================================
DO $$
DECLARE
  r record;
  v_fail int := 0;
BEGIN
  RAISE NOTICE '=== ACL MATRIX ===';
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           p.prosecdef,
           pg_get_userbyid(p.proowner) AS owner,
           COALESCE(p.proacl::text, '') AS proacl,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec,
           has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        '_ensure_worker_advance_subaccount',
        '_ensure_worker_payable_subaccount',
        'get_or_create_courier_payable_account',
        '_resolve_worker_payment_debit_account',
        'get_contact_party_gl_balances',
        '_party_role_account_assert_company_access',
        '_party_role_account_effective_role'
      )
    ORDER BY p.proname, 2
  LOOP
    RAISE NOTICE 'ACL %(%): prosecdef=% owner=% anon=% auth=% svc=% public=% proacl=%',
      r.proname, r.args, r.prosecdef, r.owner,
      r.anon_exec, r.auth_exec, r.svc_exec, r.public_exec, r.proacl;

    IF r.proname IN (
      '_ensure_worker_advance_subaccount',
      '_ensure_worker_payable_subaccount',
      'get_or_create_courier_payable_account',
      '_resolve_worker_payment_debit_account',
      'get_contact_party_gl_balances'
    ) THEN
      IF NOT r.prosecdef THEN
        RAISE NOTICE 'FAIL ACL: % must be SECURITY DEFINER', r.proname;
        v_fail := v_fail + 1;
      END IF;
      IF r.anon_exec OR r.public_exec THEN
        RAISE NOTICE 'FAIL ACL: % must deny anon/PUBLIC execute', r.proname;
        v_fail := v_fail + 1;
      END IF;
      IF NOT r.auth_exec OR NOT r.svc_exec THEN
        RAISE NOTICE 'FAIL ACL: % must grant authenticated+service_role', r.proname;
        v_fail := v_fail + 1;
      END IF;
    END IF;

    IF r.proname IN (
      '_party_role_account_assert_company_access',
      '_party_role_account_effective_role'
    ) THEN
      IF r.anon_exec OR r.auth_exec OR r.svc_exec OR r.public_exec THEN
        RAISE NOTICE 'FAIL ACL: helper % must revoke client roles', r.proname;
        v_fail := v_fail + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_fail > 0 THEN
    RAISE EXCEPTION 'ACL_MATRIX_FAILED count=%', v_fail;
  END IF;
  RAISE NOTICE 'PASS: ACL_MATRIX';
END $$;

-- =============================================================================
-- B) Fixtures + privileged (postgres/service) happy path
-- =============================================================================
DO $$
DECLARE
  v_co_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_co_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_worker_a UUID := '11111111-1111-1111-1111-111111111111';
  v_worker_b UUID := '22222222-2222-2222-2222-222222222222';
  v_supplier_a UUID := '33333333-3333-3333-3333-333333333333';
  v_courier_a UUID := '44444444-4444-4444-4444-444444444444';
  v_courier_b UUID := '55555555-5555-5555-5555-555555555555';
  v_dhl UUID := '66666666-6666-6666-6666-666666666666';
  v_wa1 UUID;
  v_wa2 UUID;
  v_wp1 UUID;
  v_wp2 UUID;
  v_c1 UUID;
  v_c1b UUID;
  v_dhl_acct UUID;
  v_dhl_resolve UUID;
  v_ap UUID;
  v_id UUID;
BEGIN
  INSERT INTO companies (id, name, currency) VALUES
    (v_co_a, 'ROLE-MODEL-CO-A', 'PKR'),
    (v_co_b, 'ROLE-MODEL-CO-B', 'PKR')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO accounts (company_id, code, name, type, is_active, balance)
  VALUES
    (v_co_a, '1010', 'Cash', 'asset', true, 0),
    (v_co_a, '1180', 'Worker Advance', 'asset', true, 0),
    (v_co_a, '2010', 'Worker Payable', 'liability', true, 0),
    (v_co_a, '2030', 'Courier Payable (Control)', 'liability', true, 0),
    (v_co_a, '2000', 'Accounts Payable', 'liability', true, 0),
    (v_co_a, '5000', 'Operating Expense', 'expense', true, 0),
    (v_co_b, '1010', 'Cash', 'asset', true, 0),
    (v_co_b, '1180', 'Worker Advance', 'asset', true, 0),
    (v_co_b, '2010', 'Worker Payable', 'liability', true, 0),
    (v_co_b, '2030', 'Courier Payable (Control)', 'liability', true, 0),
    (v_co_b, '2000', 'Accounts Payable', 'liability', true, 0),
    (v_co_b, '5000', 'Operating Expense', 'expense', true, 0)
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO contacts (id, company_id, name, type, code) VALUES
    (v_worker_a, v_co_a, 'Worker A', 'worker', 'WRK-A'),
    (v_worker_b, v_co_b, 'Worker B', 'worker', 'WRK-B'),
    (v_supplier_a, v_co_a, 'Supplier A', 'supplier', 'SUP-A'),
    (v_courier_a, v_co_a, 'Courier A Local', 'courier', 'COU-A'),
    (v_courier_b, v_co_b, 'Courier B', 'courier', 'COU-B'),
    (v_dhl, v_co_a, 'DHL Pakistan', 'courier', 'DHL-PK')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO accounts (
    company_id, code, name, type, is_active, balance, parent_id, contact_id, linked_contact_id
  )
  SELECT v_co_a, '2031', 'DHL Pakistan Payable', 'liability', true, 0,
         a.id, v_dhl, v_dhl
  FROM accounts a
  WHERE a.company_id = v_co_a AND a.code = '2030'
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO v_dhl_acct FROM accounts WHERE company_id = v_co_a AND code = '2031';

  -- postgres session_user is authorized (privileged backend path)
  v_wa1 := public._ensure_worker_advance_subaccount(v_co_a, v_worker_a);
  v_wa2 := public._ensure_worker_advance_subaccount(v_co_a, v_worker_a);
  IF v_wa1 IS DISTINCT FROM v_wa2 THEN
    RAISE EXCEPTION 'WA idempotency failed: % vs %', v_wa1, v_wa2;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = v_wa1 AND code LIKE 'WA-%' AND linked_contact_id = v_worker_a
  ) THEN
    RAISE EXCEPTION 'WA leaf shape invalid';
  END IF;
  RAISE NOTICE 'PASS: WA ensure+idempotent id=%', v_wa1;

  v_wp1 := public._ensure_worker_payable_subaccount(v_co_a, v_worker_a);
  v_wp2 := public._ensure_worker_payable_subaccount(v_co_a, v_worker_a);
  IF v_wp1 IS DISTINCT FROM v_wp2 THEN
    RAISE EXCEPTION 'WP idempotency failed';
  END IF;
  RAISE NOTICE 'PASS: WP ensure+idempotent id=%', v_wp1;

  v_c1 := public.get_or_create_courier_payable_account(v_co_a, v_courier_a, 'Courier A Local');
  v_c1b := public.get_or_create_courier_payable_account(v_co_a, v_courier_a, 'Courier A Local');
  IF v_c1 IS DISTINCT FROM v_c1b THEN
    RAISE EXCEPTION 'Courier idempotency failed';
  END IF;
  RAISE NOTICE 'PASS: courier ensure+idempotent id=%', v_c1;

  v_dhl_resolve := public.get_or_create_courier_payable_account(v_co_a, v_dhl, 'DHL Pakistan');
  IF v_dhl_resolve IS DISTINCT FROM v_dhl_acct THEN
    RAISE EXCEPTION 'DHL PK resolve mismatch: got % expected %', v_dhl_resolve, v_dhl_acct;
  END IF;
  IF (SELECT count(*) FROM accounts WHERE company_id = v_co_a AND linked_contact_id = v_dhl) <> 1 THEN
    RAISE EXCEPTION 'DHL duplicate leaf created';
  END IF;
  RAISE NOTICE 'PASS: DHL PK distinct resolve id=%', v_dhl_resolve;

  PERFORM public.get_or_create_courier_payable_account(v_co_b, v_courier_b, 'Courier B');

  BEGIN
    PERFORM public._ensure_worker_advance_subaccount(v_co_a, v_supplier_a);
    RAISE EXCEPTION 'FAIL: supplier WA should raise';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'WORKER_ADVANCE_ROLE_REQUIRED%' THEN
      RAISE EXCEPTION 'Unexpected WA role err: %', SQLERRM;
    END IF;
    RAISE NOTICE 'PASS: supplier WA fail-loud';
  END;

  BEGIN
    PERFORM public._ensure_worker_payable_subaccount(v_co_a, v_supplier_a);
    RAISE EXCEPTION 'FAIL: supplier WP should raise';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'WORKER_PAYABLE_ROLE_REQUIRED%' THEN
      RAISE EXCEPTION 'Unexpected WP role err: %', SQLERRM;
    END IF;
    RAISE NOTICE 'PASS: supplier WP fail-loud';
  END;

  BEGIN
    PERFORM public.get_or_create_courier_payable_account(v_co_a, NULL, 'Attack Courier');
    RAISE EXCEPTION 'FAIL: null contact courier should raise';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'COURIER_ACCOUNT_CONTACT_REQUIRED%' THEN
      RAISE EXCEPTION 'Unexpected null-contact err: %', SQLERRM;
    END IF;
    RAISE NOTICE 'PASS: null-contact courier blocked';
  END;

  BEGIN
    PERFORM public.get_or_create_courier_payable_account(v_co_a, v_supplier_a, 'Supplier as Courier');
    RAISE EXCEPTION 'FAIL: supplier courier create should raise';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'COURIER_ACCOUNT_ROLE_REQUIRED%' THEN
      RAISE EXCEPTION 'Unexpected courier role err: %', SQLERRM;
    END IF;
    RAISE NOTICE 'PASS: supplier courier role gate';
  END;

  v_ap := public._ensure_ap_subaccount_for_contact(v_co_a, v_supplier_a);
  IF v_ap IS NULL OR NOT EXISTS (
    SELECT 1 FROM accounts WHERE id = v_ap AND code LIKE 'AP-%' AND linked_contact_id = v_supplier_a
  ) THEN
    RAISE EXCEPTION 'Supplier AP leaf missing';
  END IF;
  RAISE NOTICE 'PASS: ordinary supplier AP leaf id=%', v_ap;

  IF public._resolve_worker_payment_debit_account(v_co_a, v_worker_a, false) IS DISTINCT FROM v_wa1 THEN
    RAISE EXCEPTION 'Resolver WA mismatch';
  END IF;
  IF public._resolve_worker_payment_debit_account(v_co_a, v_worker_a, true) IS DISTINCT FROM v_wp1 THEN
    RAISE EXCEPTION 'Resolver WP mismatch';
  END IF;
  RAISE NOTICE 'PASS: worker payment resolver';

  INSERT INTO accounts (company_id, code, name, type, parent_id, is_active)
  SELECT v_co_a, 'WA-PRESEED', 'preseed', 'asset',
         (SELECT id FROM accounts WHERE company_id = v_co_a AND code = '1180'), true
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_co_a AND code = 'WA-PRESEED');
  v_id := public._ensure_worker_advance_subaccount(v_co_a, v_worker_a);
  IF v_id IS DISTINCT FROM v_wa1 THEN
    RAISE EXCEPTION 'Concurrency-style WA id drift';
  END IF;
  RAISE NOTICE 'PASS: concurrency/unique-path WA stable';
END $$;

-- =============================================================================
-- C) Authenticated same-company (top-level SET ROLE)
-- =============================================================================
SET ROLE authenticated;
SELECT set_config('app.test_user_company_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

DO $$
DECLARE
  v_co_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_worker_a UUID := '11111111-1111-1111-1111-111111111111';
  v_courier_a UUID := '44444444-4444-4444-4444-444444444444';
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'FAIL: expected current_user=authenticated got %', current_user;
  END IF;
  PERFORM public._ensure_worker_advance_subaccount(v_co_a, v_worker_a);
  PERFORM public._ensure_worker_payable_subaccount(v_co_a, v_worker_a);
  PERFORM public.get_or_create_courier_payable_account(v_co_a, v_courier_a, 'Courier A Local');
  PERFORM public._resolve_worker_payment_debit_account(v_co_a, v_worker_a, false);
  PERFORM 1 FROM public.get_contact_party_gl_balances(v_co_a, NULL, CURRENT_DATE);
  RAISE NOTICE 'PASS: authenticated same-company WA/WP/courier/resolver/GL';
END $$;

-- =============================================================================
-- D) Authenticated cross-company — fail closed, no mutation
-- =============================================================================
DO $$
DECLARE
  v_co_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_co_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_worker_a UUID := '11111111-1111-1111-1111-111111111111';
  v_worker_b UUID := '22222222-2222-2222-2222-222222222222';
  v_courier_b UUID := '55555555-5555-5555-5555-555555555555';
  v_cnt_before BIGINT;
  v_cnt_after BIGINT;
BEGIN
  SELECT count(*) INTO v_cnt_before FROM accounts WHERE company_id = v_co_b;

  BEGIN
    PERFORM public._ensure_worker_advance_subaccount(v_co_b, v_worker_b);
    RAISE EXCEPTION 'FAIL: cross-company WA should be forbidden';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: cross-company WA blocked sqlstate=% msg=%', SQLSTATE, SQLERRM;
  END;

  BEGIN
    PERFORM public._ensure_worker_payable_subaccount(v_co_b, v_worker_b);
    RAISE EXCEPTION 'FAIL: cross-company WP should be forbidden';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: cross-company WP blocked sqlstate=% msg=%', SQLSTATE, SQLERRM;
  END;

  BEGIN
    PERFORM public.get_or_create_courier_payable_account(v_co_b, v_courier_b, 'Courier B');
    RAISE EXCEPTION 'FAIL: cross-company courier should be forbidden';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: cross-company courier blocked sqlstate=% msg=%', SQLSTATE, SQLERRM;
  END;

  BEGIN
    PERFORM public._resolve_worker_payment_debit_account(v_co_b, v_worker_b, true);
    RAISE EXCEPTION 'FAIL: cross-company resolver should be forbidden';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: cross-company resolver blocked sqlstate=% msg=%', SQLSTATE, SQLERRM;
  END;

  BEGIN
    PERFORM 1 FROM public.get_contact_party_gl_balances(v_co_b, NULL, CURRENT_DATE);
    RAISE EXCEPTION 'FAIL: cross-company GL should be forbidden';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: cross-company GL blocked sqlstate=% msg=% fingerprint=CO-B', SQLSTATE, SQLERRM;
  END;

  BEGIN
    PERFORM public._ensure_worker_advance_subaccount(v_co_a, v_worker_b);
    RAISE EXCEPTION 'FAIL: wrong-company contact WA should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: wrong-company contact WA blocked msg=%', SQLERRM;
  END;

  BEGIN
    PERFORM public.get_or_create_courier_payable_account(v_co_a, NULL, 'Attack');
    RAISE EXCEPTION 'FAIL: auth null-contact should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: auth null-contact courier blocked';
  END;

  SELECT count(*) INTO v_cnt_after FROM accounts WHERE company_id = v_co_b;
  IF v_cnt_after <> v_cnt_before THEN
    RAISE EXCEPTION 'CROSS_COMPANY_MUTATION: co_b accounts before=% after=%', v_cnt_before, v_cnt_after;
  END IF;
  RAISE NOTICE 'PASS: cross-company no mutation co_b_accounts=%', v_cnt_after;
END $$;

RESET ROLE;
SELECT set_config('app.test_user_company_id', '', false);

-- =============================================================================
-- E) Anon cannot invoke privileged ensures
-- =============================================================================
SET ROLE anon;

DO $$
DECLARE
  v_co_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_worker_a UUID := '11111111-1111-1111-1111-111111111111';
  v_courier_a UUID := '44444444-4444-4444-4444-444444444444';
BEGIN
  BEGIN
    PERFORM public._ensure_worker_advance_subaccount(v_co_a, v_worker_a);
    RAISE EXCEPTION 'FAIL: anon WA execute should be denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon WA execute denied';
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42501', '42000') OR SQLERRM ILIKE '%permission denied%' THEN
      RAISE NOTICE 'PASS: anon WA execute denied sqlstate=%', SQLSTATE;
    ELSE
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM public.get_or_create_courier_payable_account(v_co_a, v_courier_a, 'X');
    RAISE EXCEPTION 'FAIL: anon courier execute should be denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon courier execute denied';
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42501', '42000') OR SQLERRM ILIKE '%permission denied%' THEN
      RAISE NOTICE 'PASS: anon courier execute denied sqlstate=%', SQLSTATE;
    ELSE
      RAISE;
    END IF;
  END;
END $$;

RESET ROLE;

-- =============================================================================
-- F) service_role SET ROLE path remains functional
-- =============================================================================
SET ROLE service_role;
DO $$
DECLARE
  v_co_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_worker_a UUID := '11111111-1111-1111-1111-111111111111';
  v UUID;
BEGIN
  v := public._ensure_worker_advance_subaccount(v_co_a, v_worker_a);
  IF v IS NULL THEN
    RAISE EXCEPTION 'service_role WA failed';
  END IF;
  RAISE NOTICE 'PASS: service_role WA path';
END $$;
RESET ROLE;

-- =============================================================================
-- G) Worker lifecycle
-- =============================================================================
DO $$
DECLARE
  v_co_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_worker_a UUID := '11111111-1111-1111-1111-111111111111';
  v_courier_a UUID := '44444444-4444-4444-4444-444444444444';
  v_cash UUID;
  v_expense UUID;
  v_wa1 UUID;
  v_wp1 UUID;
  v_c1 UUID;
  v_je UUID;
  v_bal_wa NUMERIC;
  v_bal_wp NUMERIC;
  v_tb_diff NUMERIC;
BEGIN
  SELECT id INTO v_wa1 FROM accounts WHERE company_id = v_co_a AND linked_contact_id = v_worker_a AND code LIKE 'WA-%';
  SELECT id INTO v_wp1 FROM accounts WHERE company_id = v_co_a AND linked_contact_id = v_worker_a AND code LIKE 'WP-%';
  SELECT id INTO v_cash FROM accounts WHERE company_id = v_co_a AND code = '1010';
  SELECT id INTO v_expense FROM accounts WHERE company_id = v_co_a AND code = '5000';
  SELECT id INTO v_c1 FROM accounts
  WHERE company_id = v_co_a AND linked_contact_id = v_courier_a AND code ~ '^203[0-9]+$' AND code <> '2030';

  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id)
  VALUES (gen_random_uuid(), v_co_a, 'JE-ADV-1', 'worker advance', 'worker_advance', v_worker_a)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_wa1, 1000, 0), (v_je, v_cash, 0, 1000);

  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id)
  VALUES (gen_random_uuid(), v_co_a, 'JE-BILL-1', 'worker bill', 'worker_bill', v_worker_a)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_expense, 600, 0), (v_je, v_wp1, 0, 600);

  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id)
  VALUES (gen_random_uuid(), v_co_a, 'JE-APPLY-1', 'apply advance', 'worker_advance_settlement', v_worker_a)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_wp1, 400, 0), (v_je, v_wa1, 0, 400);

  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id)
  VALUES (gen_random_uuid(), v_co_a, 'JE-PAY-1', 'worker payment', 'worker_payment', v_worker_a)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_wp1, 200, 0), (v_je, v_cash, 0, 200);

  SELECT COALESCE(SUM(debit - credit), 0) INTO v_bal_wa FROM journal_entry_lines WHERE account_id = v_wa1;
  SELECT COALESCE(SUM(credit - debit), 0) INTO v_bal_wp FROM journal_entry_lines WHERE account_id = v_wp1;
  IF v_bal_wa <> 600 THEN RAISE EXCEPTION 'WA residual expected 600 got %', v_bal_wa; END IF;
  IF v_bal_wp <> 0 THEN RAISE EXCEPTION 'WP residual expected 0 got %', v_bal_wp; END IF;

  SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) INTO v_tb_diff
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_co_a;
  IF v_tb_diff <> 0 THEN RAISE EXCEPTION 'Company GL imbalance %', v_tb_diff; END IF;
  RAISE NOTICE 'PASS: worker lifecycle WA=600 WP=0 TB_diff=0';

  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id)
  VALUES (gen_random_uuid(), v_co_a, 'JE-DEP-1', 'courier deposit', 'deposit', v_courier_a)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_cash, 500, 0), (v_je, v_c1, 0, 500);

  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id)
  VALUES (gen_random_uuid(), v_co_a, 'JE-CHG-1', 'courier charge', 'courier_charge', v_courier_a)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_expense, 300, 0), (v_je, v_c1, 0, 300);

  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id)
  VALUES (gen_random_uuid(), v_co_a, 'JE-SET-1', 'courier settle', 'courier_settlement', v_courier_a)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_c1, 800, 0), (v_je, v_cash, 0, 800);

  IF EXISTS (
    SELECT 1 FROM accounts
    WHERE company_id = v_co_a AND linked_contact_id = v_courier_a AND code LIKE 'AP-%'
  ) THEN
    RAISE EXCEPTION 'Courier accidentally got AP-SUP leaf';
  END IF;

  SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) INTO v_tb_diff
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_co_a;
  IF v_tb_diff <> 0 THEN RAISE EXCEPTION 'Courier path company GL imbalance %', v_tb_diff; END IF;
  RAISE NOTICE 'PASS: courier lifecycle 203x balanced no AP leaf';
  RAISE NOTICE 'ROLE_MODEL_POSTGRES_REGRESSION_PASS';
END $$;

SELECT 'ROLE_MODEL_POSTGRES_REGRESSION_PASS' AS result;
