-- Verify failed ACTUAL 01_backup.sql was atomic, then restore isolated fixture.
\set ON_ERROR_STOP on
DO $$
DECLARE n int;
BEGIN
  IF to_regnamespace('backup_coa_limited_ibrahim_v1') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: failed actual backup left durable schema/evidence';
  END IF;
  UPDATE journal_entries SET entry_no='JE-0137'
  WHERE id='11111111-1111-1111-1111-111111111111' AND entry_no='JE-0137-DRIFT-TEST';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: could not restore JE-0137 fixture, rows=%', n; END IF;
  RAISE NOTICE 'ATOMIC_BACKUP_FAIL_PASSED: actual 01_backup.sql failed with no durable package';
END $$;
