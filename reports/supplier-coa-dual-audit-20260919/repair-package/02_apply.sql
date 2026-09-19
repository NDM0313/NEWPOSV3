-- Repair apply: IBRAHIM Class B only. Requires guard migration already applied.
-- Moves exact line IDs to active AP (assert original account_id). No GUC needed for apply.

BEGIN;

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
    AND COALESCE(je.is_void, false) = false;
  IF n <> 2 THEN
    RAISE EXCEPTION 'IBRAHIM legacy open line count % <> 2 — abort', n;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM journal_account_verified_remaps
    WHERE company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
      AND from_account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
      AND to_account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
  ) THEN
    RAISE EXCEPTION 'IBRAHIM verified remap missing — abort (do not claim automatic protection)';
  END IF;
END $$;

UPDATE journal_entry_lines jel
SET account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
AND jel.account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n FROM journal_entry_lines
  WHERE id IN (
    '677c74de-b677-4a6f-877f-b13e0ac66aaa',
    '343c2586-2d86-4c24-9e03-3af493dada9d'
  ) AND account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312';
  IF n <> 2 THEN
    RAISE EXCEPTION 'IBRAHIM apply incomplete: % lines on AP (expected 2)', n;
  END IF;
END $$;

COMMIT;
