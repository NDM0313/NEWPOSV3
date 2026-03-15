-- supplier_ledger_gap.sql
-- Identify payments that should appear in supplier ledger but have missing contact_id or no ledger entry.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5

-- Payments (supplier-related) with NULL contact_id
SELECT
  'payments_missing_contact' AS gap_type,
  p.id,
  p.reference_type,
  p.reference_id,
  p.contact_id,
  p.amount,
  p.payment_date,
  p.reference_number
FROM payments p
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.payment_type = 'paid'
  AND p.reference_type IN ('manual_payment', 'purchase', 'on_account')
  AND p.contact_id IS NULL;

-- Purchase-linked payments: we can infer contact from purchases.supplier_id
SELECT
  'purchase_payment_inferrable' AS gap_type,
  p.id AS payment_id,
  p.reference_id AS purchase_id,
  pur.supplier_id AS inferred_contact_id,
  pur.supplier_name
FROM payments p
JOIN purchases pur ON pur.id = p.reference_id AND pur.company_id = p.company_id
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type = 'purchase'
  AND p.contact_id IS NULL;

-- Counts summary
SELECT
  (SELECT COUNT(*) FROM payments WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND reference_type = 'manual_payment' AND contact_id IS NULL) AS manual_missing_contact,
  (SELECT COUNT(*) FROM payments WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND reference_type = 'purchase' AND contact_id IS NULL) AS purchase_missing_contact,
  (SELECT COUNT(*) FROM payments WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND reference_type = 'on_account' AND contact_id IS NULL) AS on_account_missing_contact;
