-- Rollback ONLY remapped line IDs from backup_coa_limited_YYYYMMDDHHMM.
-- Replace schema name before running.

BEGIN;

UPDATE journal_entry_lines jel
SET account_id = b.account_id
FROM backup_coa_limited_YYYYMMDDHHMM.journal_entry_lines b
WHERE jel.id = b.id
  AND jel.id IN (
    '677c74de-b677-4a6f-877f-b13e0ac66aaa',
    '343c2586-2d86-4c24-9e03-3af493dada9d'
  );

COMMIT;
