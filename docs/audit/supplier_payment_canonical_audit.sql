-- ============================================================================
-- Supplier Payment Canonical Audit (Phase-3)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Payments row + journal entry mapping for supplier payments (purchase & on_account).
-- Canonical: 1 payment = 1 journal entry (payment_id linked).
-- ============================================================================

-- 1) Supplier payments (payments table) with linked journal entry
SELECT
  p.id AS payment_id,
  p.reference_number,
  p.reference_type,
  p.reference_id,
  p.contact_id,
  p.amount,
  p.payment_date,
  p.payment_account_id,
  je.id AS journal_entry_id,
  je.entry_no,
  je.payment_id AS je_payment_id,
  CASE WHEN je.id IS NOT NULL AND je.payment_id = p.id THEN 'OK' ELSE 'MISSING/LINK' END AS link_status
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type IN ('purchase', 'on_account')
ORDER BY p.payment_date DESC, p.created_at DESC
LIMIT 100;

-- 2) Payments without a linked journal entry (gap)
SELECT
  p.id AS payment_id,
  p.reference_number,
  p.reference_type,
  p.amount,
  p.payment_date,
  p.created_at
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type IN ('purchase', 'on_account')
  AND je.id IS NULL
ORDER BY p.payment_date DESC;

-- 3) Journal entries with reference_type purchase/on_account and payment_id set (canonical)
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  p.reference_number AS payment_ref,
  p.amount
FROM journal_entries je
JOIN payments p ON p.id = je.payment_id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND LOWER(COALESCE(je.reference_type, '')) IN ('purchase', 'on_account')
ORDER BY je.entry_date DESC, je.created_at DESC
LIMIT 100;
