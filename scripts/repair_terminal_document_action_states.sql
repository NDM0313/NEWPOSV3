-- repair_terminal_document_action_states.sql
-- Safe, audit-preserving helpers. Default: diagnostics only (no UPDATE).
--
-- Policy in the app does NOT require mutating original journal headers when a
-- correction_reversal already exists — terminal state is derived from the child row.
-- Use this script to INSPECT edge cases (e.g. duplicate active reversals) before any manual fix.

-- A) List originals that would be "double-reversed" if a second active reversal existed
--    (app idempotency expects at most one active correction_reversal per original).
SELECT orig.company_id,
       orig.id AS original_id,
       orig.entry_no AS original_entry_no,
       orig.reference_type,
       COUNT(rev.id)::int AS active_reversal_je_count
FROM journal_entries orig
JOIN journal_entries rev
  ON rev.company_id = orig.company_id
 AND rev.reference_type = 'correction_reversal'
 AND rev.reference_id::text = orig.id::text
 AND (rev.is_void IS NULL OR rev.is_void = false)
WHERE (orig.is_void IS NULL OR orig.is_void = false)
GROUP BY orig.company_id, orig.id, orig.entry_no, orig.reference_type
HAVING COUNT(rev.id) > 1;

-- B) OPTIONAL manual repair (commented): void DUPLICATE reversal JEs, keeping the OLDEST
--    by created_at. Only run after backup and human review. Uncomment and set company_id.
/*
WITH ranked AS (
  SELECT id,
         company_id,
         reference_id,
         created_at,
         ROW_NUMBER() OVER (PARTITION BY company_id, reference_id ORDER BY created_at ASC) AS rn
  FROM journal_entries
  WHERE reference_type = 'correction_reversal'
    AND (is_void IS NULL OR is_void = false)
    AND company_id = 'YOUR_COMPANY_UUID'
)
UPDATE journal_entries je
SET is_void = true,
    updated_at = now()
FROM ranked r
WHERE je.id = r.id
  AND r.rn > 1;
*/
