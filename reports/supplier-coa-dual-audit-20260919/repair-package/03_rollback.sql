-- IBRAHIM Class B rollback via privileged repair_restore RPC.
-- Compares live state to post_apply_lines; aborts on later edits.
-- ID LACE: NOT IMPLEMENTED.

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  r RECORD;
  n int;
  n_restored int := 0;
BEGIN
  IF to_regclass('backup_coa_limited_ibrahim_v1.post_apply_lines') IS NULL THEN
    RAISE EXCEPTION 'MISSING_POST_APPLY: cannot rollback without post_apply_lines from 02_apply';
  END IF;
  IF to_regclass('backup_coa_limited_ibrahim_v1.pre_apply_lines') IS NULL THEN
    RAISE EXCEPTION 'MISSING_PRE_APPLY_BACKUP';
  END IF;
  IF to_regclass('backup_coa_limited_ibrahim_v1.manifest') IS NULL THEN
    RAISE EXCEPTION 'MISSING_MANIFEST';
  END IF;

  -- Already rolled back?
  SELECT COUNT(*) INTO n
  FROM backup_coa_limited_ibrahim_v1.manifest m
  JOIN journal_entry_lines jel ON jel.id = m.line_id
  WHERE jel.account_id = m.from_account_id
    AND round(jel.debit, 2) = m.expected_debit
    AND round(jel.credit, 2) = m.expected_credit
    AND jel.journal_entry_id = m.journal_entry_id;
  IF n = 2 THEN
    RAISE NOTICE 'ALREADY_ROLLED_BACK: safe no-op stop';
    RETURN;
  END IF;

  FOR r IN
    SELECT m.*, p.account_id AS post_account_id
    FROM backup_coa_limited_ibrahim_v1.manifest m
    JOIN backup_coa_limited_ibrahim_v1.post_apply_lines p ON p.id = m.line_id
    ORDER BY m.line_id
  LOOP
    -- Live must still match recorded post-apply (no later edits)
    IF NOT EXISTS (
      SELECT 1 FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.id = r.line_id
        AND jel.account_id = r.post_account_id
        AND jel.account_id = r.to_account_id
        AND round(jel.debit, 2) = r.expected_debit
        AND round(jel.credit, 2) = r.expected_credit
        AND jel.journal_entry_id = r.journal_entry_id
        AND je.company_id = r.company_id
        AND COALESCE(je.is_void, false) = false
    ) THEN
      RAISE EXCEPTION 'ROLLBACK_DRIFT: line % edited after apply — abort (will not move blindly)', r.line_id;
    END IF;

    PERFORM public.repair_restore_journal_entry_line_account(
      r.company_id,
      r.line_id,
      r.to_account_id,
      r.from_account_id,
      r.expected_debit,
      r.expected_credit,
      r.journal_entry_id
    );
    n_restored := n_restored + 1;
  END LOOP;

  IF n_restored <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK_COUNT % <> 2', n_restored;
  END IF;

  SELECT COUNT(*) INTO n
  FROM backup_coa_limited_ibrahim_v1.manifest m
  JOIN journal_entry_lines jel ON jel.id = m.line_id
  WHERE jel.account_id = m.from_account_id;
  IF n <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK_VERIFY_FAILED: expected both lines on legacy account';
  END IF;

  RAISE NOTICE 'ROLLBACK_OK: restored 2 IBRAHIM lines via repair_restore';
END $$;

COMMIT;
