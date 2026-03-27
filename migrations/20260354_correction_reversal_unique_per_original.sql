-- PF-07: Prevent duplicate correction_reversal rows for the same original journal entry (race / double-click).
-- Keeps the earliest active reversal; voids extras so GL net is not doubled.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, reference_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM journal_entries
  WHERE reference_type = 'correction_reversal'
    AND COALESCE(is_void, false) = false
)
UPDATE journal_entries je
SET is_void = true
FROM ranked r
WHERE je.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_correction_reversal_one_per_original
  ON journal_entries (company_id, reference_id)
  WHERE reference_type = 'correction_reversal'
    AND COALESCE(is_void, false) = false;

COMMENT ON INDEX idx_journal_entries_correction_reversal_one_per_original IS
  'At most one non-void correction_reversal per original JE (reference_id = reversed journal id).';
