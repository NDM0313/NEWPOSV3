-- Real SET ROLE / ACL checks (not JWT-text-only inside superuser session).
\set ON_ERROR_STOP on

DO $$
DECLARE
  c1 uuid := 'e08a04af-22a8-4869-9b4d-da31fce13158';
  c2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  ap uuid := '2c56a1d1-e31d-433f-85af-ce3fd4729312';
  leg uuid := '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';
  cash_c2 uuid := 'dddddddd-dddd-dddd-dddd-ddddddddddd2';
  acl_repair boolean;
  acl_resolve_auth boolean;
  acl_resolve_anon boolean;
  acl_core boolean;
  acl_internal boolean;
  acl_tickets boolean;
BEGIN
  -- Catalog ACLs (explicit role grants, not only PUBLIC)
  acl_resolve_auth := has_function_privilege('authenticated', 'public.resolve_journal_posting_account_id(uuid,uuid)', 'execute');
  acl_resolve_anon := has_function_privilege('anon', 'public.resolve_journal_posting_account_id(uuid,uuid)', 'execute');
  acl_repair := has_function_privilege('authenticated', 'public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)', 'execute');
  acl_core := has_function_privilege('authenticated', 'public._journal_account_guard_resolve_core(uuid,uuid,boolean)', 'execute');
  acl_internal := has_function_privilege('authenticated', 'public._journal_account_guard_resolve_internal(uuid,uuid,uuid)', 'execute');
  acl_tickets := has_table_privilege('authenticated', 'public._journal_account_repair_tickets', 'insert');

  IF NOT acl_resolve_auth THEN
    RAISE EXCEPTION 'FAIL: authenticated must EXECUTE resolve';
  END IF;
  IF acl_resolve_anon THEN
    RAISE EXCEPTION 'FAIL: anon must not EXECUTE resolve';
  END IF;
  IF acl_repair THEN
    RAISE EXCEPTION 'FAIL: authenticated must not EXECUTE repair_restore';
  END IF;
  IF acl_core OR acl_internal THEN
    RAISE EXCEPTION 'FAIL: authenticated must not EXECUTE private core/internal';
  END IF;
  IF acl_tickets THEN
    RAISE EXCEPTION 'FAIL: authenticated must not INSERT repair tickets';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)', 'execute') THEN
    RAISE EXCEPTION 'FAIL: service_role must EXECUTE repair_restore';
  END IF;
  RAISE NOTICE 'PASS: catalog ACLs (resolve auth yes; repair/auth private no; service_role repair yes)';
END $$;

-- SET ROLE authenticated: company scope + forbidden restore + spoof GUC
SET ROLE authenticated;
SELECT set_config('app.test_user_company_id', 'e08a04af-22a8-4869-9b4d-da31fce13158', false);
SELECT set_config('app.journal_account_guard_mode', 'allow_inactive_restore', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false); -- spoof must not elevate INVOKER current_user

DO $$
DECLARE
  c1 uuid := 'e08a04af-22a8-4869-9b4d-da31fce13158';
  c2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  ap uuid := '2c56a1d1-e31d-433f-85af-ce3fd4729312';
  leg uuid := '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';
  v uuid;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'FAIL: expected current_user=authenticated after SET ROLE, got %', current_user;
  END IF;

  v := public.resolve_journal_posting_account_id(c1, ap);
  IF v IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: auth resolve same-company active';
  END IF;

  BEGIN
    PERFORM public.resolve_journal_posting_account_id(c2, 'dddddddd-dddd-dddd-dddd-ddddddddddd2');
    RAISE EXCEPTION 'FAIL: cross-company resolve should forbid';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: SET ROLE authenticated cross-company resolve forbidden';
  END;

  BEGIN
    PERFORM public.repair_restore_journal_entry_line_account(
      c1, '343c2586-2d86-4c24-9e03-3af493dada9d', ap, leg, 99275, 0,
      '22222222-2222-2222-2222-222222222222'
    );
    RAISE EXCEPTION 'FAIL: authenticated must not repair_restore';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: SET ROLE authenticated unauthorized restore rejected';
  WHEN OTHERS THEN
    -- privilege EXECUTE may raise different SQLSTATE
    IF SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%JOURNAL_REPAIR_FORBIDDEN%' THEN
      RAISE NOTICE 'PASS: SET ROLE authenticated unauthorized restore rejected (% )', SQLSTATE;
    ELSE
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'PASS: JWT/GUC spoof as authenticated did not change current_user=%', current_user;
END $$;

RESET ROLE;

-- SET ROLE service_role: repair allowed
SET ROLE service_role;
DO $$
DECLARE
  c1 uuid := 'e08a04af-22a8-4869-9b4d-da31fce13158';
  ap uuid := '2c56a1d1-e31d-433f-85af-ce3fd4729312';
  leg uuid := '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';
  je2 uuid := '22222222-2222-2222-2222-222222222222';
  v uuid;
  cur uuid;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'FAIL: expected service_role, got %', current_user;
  END IF;

  SELECT account_id INTO cur FROM journal_entry_lines
  WHERE id = '343c2586-2d86-4c24-9e03-3af493dada9d';

  IF cur IS NOT DISTINCT FROM leg THEN
    -- already on legacy from 02_cases — move to AP first via direct update (active)
    UPDATE journal_entry_lines SET account_id = ap
    WHERE id = '343c2586-2d86-4c24-9e03-3af493dada9d';
    cur := ap;
  END IF;

  IF cur IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: fixture line should be on AP before service_role restore test, got %', cur;
  END IF;

  v := public.repair_restore_journal_entry_line_account(
    c1, '343c2586-2d86-4c24-9e03-3af493dada9d', ap, leg, 99275, 0, je2
  );
  IF v IS DISTINCT FROM leg THEN
    RAISE EXCEPTION 'FAIL: service_role repair should restore legacy';
  END IF;
  RAISE NOTICE 'PASS: SET ROLE service_role repair_restore ok';

  -- restore fixture: both lines on legacy for 05_repair
  UPDATE journal_entry_lines SET account_id = ap WHERE id = '343c2586-2d86-4c24-9e03-3af493dada9d';
  PERFORM public.repair_restore_journal_entry_line_account(
    c1, '343c2586-2d86-4c24-9e03-3af493dada9d', ap, leg, 99275, 0, je2
  );
END $$;
RESET ROLE;

DO $$
BEGIN
  RAISE NOTICE 'ACL_SET_ROLE_CHECKS_PASSED';
END $$;
