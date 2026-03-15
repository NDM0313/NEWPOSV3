-- ============================================================================
-- Legacy Supplier Payment Cleanup PREVIEW (Phase 4)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Identifies duplicate JEs: standalone "Purchase" JEs (no payment_id) that
-- match a canonical payment-linked JE (same reference_id, date, amount).
-- Apply will MARK these (description suffix), not delete.
-- ============================================================================

-- 1) Standalone purchase JEs that are duplicates of a payment-linked JE
WITH payment_linked_jes AS (
  SELECT je.id, je.payment_id, je.entry_date, je.reference_id,
         (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) AS total_debit
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND je.payment_id IS NOT NULL
),
standalone_purchase_jes AS (
  SELECT je.id, je.entry_no, je.entry_date, je.reference_id, je.description, je.created_at,
         (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) AS total_debit
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND LOWER(COALESCE(je.reference_type, '')) = 'purchase'
    AND je.payment_id IS NULL
),
duplicate_pairs AS (
  SELECT sp.id AS standalone_je_id, pj.id AS canonical_je_id, sp.entry_no, sp.entry_date, sp.reference_id, sp.total_debit AS amount
  FROM standalone_purchase_jes sp
  JOIN payment_linked_jes pj
    ON pj.reference_id IS NOT DISTINCT FROM sp.reference_id
    AND pj.entry_date = sp.entry_date
    AND ABS(COALESCE(sp.total_debit, 0) - COALESCE(pj.total_debit, 0)) < 0.01
)
SELECT
  dp.standalone_je_id AS journal_entry_id_to_mark,
  dp.canonical_je_id,
  dp.entry_no,
  dp.entry_date,
  dp.reference_id AS purchase_id,
  dp.amount,
  'Will append [LEGACY DUPLICATE] to description' AS action
FROM duplicate_pairs dp
ORDER BY dp.entry_date DESC, dp.standalone_je_id;

-- 2) Count summary
WITH payment_linked_jes AS (
  SELECT je.id, je.entry_date, je.reference_id,
         (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) AS total_debit
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND je.payment_id IS NOT NULL
),
standalone_purchase_jes AS (
  SELECT je.id, je.entry_date, je.reference_id,
         (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) AS total_debit
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND LOWER(COALESCE(je.reference_type, '')) = 'purchase' AND je.payment_id IS NULL
)
SELECT COUNT(*) AS duplicate_standalone_jes_to_mark
FROM standalone_purchase_jes sp
JOIN payment_linked_jes pj
  ON pj.reference_id IS NOT DISTINCT FROM sp.reference_id
  AND pj.entry_date = sp.entry_date
  AND ABS(COALESCE(sp.total_debit, 0) - COALESCE(pj.total_debit, 0)) < 0.01;
