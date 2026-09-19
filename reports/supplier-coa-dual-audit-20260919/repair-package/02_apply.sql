-- DO NOT RUN until 00_readonly_verify + 01_backup succeed and owner approves.
-- IBRAHIM Class B only. ID LACE Class C is commented out.

BEGIN;

-- Guard: refuse if line count on legacy changed
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
END $$;

UPDATE journal_entry_lines jel
SET account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
AND jel.account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';

-- Optional ID LACE (owner OK only):
-- UPDATE journal_entry_lines jel
-- SET account_id = '30bbe521-5773-4985-8be1-0d336c56a6a3'
-- FROM journal_entries je
-- WHERE je.id = jel.journal_entry_id
--   AND jel.account_id = 'e11d244a-b96e-4128-8ca3-2bae5a4f813c'
--   AND COALESCE(je.is_void, false) = false;
-- UPDATE accounts SET is_active = false, linked_contact_id = null
-- WHERE id = 'e11d244a-b96e-4128-8ca3-2bae5a4f813c';

COMMIT;
