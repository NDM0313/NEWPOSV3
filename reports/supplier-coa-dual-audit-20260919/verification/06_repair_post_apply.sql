-- Post repair-package verification: repeat no-op, drift abort, rollback conflict.
\set ON_ERROR_STOP on

DO $$
DECLARE
  n int;
  ap uuid := '2c56a1d1-e31d-433f-85af-ce3fd4729312';
BEGIN
  SELECT COUNT(*) INTO n
  FROM backup_coa_limited_ibrahim_v1.manifest m
  JOIN journal_entry_lines jel ON jel.id = m.line_id
  WHERE jel.account_id = m.to_account_id;
  IF n <> 2 THEN
    RAISE EXCEPTION 'FAIL: after apply expected 2 lines on AP, got %', n;
  END IF;
  RAISE NOTICE 'PASS: apply moved 2 IBRAHIM lines';
END $$;

-- Repeat apply → already-applied no-op (re-run 02 body check)
DO $$
DECLARE
  n_already int;
BEGIN
  SELECT COUNT(*) INTO n_already
  FROM backup_coa_limited_ibrahim_v1.manifest m
  JOIN journal_entry_lines jel ON jel.id = m.line_id
  WHERE jel.account_id = m.to_account_id
    AND round(jel.debit, 2) = m.expected_debit
    AND round(jel.credit, 2) = m.expected_credit;
  IF n_already = 2 THEN
    RAISE NOTICE 'PASS: repeat apply would be ALREADY_APPLIED no-op';
  ELSE
    RAISE EXCEPTION 'FAIL: expected already applied state';
  END IF;
END $$;

-- Post-apply edit → rollback must abort
UPDATE journal_entry_lines
SET debit = debit + 0.01
WHERE id = '677c74de-b677-4a6f-877f-b13e0ac66aaa';

DO $$
DECLARE
  r RECORD;
  aborted boolean := false;
BEGIN
  FOR r IN
    SELECT m.*, p.account_id AS post_account_id
    FROM backup_coa_limited_ibrahim_v1.manifest m
    JOIN backup_coa_limited_ibrahim_v1.post_apply_lines p ON p.id = m.line_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM journal_entry_lines jel
      WHERE jel.id = r.line_id
        AND jel.account_id = r.post_account_id
        AND round(jel.debit, 2) = r.expected_debit
        AND round(jel.credit, 2) = r.expected_credit
    ) THEN
      aborted := true;
      RAISE NOTICE 'PASS: post-apply edit detected — rollback would abort for %', r.line_id;
      EXIT;
    END IF;
  END LOOP;
  IF NOT aborted THEN
    RAISE EXCEPTION 'FAIL: expected drift after debit tweak';
  END IF;
END $$;

-- Restore amount for clean rollback test
UPDATE journal_entry_lines
SET debit = 19000
WHERE id = '677c74de-b677-4a6f-877f-b13e0ac66aaa';

DO $$
BEGIN
  RAISE NOTICE 'REPAIR_POST_CHECKS_READY_FOR_ROLLBACK';
END $$;
