-- Isolated verification cases. Expect RAISE on failures (scripted checks).
\set ON_ERROR_STOP on

DO $$
DECLARE
  c1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  c2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  cash uuid := 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
  leg uuid := '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';
  ap uuid := '2c56a1d1-e31d-433f-85af-ce3fd4729312';
  contact uuid := '08592090-3e74-4b5e-8dd4-e06271f06391';
  je1 uuid := '11111111-1111-1111-1111-111111111111';
  je2 uuid := '22222222-2222-2222-2222-222222222222';
  je_other uuid := '33333333-3333-3333-3333-333333333333';
  line1 uuid;
  line_hist uuid;
  v_resolved uuid;
  v_cnt int;
  v_ok boolean;
BEGIN
  INSERT INTO companies (id, name) VALUES (c1, 'Co1'), (c2, 'Co2');
  INSERT INTO accounts (id, company_id, code, name, is_active, linked_contact_id) VALUES
    (cash, c1, '1010', 'Cash', true, NULL),
    (leg, c1, '210026', 'IBRAHIM BNRS', false, NULL),
    (ap, c1, 'AP-SUPZHD0026', 'Payable — IBRAHIM', true, contact),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd2', c2, '1010', 'Cash Co2', true, NULL);

  INSERT INTO journal_entries (id, company_id, entry_no) VALUES
    (je1, c1, 'JE-A'),
    (je2, c1, 'JE-B'),
    (je_other, c2, 'JE-OTHER');

  PERFORM set_config('app.test_user_company_id', c1::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

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

  -- 3) INSERT retired → auto remap + event
  INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit)
  VALUES ('677c74de-b677-4a6f-877f-b13e0ac66aaa', je1, leg, 19000, 0)
  RETURNING id, account_id INTO line1, v_resolved;
  IF v_resolved IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: expected remap to AP, got %', v_resolved;
  END IF;
  SELECT COUNT(*) INTO v_cnt FROM journal_account_guard_events
  WHERE from_account_id = leg AND to_account_id = ap;
  IF v_cnt < 1 THEN
    RAISE EXCEPTION 'FAIL: expected guard event';
  END IF;
  RAISE NOTICE 'PASS: insert remapped + event';

  -- 4) Historical edit: change description only via update of non-trigger cols
  -- (simulate by updating debit — trigger is UPDATE OF account_id, journal_entry_id only)
  UPDATE journal_entry_lines SET debit = 19000.00 WHERE id = line1 AND account_id = ap;
  SELECT account_id INTO v_resolved FROM journal_entry_lines WHERE id = line1;
  IF v_resolved IS DISTINCT FROM ap THEN
    RAISE EXCEPTION 'FAIL: unrelated edit remapped unexpectedly';
  END IF;
  RAISE NOTICE 'PASS: non-key update preserved account';

  -- 5) Same account_id reassignment (explicit SET account_id = account_id) still validates
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

  -- 7) journal_entry_id move to other company JE with same account → reject
  BEGIN
    UPDATE journal_entry_lines SET journal_entry_id = je_other WHERE id = line1;
    RAISE EXCEPTION 'FAIL: JE reassignment cross-company should reject';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: journal_entry_id reassignment revalidated';
  END;

  -- 8) Conflict mapping fails
  BEGIN
    INSERT INTO journal_account_verified_remaps (
      company_id, from_account_id, to_account_id, expected_contact_id, source
    ) VALUES (c1, leg, cash, contact, 'conflict');
    RAISE EXCEPTION 'FAIL: duplicate from_account should unique-fail';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS: conflicting second insert unique-blocked';
  END;

  -- Simulate seed conflict check function path: existing different target
  -- (manual raise path tested by inserting different via delete+wrong)
  DELETE FROM journal_account_verified_remaps WHERE from_account_id = leg;
  INSERT INTO journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, expected_contact_id, source
  ) VALUES (c1, leg, cash, contact, 'wrong_target');
  -- Identity mismatch on resolve: cash has null linked_contact
  UPDATE accounts SET is_active = false WHERE id = cash; -- make cash inactive so resolve tries remap? 
  -- Reset: restore cash active; remap from leg to cash with expected contact — resolve should fail identity
  UPDATE accounts SET is_active = true WHERE id = cash;
  DELETE FROM journal_account_verified_remaps WHERE from_account_id = leg;
  INSERT INTO journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, expected_contact_id, from_code, to_code, source
  ) VALUES (c1, leg, ap, contact, '210026', 'AP-SUPZHD0026', 'test_seed');
  -- Break AP link
  UPDATE accounts SET linked_contact_id = NULL WHERE id = ap;
  BEGIN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je2, leg, 50, 0);
    RAISE EXCEPTION 'FAIL: identity mismatch should reject';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: remap identity mismatch rejected';
  END;
  UPDATE accounts SET linked_contact_id = contact WHERE id = ap;

  -- 9) Repair restore GUC
  INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit)
  VALUES ('343c2586-2d86-4c24-9e03-3af493dada9d', je2, ap, 99275, 0);
  PERFORM set_config('app.journal_account_guard_mode', 'allow_inactive_restore', true);
  UPDATE journal_entry_lines
  SET account_id = leg
  WHERE id = '343c2586-2d86-4c24-9e03-3af493dada9d'
    AND account_id = ap;
  SELECT account_id INTO v_resolved FROM journal_entry_lines
  WHERE id = '343c2586-2d86-4c24-9e03-3af493dada9d';
  IF v_resolved IS DISTINCT FROM leg THEN
    RAISE EXCEPTION 'FAIL: restore GUC should keep retired account, got %', v_resolved;
  END IF;
  PERFORM set_config('app.journal_account_guard_mode', '', true);
  RAISE NOTICE 'PASS: allow_inactive_restore rollback path';

  -- 10) Company reassign blocked
  BEGIN
    UPDATE accounts SET company_id = c2 WHERE id = ap;
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

  -- 11) EXECUTE ACLs: authenticated+service_role yes; PUBLIC/anon no
  IF NOT has_function_privilege(
    'authenticated',
    'public.resolve_journal_posting_account_id(uuid,uuid)',
    'execute'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated should retain execute';
  END IF;
  IF NOT has_function_privilege(
    'service_role',
    'public.resolve_journal_posting_account_id(uuid,uuid)',
    'execute'
  ) THEN
    RAISE EXCEPTION 'FAIL: service_role should retain execute';
  END IF;
  IF has_function_privilege(
    'anon',
    'public.resolve_journal_posting_account_id(uuid,uuid)',
    'execute'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon must not have execute';
  END IF;
  RAISE NOTICE 'PASS: resolver execute ACLs (authenticated/service_role yes, anon no)';

  RAISE NOTICE 'ALL_ISOLATED_CHECKS_PASSED';
END $$;
