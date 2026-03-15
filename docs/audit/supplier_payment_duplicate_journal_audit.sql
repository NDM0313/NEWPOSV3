-- ============================================================================
-- Supplier Payment Duplicate Journal Audit (Phase-3)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Detects supplier payment events that created more than one journal entry
-- (e.g. one from payment flow, one from recordSupplierPayment).
-- ============================================================================

-- 1) Payments (purchase or on_account) with more than one JE linked by payment_id
SELECT
  p.id AS payment_id,
  p.reference_number,
  p.reference_type,
  p.reference_id,
  p.amount,
  p.payment_date,
  COUNT(je.id) AS journal_entry_count,
  array_agg(je.id ORDER BY je.created_at) AS journal_entry_ids
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type IN ('purchase', 'on_account')
GROUP BY p.id, p.reference_number, p.reference_type, p.reference_id, p.amount, p.payment_date
HAVING COUNT(je.id) > 1
ORDER BY p.payment_date DESC;

-- 2) JEs with reference_type 'purchase' that have no payment_id (legacy duplicate from recordSupplierPayment)
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.description,
  je.created_at
FROM journal_entries je
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND LOWER(COALESCE(je.reference_type, '')) = 'purchase'
  AND je.payment_id IS NULL
ORDER BY je.entry_date DESC, je.created_at DESC
LIMIT 100;

-- 3) Same-day, same-amount pairs: purchase payment + standalone Purchase JE (possible duplicate)
WITH payment_jes AS (
  SELECT je.id, je.payment_id, je.entry_date, je.reference_id,
         (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) AS total_debit
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND je.payment_id IS NOT NULL
),
standalone_purchase_jes AS (
  SELECT je.id, je.entry_date, je.reference_id,
         (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) AS total_debit
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND LOWER(COALESCE(je.reference_type, '')) = 'purchase'
    AND je.payment_id IS NULL
)
SELECT
  pj.id AS linked_je_id,
  sp.id AS standalone_je_id,
  pj.entry_date,
  pj.reference_id AS purchase_id,
  pj.total_debit AS amount
FROM payment_jes pj
JOIN standalone_purchase_jes sp
  ON sp.reference_id = pj.reference_id
  AND sp.entry_date = pj.entry_date
  AND ABS(COALESCE(sp.total_debit, 0) - COALESCE(pj.total_debit, 0)) < 0.01
ORDER BY pj.entry_date DESC
LIMIT 50;
