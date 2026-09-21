-- Post-apply verification after running the ACTUAL 02_apply.sql twice.
\set ON_ERROR_STOP on
DO $$
DECLARE n int; post_n int;
BEGIN
  SELECT COUNT(*) INTO n
  FROM backup_coa_limited_ibrahim_v1.manifest m
  JOIN journal_entry_lines jel ON jel.id = m.line_id
  WHERE jel.account_id = m.to_account_id
    AND round(jel.debit, 2) = m.expected_debit
    AND round(jel.credit, 2) = m.expected_credit
    AND jel.journal_entry_id = m.journal_entry_id;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: after actual apply/repeat expected 2 exact lines on AP, got %', n; END IF;
  SELECT COUNT(*) INTO post_n FROM backup_coa_limited_ibrahim_v1.post_apply_lines;
  IF post_n <> 2 THEN RAISE EXCEPTION 'FAIL: post_apply_lines expected 2 immutable rows, got %', post_n; END IF;
  RAISE NOTICE 'PASS: actual apply moved 2 IBRAHIM lines and repeat apply was exercised by harness';
  RAISE NOTICE 'REPAIR_POST_APPLY_VERIFIED';
END $$;
