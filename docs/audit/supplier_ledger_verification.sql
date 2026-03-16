-- Supplier Ledger live write path verification.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run in Supabase SQL Editor. Replace <SUPPLIER_CONTACT_ID> and <PAYMENT_ID> with real ids from a fresh test payment.

-- 1) Supplier contact (e.g. for "SHD" or the one you selected in Manual Entry)
SELECT id, name, type
FROM contacts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (type = 'supplier' OR type = 'both')
ORDER BY name;

-- 2) Payment row (after creating a manual supplier payment: get id from browser Network tab or run this for latest)
SELECT id, company_id, reference_type, reference_id, contact_id, amount, payment_date, reference_number
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type = 'manual_payment'
ORDER BY payment_date DESC, created_at DESC
LIMIT 5;

-- 3) Journal entry linked to that payment (journal_entries.payment_id = payments.id)
SELECT je.id, je.entry_no, je.entry_date, je.reference_type, je.reference_id, je.payment_id, jel.account_id, jel.debit, jel.credit
FROM journal_entries je
LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (je.reference_type = 'manual_payment' OR je.payment_id IS NOT NULL)
ORDER BY je.entry_date DESC, je.created_at DESC
LIMIT 5;

-- 4) Ledger master for supplier (entity_id = contact id)
SELECT id, company_id, ledger_type, entity_id, entity_name, opening_balance
FROM ledger_master
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND ledger_type = 'supplier'
ORDER BY entity_name;

-- 5) Ledger entries for a given supplier ledger (replace <LEDGER_ID> with id from step 4)
-- SELECT id, ledger_id, entry_date, source, reference_id, debit, credit, balance_after
-- FROM ledger_entries
-- WHERE ledger_id = '<LEDGER_ID>'
-- ORDER BY entry_date DESC, created_at DESC
-- LIMIT 20;

-- 6) Last 30 days supplier ledger entries (one ledger): replace <LEDGER_ID>
-- SELECT id, entry_date, source, reference_id, debit, credit, balance_after
-- FROM ledger_entries
-- WHERE ledger_id = '<LEDGER_ID>'
--   AND entry_date >= (CURRENT_DATE - INTERVAL '30 days')::text
--   AND entry_date <= CURRENT_DATE::text
-- ORDER BY entry_date DESC;

-- 7) End-to-end: payment -> ledger_entries (payment must have source='payment', reference_id=payment.id)
SELECT p.id AS payment_id, p.contact_id, p.amount, lm.id AS ledger_id, lm.entity_id, le.id AS ledger_entry_id, le.source, le.reference_id
FROM payments p
LEFT JOIN ledger_master lm ON lm.company_id = p.company_id AND lm.ledger_type = 'supplier' AND lm.entity_id = p.contact_id
LEFT JOIN ledger_entries le ON le.ledger_id = lm.id AND le.source = 'payment' AND le.reference_id = p.id
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type = 'manual_payment'
ORDER BY p.payment_date DESC, p.created_at DESC
LIMIT 10;
