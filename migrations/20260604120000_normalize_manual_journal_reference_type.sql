-- Align legacy pure manual journal rows with Add Entry V2 convention (reference_type = journal).
-- Safe additive data fix: no trigger or schema changes.

UPDATE journal_entries
SET reference_type = 'journal'
WHERE reference_type = 'manual'
  AND payment_id IS NULL
  AND COALESCE(is_void, false) = false;
