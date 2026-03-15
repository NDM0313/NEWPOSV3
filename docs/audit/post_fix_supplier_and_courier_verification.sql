-- post_fix_supplier_and_courier_verification.sql
-- After fixes: verify payments.contact_id set, supplier ledger consistency, no duplicate JEs.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5

-- 1) Payments with reference_type in ('manual_payment','purchase','on_account'): contact_id should be set
SELECT
  reference_type,
  COUNT(*) AS total,
  COUNT(contact_id) AS with_contact_id,
  COUNT(*) - COUNT(contact_id) AS missing_contact_id
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type IN ('manual_payment', 'purchase', 'on_account')
GROUP BY reference_type;

-- 2) Journal entries with payment_id: one-to-one (no duplicate JE per payment)
SELECT payment_id, COUNT(*) AS je_count
FROM journal_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND payment_id IS NOT NULL
GROUP BY payment_id
HAVING COUNT(*) > 1;

-- 3) Ledger_entries: supplier payment entries count by source
SELECT source, COUNT(*) AS cnt
FROM ledger_entries le
JOIN ledger_master lm ON lm.id = le.ledger_id AND lm.ledger_type = 'supplier'
WHERE le.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
GROUP BY source;

-- 4) Sample: latest supplier payments (payments + contact_id)
SELECT p.id, p.reference_type, p.reference_number, p.amount, p.contact_id, p.payment_date
FROM payments p
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.payment_type = 'paid'
  AND p.reference_type IN ('manual_payment', 'purchase', 'on_account')
ORDER BY p.payment_date DESC
LIMIT 10;
