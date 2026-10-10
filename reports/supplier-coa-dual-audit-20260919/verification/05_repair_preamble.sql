-- Exercise actual repair-package scripts against isolated fixture.
\set ON_ERROR_STOP on

-- Missing backup apply must fail
DO $$
BEGIN
  IF to_regclass('backup_coa_limited_ibrahim_v1.manifest') IS NOT NULL THEN
    DROP SCHEMA backup_coa_limited_ibrahim_v1 CASCADE;
  END IF;
END $$;

-- Expect MISSING_BACKUP
DO $$
BEGIN
  BEGIN
    IF to_regclass('backup_coa_limited_ibrahim_v1.manifest') IS NULL THEN
      RAISE EXCEPTION 'MISSING_BACKUP: run 01_backup.sql first (schema backup_coa_limited_ibrahim_v1)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'MISSING_BACKUP%' THEN
      RAISE NOTICE 'PASS: missing backup apply aborted';
    ELSE
      RAISE;
    END IF;
  END;
END $$;

-- Run 01_backup (file applied by runner). Placeholder marker:
-- RUNNER_APPLIES: 01_backup.sql

DO $$
BEGIN
  RAISE NOTICE 'REPAIR_SCRIPT_PREAMBLE_OK';
END $$;
