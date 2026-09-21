-- Prepare forced validation failure for ACTUAL 01_backup.sql (isolated DB only).
\set ON_ERROR_STOP on
DO $$
DECLARE n int;
BEGIN
  IF to_regnamespace('backup_coa_limited_ibrahim_v1') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: backup schema must not exist before forced-failure test';
  END IF;
  UPDATE journal_entries SET entry_no='JE-0137-DRIFT-TEST'
  WHERE id='11111111-1111-1111-1111-111111111111' AND entry_no='JE-0137';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: could not prepare exact JE-0137 drift, rows=%', n; END IF;
  RAISE NOTICE 'ATOMIC_BACKUP_PREPARED: actual backup must fail validation';
END $$;
