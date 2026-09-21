-- Isolated verification cases (guard behavior + legitimate posting + repair tickets).
\set ON_ERROR_STOP on

DO $$
DECLARE
  c1 uuid := 'e08a04af-22a8-4869-9b4d-da31fce13158';
  c2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  cash uuid := 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
  leg uuid := '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';
  ap uuid := '2c56a1d1-e31d-433f-85af-ce3fd4729312';
  contact uuid := '08592090-3e74-4b5e-8dd4-e06271f06391';
  worker_adv uuid := 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaa1';
  worker_pay uuid := 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaa2';
  courier uuid := 'aaaaaaaa-3333-3333-3333-aaaaaaaaaaa3';
  supplier_ap uuid := 'aaaaaaaa-4444-4444-4444-aaaaaaaaaaa4';
  je1 uuid := '11111111-1111-1111-1111-111111111111';
  je2 uuid := '22222222-2222-2222-2222-222222222222';
  je_other uuid := '33333333-3333-3333-3333-333333333333';
  je_bal uuid := '44444444-4444-4444-4444-444444444444';
  line1 uuid;
  line_evt uuid;
  v_resolved uuid;
  v_cnt int;
  v_bal boolean;
BEGIN
  INSERT INTO companies (id, name) VALUES (c1, 'Co1'), (c2, 'Co2');
  INSERT INTO accounts (id, company_id, code, name, is_active, linked_contact_id) VALUES
    (cash, c1, '1010', 'Cash', true, NULL),
    (leg, c1, '210026', 'IBRAHIM BNRS', false, NULL),
    (ap, c1, 'AP-SUPZHD0026', 'Payable — IBRAHIM', true, contact),
    (worker_adv, c1, '1180', 'Worker Advance', true, 'bbbbbbbb-1111-1111-1111-bbbbbbbbbbb1'),
    (worker_pay, c1, '2010', 'Worker Payable', true, 'bbbbbbbb-1111-1111-1111-bbbbbbbbbbb1'),
    (courier, c1, '2031', 'Courier Deposit', true, 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbb2'),
    (supplier_ap, c1, 'AP-SUPTEST001', 'Payable — Test Supplier', true, 'bbbbbbbb-3333-3333-3333-bbbbbbbbbbb3'),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd2', c2, '1010', 'Cash Co2', true, NULL);

  INSERT INTO journal_entries (id, company_id, entry_no) VALUES
    (je1, c1, 'JE-0137'),
    (je2, c1, 'JE-0138'),
    (je_other, c2, 'JE-OTHER'),
    (je_bal, c1, 'JE-BAL');

  PERFORM set_config('app.test_user_company_id', c1::text, true);

  -- 1) Missing remap → reject
  BEGIN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je1, leg, 100, 0);
    RAISE EXCEPTION 'FAIL: expected retired reject without remap';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: retired without remap rejected';
  END;

  -- 2) Insert verified remap (simulates successful seed for Ibrahim)
  INSERT INTO journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, expected_contact_id, from_code, to_code, source
  ) VALUES (c1, leg, ap, contact, '210026', 'AP-SUPZHD0026', 'test_seed');

  -- 3) INSERT retired → auto remap + event with line id
  INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit)
  VALUES ('677c74de-b677-4a6f-877f-b13e0ac66aaa', je1, leg, 19000, 0)
  RETURNING id, account_id INTO line1, v_resolved;
  IF v_resolved IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: expected remap to AP, got %', v_resolved;
  END IF;
  SELECT journal_entry_line_id INTO line_evt FROM journal_account_guard_events
  WHERE from_account_id = leg AND to_account_id = ap
  ORDER BY created_at DESC LIMIT 1;
  IF line_evt IS DISTINCT FROM line1 THEN
    RAISE EXCEPTION 'FAIL: remap event must record line id %, got %', line1, line_evt;
  END IF;
  RAISE NOTICE 'PASS: insert remapped + event with line_id';

  -- 4) Non-key update preserves account
  UPDATE journal_entry_lines SET debit = 19000.00 WHERE id = line1 AND account_id = ap;
  SELECT account_id INTO v_resolved FROM journal_entry_lines WHERE id = line1;
  IF v_resolved IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: unrelated edit remapped unexpectedly';
  END IF;
  RAISE NOTICE 'PASS: non-key update preserved account';

  -- 5) Explicit same active account_id update ok
  UPDATE journal_entry_lines SET account_id = ap WHERE id = line1;
  RAISE NOTICE 'PASS: explicit same active account_id update ok';

  -- 6) Wrong-company account on JE
  BEGIN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je1, 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 1, 0);
    RAISE EXCEPTION 'FAIL: wrong-company should reject';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: wrong-company rejected';
  END;

  -- 7) journal_entry_id move to other company JE
  BEGIN
    UPDATE journal_entry_lines SET journal_entry_id = je_other WHERE id = line1;
    RAISE EXCEPTION 'FAIL: JE reassignment cross-company should reject';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: journal_entry_id reassignment revalidated';
  END;

  -- 8) Conflicting unique map
  BEGIN
    INSERT INTO journal_account_verified_remaps (
      company_id, from_account_id, to_account_id, expected_contact_id, source
    ) VALUES (c1, leg, cash, contact, 'conflict');
    RAISE EXCEPTION 'FAIL: duplicate from_account should unique-fail';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS: conflicting second insert unique-blocked';
  END;

  -- Identity mismatch
  UPDATE accounts SET linked_contact_id = NULL WHERE id = ap;
  BEGIN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je2, leg, 50, 0);
    RAISE EXCEPTION 'FAIL: identity mismatch should reject';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: remap identity mismatch rejected';
  END;
  UPDATE accounts SET linked_contact_id = contact WHERE id = ap;

  -- Role check: legacy → non-AP rejected
  DELETE FROM journal_account_verified_remaps WHERE from_account_id = leg;
  INSERT INTO journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, expected_contact_id, from_code, to_code, source
  ) VALUES (c1, leg, worker_pay, contact, '210026', '2010', 'bad_role');
  BEGIN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je2, leg, 10, 0);
    RAISE EXCEPTION 'FAIL: worker payable target should role-reject';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: legacy→worker role remap rejected';
  END;
  DELETE FROM journal_account_verified_remaps WHERE from_account_id = leg;
  INSERT INTO journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, expected_contact_id, from_code, to_code, source
  ) VALUES (c1, leg, ap, contact, '210026', 'AP-SUPZHD0026', 'test_seed');

  -- 9) GUC spoof must NOT allow inactive restore
  INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit)
  VALUES ('343c2586-2d86-4c24-9e03-3af493dada9d', je2, ap, 99275, 0);
  PERFORM set_config('app.journal_account_guard_mode', 'allow_inactive_restore', true);
  PERFORM set_config('app.journal_account_guard_internal', '1', true);
  BEGIN
    UPDATE journal_entry_lines
    SET account_id = leg
    WHERE id = '343c2586-2d86-4c24-9e03-3af493dada9d';
    -- If update "succeeds" via remap back to AP, account stays AP — also OK (not inactive kept)
    SELECT account_id INTO v_resolved FROM journal_entry_lines
    WHERE id = '343c2586-2d86-4c24-9e03-3af493dada9d';
    IF v_resolved IS NOT DISTINCT FROM leg THEN
      RAISE EXCEPTION 'FAIL: GUC spoof must not keep inactive account';
    END IF;
    RAISE NOTICE 'PASS: GUC spoof did not grant inactive restore (account=%)', v_resolved;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: GUC spoof inactive restore rejected';
  END;
  PERFORM set_config('app.journal_account_guard_mode', '', true);
  PERFORM set_config('app.journal_account_guard_internal', '', true);

  -- 10) Privileged repair_restore (postgres session) exact ticket path
  PERFORM public.repair_restore_journal_entry_line_account(
    c1,
    '343c2586-2d86-4c24-9e03-3af493dada9d',
    ap,
    leg,
    99275,
    0,
    je2
  );
  SELECT account_id INTO v_resolved FROM journal_entry_lines
  WHERE id = '343c2586-2d86-4c24-9e03-3af493dada9d';
  IF v_resolved IS DISTINCT FROM leg THEN
    RAISE EXCEPTION 'FAIL: repair_restore should keep inactive, got %', v_resolved;
  END IF;
  RAISE NOTICE 'PASS: privileged repair_restore inactive path';

  -- Put both IBRAHIM lines on legacy for repair-package scripts (historical scope).
  UPDATE journal_entry_lines SET account_id = ap
  WHERE id = '343c2586-2d86-4c24-9e03-3af493dada9d';
  PERFORM public.repair_restore_journal_entry_line_account(
    c1, '677c74de-b677-4a6f-877f-b13e0ac66aaa', ap, leg, 19000, 0, je1
  );
  PERFORM public.repair_restore_journal_entry_line_account(
    c1, '343c2586-2d86-4c24-9e03-3af493dada9d', ap, leg, 99275, 0, je2
  );

  -- 11) Company reassign blocked (lines currently on legacy leaf)
  BEGIN
    UPDATE accounts SET company_id = c2 WHERE id = leg;
    RAISE EXCEPTION 'FAIL: account company reassign should block';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: account company reassign blocked';
  END;

  BEGIN
    UPDATE journal_entries SET company_id = c2 WHERE id = je1;
    RAISE EXCEPTION 'FAIL: JE company reassign should block';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: JE company reassign blocked';
  END;

  -- 12) Legitimate supplier / worker / courier posting still works
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
  VALUES
    (je_bal, supplier_ap, 0, 500),
    (je_bal, cash, 500, 0),
    (je_bal, worker_adv, 200, 0),
    (je_bal, cash, 0, 200),
    (je_bal, courier, 75, 0),
    (je_bal, cash, 0, 75);

  SELECT bool_and(is_balanced) INTO v_bal FROM check_journal_entries_balance() WHERE journal_entry_id = je_bal;
  IF v_bal IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: balanced JE with supplier/worker/courier should pass check_journal_entries_balance';
  END IF;
  SELECT total_debit = total_credit INTO v_bal FROM journal_entries WHERE id = je_bal;
  IF v_bal IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: totals sync trigger should keep JE balanced';
  END IF;
  RAISE NOTICE 'PASS: legitimate supplier/worker/courier posting + balance triggers';

  -- 13) Resolver after successful trigger in same transaction
  v_resolved := public.resolve_journal_posting_account_id(c1, ap);
  IF v_resolved IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: resolve after trigger should return active AP';
  END IF;
  BEGIN
    PERFORM public.resolve_journal_posting_account_id(c1, leg);
    -- With remap present, resolve returns AP (not inactive)
    NULL;
  END;
  v_resolved := public.resolve_journal_posting_account_id(c1, leg);
  IF v_resolved IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: resolve inactive with remap should return AP, got %', v_resolved;
  END IF;
  RAISE NOTICE 'PASS: resolver after trigger in same txn';

  RAISE NOTICE 'ALL_ISOLATED_CHECKS_PASSED';
END $$;
