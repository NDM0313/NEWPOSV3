-- Verify failed ACTUAL 03_rollback.sql was atomic and restore isolated fixture.
\set ON_ERROR_STOP on
DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n
  FROM backup_coa_limited_ibrahim_v1.manifest m
  JOIN journal_entry_lines jel ON jel.id=m.line_id
  WHERE jel.account_id=m.to_account_id;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: failed rollback partially changed accounts; AP lines=%', n; END IF;
  IF (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.pre_apply_lines) <> 2
     OR (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.post_apply_lines) <> 2
     OR (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.manifest) <> 2 THEN
    RAISE EXCEPTION 'FAIL: failed rollback damaged immutable evidence';
  END IF;
  UPDATE journal_entry_lines SET debit=19000.00
  WHERE id='677c74de-b677-4a6f-877f-b13e0ac66aaa'
    AND account_id='2c56a1d1-e31d-433f-85af-ce3fd4729312'
    AND round(debit,2)=19000.01;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: could not restore drift fixture, rows=%', n; END IF;
  RAISE NOTICE 'ROLLBACK_DRIFT_ACTUAL_SCRIPT_PASSED: actual 03_rollback.sql rejected drift atomically';
END $$;
