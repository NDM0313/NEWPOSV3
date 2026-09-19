-- IBRAHIM Class B apply ONLY. Requires durable schema backup_coa_limited_ibrahim_v1.
-- ID LACE: NOT IMPLEMENTED.
-- Repeat run: already-applied matching post state → safe NOTICE no-op.

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  n int;
  n_already int;
  r RECORD;
  v_legacy_net numeric;
  v_ap_before numeric;
  v_ap_after numeric;
BEGIN
  IF to_regclass('backup_coa_limited_ibrahim_v1.manifest') IS NULL THEN
    RAISE EXCEPTION 'MISSING_BACKUP: run 01_backup.sql first (schema backup_coa_limited_ibrahim_v1)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM backup_coa_limited_ibrahim_v1.meta
    WHERE scope = 'IBRAHIM_CLASS_B_ONLY'
      AND id_lace_status = 'NOT_IMPLEMENTED'
      AND company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
  ) THEN
    RAISE EXCEPTION 'BACKUP_META_MISMATCH: refuse apply without matching IBRAHIM_CLASS_B_ONLY meta';
  END IF;

  SELECT COUNT(*) INTO n FROM backup_coa_limited_ibrahim_v1.manifest;
  IF n <> 2 THEN
    RAISE EXCEPTION 'MANIFEST_COUNT % <> 2', n;
  END IF;

  -- Already applied? (both lines on AP with same amounts) → no-op stop
  SELECT COUNT(*) INTO n_already
  FROM backup_coa_limited_ibrahim_v1.manifest m
  JOIN journal_entry_lines jel ON jel.id = m.line_id
  WHERE jel.account_id = m.to_account_id
    AND round(jel.debit, 2) = m.expected_debit
    AND round(jel.credit, 2) = m.expected_credit
    AND jel.journal_entry_id = m.journal_entry_id;
  IF n_already = 2 THEN
    RAISE NOTICE 'ALREADY_APPLIED: IBRAHIM 2 lines already on AP — safe no-op stop';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM journal_account_verified_remaps
    WHERE company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
      AND from_account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
      AND to_account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
  ) THEN
    RAISE EXCEPTION 'IBRAHIM verified remap missing — abort (automatic scope required before historical apply)';
  END IF;

  -- Lock and validate each manifest row against live state (company, JE, status, amounts, account)
  FOR r IN
    SELECT m.* FROM backup_coa_limited_ibrahim_v1.manifest m ORDER BY m.line_id
  LOOP
    PERFORM 1 FROM journal_entry_lines WHERE id = r.line_id FOR UPDATE;
    IF NOT EXISTS (
      SELECT 1
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.id = r.line_id
        AND je.company_id = r.company_id
        AND jel.journal_entry_id = r.journal_entry_id
        AND jel.account_id = r.from_account_id
        AND round(jel.debit, 2) = r.expected_debit
        AND round(jel.credit, 2) = r.expected_credit
        AND COALESCE(je.is_void, false) = false
        AND je.entry_no = r.entry_no
    ) THEN
      RAISE EXCEPTION 'APPLY_DRIFT: line % no longer matches pre-apply manifest — abort', r.line_id;
    END IF;
  END LOOP;

  -- Balance snapshot (report invariant aids)
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_legacy_net
  FROM journal_entry_lines jel
  WHERE jel.account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';

  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_ap_before
  FROM journal_entry_lines jel
  WHERE jel.account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312';

  UPDATE journal_entry_lines jel
  SET account_id = m.to_account_id
  FROM backup_coa_limited_ibrahim_v1.manifest m
  WHERE jel.id = m.line_id
    AND jel.account_id = m.from_account_id
    AND round(jel.debit, 2) = m.expected_debit
    AND round(jel.credit, 2) = m.expected_credit
    AND jel.journal_entry_id = m.journal_entry_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN
    RAISE EXCEPTION 'APPLY_ROWCOUNT % <> 2 — concurrent drift', n;
  END IF;

  DROP TABLE IF EXISTS backup_coa_limited_ibrahim_v1.post_apply_lines;
  CREATE TABLE backup_coa_limited_ibrahim_v1.post_apply_lines AS
  SELECT jel.id, jel.account_id, jel.debit, jel.credit, jel.journal_entry_id, now() AS captured_at
  FROM journal_entry_lines jel
  WHERE jel.id IN (SELECT line_id FROM backup_coa_limited_ibrahim_v1.manifest);

  SELECT COUNT(*) INTO n FROM backup_coa_limited_ibrahim_v1.post_apply_lines p
  JOIN backup_coa_limited_ibrahim_v1.manifest m ON m.line_id = p.id
  WHERE p.account_id = m.to_account_id
    AND round(p.debit, 2) = m.expected_debit
    AND round(p.credit, 2) = m.expected_credit;
  IF n <> 2 THEN
    RAISE EXCEPTION 'POST_APPLY_INVARIANT_FAILED';
  END IF;

  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_ap_after
  FROM journal_entry_lines jel
  WHERE jel.account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312';

  -- Moved net should equal sum of the two lines' (debit-credit)
  IF round(v_ap_after - v_ap_before, 2) IS DISTINCT FROM (
    SELECT round(SUM(expected_debit - expected_credit), 2) FROM backup_coa_limited_ibrahim_v1.manifest
  ) THEN
    RAISE EXCEPTION 'APPLY_BALANCE_INVARIANT: AP delta % does not match moved line nets', v_ap_after - v_ap_before;
  END IF;

  RAISE NOTICE 'APPLY_OK: moved 2 IBRAHIM lines; legacy_net_before_move_context=% ap_before=% ap_after=%',
    v_legacy_net, v_ap_before, v_ap_after;
END $$;

COMMIT;
