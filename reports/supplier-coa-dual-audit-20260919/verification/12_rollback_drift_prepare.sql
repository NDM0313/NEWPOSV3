-- Prepare drift before executing ACTUAL 03_rollback.sql.
\set ON_ERROR_STOP on
DO $$
DECLARE n int;
BEGIN
  UPDATE journal_entry_lines SET debit=debit+0.01
  WHERE id='677c74de-b677-4a6f-877f-b13e0ac66aaa'
    AND account_id='2c56a1d1-e31d-433f-85af-ce3fd4729312'
    AND round(debit,2)=19000.00 AND round(credit,2)=0.00;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: could not prepare rollback drift, rows=%', n; END IF;
  RAISE NOTICE 'ROLLBACK_DRIFT_PREPARED';
END $$;
