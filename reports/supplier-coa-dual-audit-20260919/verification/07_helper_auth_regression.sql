-- Review-blocker regressions: helper ACL auth + non-destructive backup.
\set ON_ERROR_STOP on

-- 1) Catalog: every helper ACL
DO $$
DECLARE
  bad text := '';
BEGIN
  IF has_function_privilege('authenticated', 'public._journal_account_guard_resolve_public_core(uuid,uuid)', 'execute') IS NOT TRUE THEN
    bad := bad || ' public_core_grant_missing';
  END IF;
  IF has_function_privilege('authenticated', 'public._journal_account_guard_resolve_core(uuid,uuid,boolean)', 'execute') THEN
    bad := bad || ' core_leak';
  END IF;
  IF has_function_privilege('authenticated', 'public._journal_account_guard_resolve_internal(uuid,uuid,uuid)', 'execute') THEN
    bad := bad || ' internal_leak';
  END IF;
  IF has_function_privilege('authenticated', 'public._repair_restore_journal_entry_line_account_internal(uuid,uuid,uuid,uuid,numeric,numeric,uuid)', 'execute') THEN
    bad := bad || ' repair_internal_leak';
  END IF;
  IF has_function_privilege('service_role', 'public._repair_restore_journal_entry_line_account_internal(uuid,uuid,uuid,uuid,numeric,numeric,uuid)', 'execute') THEN
    bad := bad || ' repair_internal_service_leak';
  END IF;
  IF has_function_privilege('authenticated', 'public._journal_account_guard_effective_role()', 'execute') THEN
    bad := bad || ' effective_role_leak';
  END IF;
  IF has_function_privilege('authenticated', 'public._journal_account_guard_assert_resolve_authorized(uuid)', 'execute') THEN
    bad := bad || ' assert_leak';
  END IF;
  IF has_table_privilege('authenticated', 'public._journal_account_repair_tickets', 'insert') THEN
    bad := bad || ' tickets_insert_leak';
  END IF;
  IF bad <> '' THEN
    RAISE EXCEPTION 'FAIL: helper ACL issues:%', bad;
  END IF;
  RAISE NOTICE 'PASS: helper ACLs — public_core granted; core/internal/repair_internal/assert/tickets not client-executable';
END $$;

-- 2) Direct public_core cross-company must fail (authenticated)
SET ROLE authenticated;
SELECT set_config('app.test_user_company_id', 'e08a04af-22a8-4869-9b4d-da31fce13158', false);

DO $$
DECLARE
  c1 uuid := 'e08a04af-22a8-4869-9b4d-da31fce13158';
  c2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  ap uuid := '2c56a1d1-e31d-433f-85af-ce3fd4729312';
  cash_c2 uuid := 'dddddddd-dddd-dddd-dddd-ddddddddddd2';
  v uuid;
  before_cnt int;
  after_cnt int;
BEGIN
  SELECT COUNT(*) INTO before_cnt FROM journal_entry_lines;

  -- Legitimate same-company public resolve + direct helper
  v := public.resolve_journal_posting_account_id(c1, ap);
  IF v IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: same-company resolve';
  END IF;
  v := public._journal_account_guard_resolve_public_core(c1, ap);
  IF v IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: same-company direct public_core';
  END IF;
  RAISE NOTICE 'PASS: same-company resolve + direct public_core';

  BEGIN
    PERFORM public._journal_account_guard_resolve_public_core(c2, cash_c2);
    RAISE EXCEPTION 'FAIL: direct public_core cross-company should forbid';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: direct public_core cross-company forbidden';
  END;

  BEGIN
    PERFORM public.resolve_journal_posting_account_id(c2, cash_c2);
    RAISE EXCEPTION 'FAIL: resolve cross-company should forbid';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: resolve cross-company forbidden';
  END;

  SELECT COUNT(*) INTO after_cnt FROM journal_entry_lines;
  IF after_cnt IS DISTINCT FROM before_cnt THEN
    RAISE EXCEPTION 'FAIL: unauthorized helper calls changed journal_entry_lines';
  END IF;
  RAISE NOTICE 'PASS: unauthorized helper calls changed no state';
END $$;

RESET ROLE;

DO $$
BEGIN
  RAISE NOTICE 'HELPER_AUTH_REGRESSION_PASSED';
END $$;
