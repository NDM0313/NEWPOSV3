-- supplier_manual_payment_trace.sql
-- Trace manual supplier payment flow: payments + journal_entries + ledger_entries for company.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5

-- 1) Payments with reference_type in ('manual_payment','purchase','on_account') and contact_id status
SELECT
  id,
  reference_type,
  reference_id,
  contact_id,
  amount,
  payment_date,
  reference_number,
  payment_type
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type IN ('manual_payment', 'purchase', 'on_account')
ORDER BY payment_date DESC, created_at DESC
LIMIT 50;

-- 2) Journal entries linked to those payments (by payment_id)
SELECT
  je.id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  p.contact_id AS payment_contact_id
FROM journal_entries je
LEFT JOIN payments p ON p.id = je.payment_id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (je.reference_type IN ('manual_payment', 'purchase', 'on_account') OR je.payment_id IS NOT NULL)
ORDER BY je.entry_date DESC
LIMIT 50;

-- 3) Ledger_entries for supplier ledgers (payment source)
SELECT
  le.id,
  le.ledger_id,
  lm.entity_id AS supplier_contact_id,
  lm.entity_name,
  le.entry_date,
  le.source,
  le.reference_id,
  le.debit,
  le.credit
FROM ledger_entries le
JOIN ledger_master lm ON lm.id = le.ledger_id AND lm.ledger_type = 'supplier'
WHERE le.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND le.source = 'payment'
ORDER BY le.entry_date DESC
LIMIT 30;
