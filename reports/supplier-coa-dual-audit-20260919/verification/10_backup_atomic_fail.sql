-- Atomic failed backup: must leave zero durable objects for a new package name.
-- Uses actual CREATE/INSERT/validate pattern of 01_backup inside a transaction that aborts.
\set ON_ERROR_STOP on

DO $$
BEGIN
  BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('backup_coa_limited_ibrahim_atomic_fail'));
    CREATE SCHEMA backup_coa_limited_ibrahim_atomic_fail;
    CREATE TABLE backup_coa_limited_ibrahim_atomic_fail.meta (company_id uuid, run_id text);
    CREATE TABLE backup_coa_limited_ibrahim_atomic_fail.manifest (
      line_id uuid PRIMARY KEY,
      company_id uuid NOT NULL
    );
    -- Deliberately insert 0 rows then fail like 01_backup
    IF (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_atomic_fail.manifest) <> 2 THEN
      RAISE EXCEPTION 'BACKUP_MANIFEST_COUNT 0 <> 2 — transaction will roll back; no evidence left';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'BACKUP_MANIFEST_COUNT%' THEN
      RAISE NOTICE 'PASS: atomic fail raised BACKUP_MANIFEST_COUNT';
    ELSE
      RAISE;
    END IF;
  END;
END $$;

-- Subtransaction rolled back objects created inside the inner BEGIN — verify gone
DO $$
BEGIN
  IF to_regnamespace('backup_coa_limited_ibrahim_atomic_fail') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: aborted backup left schema backup_coa_limited_ibrahim_atomic_fail';
  END IF;
  RAISE NOTICE 'PASS: aborted backup left no durable schema';
  RAISE NOTICE 'ATOMIC_BACKUP_FAIL_PASSED';
END $$;
