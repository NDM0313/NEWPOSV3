BEGIN;

UPDATE journal_entries
SET entry_date = '2026-05-27',
    updated_at = NOW()
WHERE entry_no ILIKE 'JE-0171'
  AND (is_void IS NULL OR is_void = false);

COMMIT;

SELECT id, entry_no, entry_date, created_at, reference_type, description
FROM journal_entries
WHERE entry_no ILIKE 'JE-0171';
