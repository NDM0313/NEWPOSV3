-- Backfill null payments.branch_id from linked journal_entries or sales (preview first).
-- Safe: only sets branch_id on payments rows; does not change amounts or GL.

-- 1) manual_receipt / manual_payment linked to journal entry
UPDATE payments p
SET branch_id = je.branch_id
FROM journal_entries je
WHERE p.branch_id IS NULL
  AND p.voided_at IS NULL
  AND p.reference_type IN ('manual_receipt', 'manual_payment')
  AND je.id::text = p.reference_id::text
  AND je.branch_id IS NOT NULL;

-- 2) sale-linked payments
UPDATE payments p
SET branch_id = s.branch_id
FROM sales s
WHERE p.branch_id IS NULL
  AND p.voided_at IS NULL
  AND p.reference_type = 'sale'
  AND s.id::text = p.reference_id::text
  AND s.branch_id IS NOT NULL;

-- 3) journal entries (general) still null — optional second pass from user's default branch (manual)
-- UPDATE journal_entries je SET branch_id = '<branch-uuid>' WHERE je.reference_type = 'general' AND je.branch_id IS NULL;
