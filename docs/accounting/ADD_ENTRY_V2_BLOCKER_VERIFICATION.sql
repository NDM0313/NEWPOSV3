-- Add Entry V2 Blocker Fix – Verification SQL
-- Run after one Customer Receipt and one Courier Payment.
--
-- OPTION A: Use first company (no edit needed) – run the block below.
-- OPTION B: Use a specific company – find-replace YOUR_COMPANY_UUID_HERE with a valid UUID
--           (e.g. eb71d817-b87e-4195-964b-7b5321b480f5). The literal 'REPLACE_WITH_YOUR_COMPANY_UUID'
--           is not a valid UUID and will cause: invalid input syntax for type uuid.

-- ========== OPTION A: First company (run each query separately if your client runs one at a time) ==========

-- 1) Latest manual_receipt payments (customer receipt) – contact_id must be set to customer
SELECT id, reference_number, contact_id, amount, payment_date, reference_type
FROM payments
WHERE company_id = (SELECT id FROM companies LIMIT 1) AND reference_type = 'manual_receipt'
ORDER BY payment_date DESC, created_at DESC
LIMIT 10;

-- 2) Latest courier_payment payments – contact_id may be NULL if courier contact invalid
SELECT id, reference_number, reference_id, contact_id, amount, payment_date, reference_type
FROM payments
WHERE company_id = (SELECT id FROM companies LIMIT 1) AND reference_type = 'courier_payment'
ORDER BY payment_date DESC, created_at DESC
LIMIT 10;

-- 3) JEs for manual_receipt and courier_payment with payment_id set
SELECT je.id, je.entry_no, je.reference_type, je.payment_id, je.entry_date
FROM journal_entries je
WHERE je.company_id = (SELECT id FROM companies LIMIT 1)
  AND je.reference_type IN ('manual_receipt', 'courier_payment')
ORDER BY je.entry_date DESC
LIMIT 10;

-- 4) Customer ledger source: payments by contact (manual_receipt + on_account) feed getCustomerLedger
SELECT p.id, p.reference_type, p.contact_id, p.amount, p.payment_date
FROM payments p
WHERE p.company_id = (SELECT id FROM companies LIMIT 1)
  AND p.contact_id IS NOT NULL
  AND p.reference_type IN ('manual_receipt', 'on_account', 'sale')
ORDER BY p.payment_date DESC
LIMIT 15;

-- 5) Courier payment → JE link (one-to-one)
SELECT p.id AS payment_id, p.reference_type, p.contact_id, je.id AS journal_entry_id, je.payment_id
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.company_id = (SELECT id FROM companies LIMIT 1) AND p.reference_type = 'courier_payment'
ORDER BY p.payment_date DESC
LIMIT 5;

-- 6) No FK violation: payments.contact_id must exist in contacts (should be 0 rows after fix)
SELECT p.id, p.reference_type, p.contact_id
FROM payments p
LEFT JOIN contacts c ON c.id = p.contact_id
WHERE p.company_id = (SELECT id FROM companies LIMIT 1)
  AND p.contact_id IS NOT NULL
  AND c.id IS NULL;
