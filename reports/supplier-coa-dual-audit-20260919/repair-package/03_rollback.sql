-- Rollback ONLY remapped line IDs from backup_coa_limited_YYYYMMDDHHMM.
-- Replace schema name before running.
-- CRITICAL: SET LOCAL allow_inactive_restore so the guard does NOT silently remap
-- retired 210026 back to AP during restore.

BEGIN;

SET LOCAL app.journal_account_guard_mode = 'allow_inactive_restore';

UPDATE journal_entry_lines jel
SET account_id = b.account_id
FROM backup_coa_limited_YYYYMMDDHHMM.journal_entry_lines b
WHERE jel.id = b.id
  AND jel.id IN (
    '677c74de-b677-4a6f-877f-b13e0ac66aaa',
    '343c2586-2d86-4c24-9e03-3af493dada9d'
  )
  AND jel.account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
  AND b.account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n FROM journal_entry_lines
  WHERE id IN (
    '677c74de-b677-4a6f-877f-b13e0ac66aaa',
    '343c2586-2d86-4c24-9e03-3af493dada9d'
  ) AND account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';
  IF n <> 2 THEN
    RAISE EXCEPTION 'IBRAHIM rollback incomplete: % lines restored to 210026 (expected 2)', n;
  END IF;
END $$;

COMMIT;
