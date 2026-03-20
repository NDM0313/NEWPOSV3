-- Void two legacy unbalanced EXP-* sale journal entries found by Integrity Lab.
-- Root cause: old extra-expense sale posting created duplicate/unbalanced vouchers
-- (both lines debit, no credit). Engine path is now deprecated/no-op.
--
-- Safety:
-- - No delete.
-- - Only specific JE ids.
-- - Only when currently unbalanced and not already void.

DO $$
DECLARE
  v_company_id UUID := 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
  v_voided_count INT := 0;
BEGIN
  WITH candidates AS (
    SELECT je.id
    FROM public.journal_entries je
    JOIN (
      SELECT
        journal_entry_id,
        ROUND(SUM(COALESCE(debit, 0) - COALESCE(credit, 0))::numeric, 2) AS diff
      FROM public.journal_entry_lines
      GROUP BY journal_entry_id
    ) s ON s.journal_entry_id = je.id
    WHERE je.company_id = v_company_id
      AND COALESCE(je.is_void, false) = false
      AND je.id IN (
        'dc2fd0f9-dd66-4e52-876c-bad2021bcfe7', -- EXP-0001, diff 3000
        '4bce1498-bae8-40d8-9eb5-a3aca8d0239f'  -- EXP-0002, diff 10000
      )
      AND ABS(s.diff) >= 0.01
  )
  UPDATE public.journal_entries je
  SET
    is_void = true,
    void_reason = 'Integrity Lab repair 2026-03-20: legacy unbalanced EXP sale voucher (double-debit).',
    voided_at = NOW(),
    updated_at = NOW()
  FROM candidates c
  WHERE je.id = c.id;

  GET DIAGNOSTICS v_voided_count = ROW_COUNT;
  RAISE NOTICE 'Void repair applied. Rows voided: %', v_voided_count;
END $$;
