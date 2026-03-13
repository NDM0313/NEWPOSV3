-- Phase 1 Accounting Engine: Debit = Credit validation.
-- Application inserts journal_entry_lines one row at a time, so a per-row balance trigger would
-- fail after the first line. We add a validation function only (for reports/admin/reconciliation).
-- Use: SELECT * FROM check_journal_entries_balance(); to list unbalanced entries.

CREATE OR REPLACE FUNCTION check_journal_entries_balance()
RETURNS TABLE (
  journal_entry_id UUID,
  entry_no VARCHAR(100),
  entry_date DATE,
  total_debit DECIMAL(15,2),
  total_credit DECIMAL(15,2),
  is_balanced BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    je.id,
    je.entry_no,
    je.entry_date,
    COALESCE(SUM(jel.debit), 0)::DECIMAL(15,2),
    COALESCE(SUM(jel.credit), 0)::DECIMAL(15,2),
    (ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) < 0.01)
  FROM journal_entries je
  LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  GROUP BY je.id, je.entry_no, je.entry_date
  HAVING ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) >= 0.01;
END;
$$ LANGUAGE plpgsql STABLE;
