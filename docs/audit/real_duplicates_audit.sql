-- Real duplicate and gap audit. Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run in Supabase SQL Editor (no placeholders).

-- 1) Accounts: duplicate (company_id, normalized name) and courier children under 2030
SELECT 'accounts_duplicate_name' AS check_type, company_id, LOWER(TRIM(name)) AS norm_name, COUNT(*) AS cnt, array_agg(id) AS ids
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
GROUP BY company_id, LOWER(TRIM(name))
HAVING COUNT(*) > 1;

SELECT 'accounts_courier_children' AS check_type, id, code, name, parent_id
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (parent_id IS NOT NULL OR code LIKE '2030%' OR LOWER(COALESCE(name,'')) LIKE '%courier%payable%')
ORDER BY code;

-- 2) Couriers: duplicate normalized name per company
SELECT 'couriers_duplicate_name' AS check_type, company_id, LOWER(TRIM(COALESCE(name,''))) AS norm_name, COUNT(*) AS cnt, array_agg(id) AS ids
FROM couriers
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
GROUP BY company_id, LOWER(TRIM(COALESCE(name,'')))
HAVING COUNT(*) > 1;

-- 3) Payments: supplier-related with NULL contact_id (purchase or on_account)
SELECT 'payments_supplier_null_contact' AS check_type, id, reference_type, reference_id, amount, payment_date
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (LOWER(COALESCE(reference_type,'')) IN ('purchase','on_account'))
  AND (contact_id IS NULL)
ORDER BY payment_date DESC
LIMIT 50;

-- 4) Ledger: supplier ledger entries whose reference_id (payment_id) has payment.contact_id NULL
SELECT 'ledger_entries_payment_missing_contact' AS check_type, le.id, le.ledger_id, le.reference_id AS payment_or_purchase_id, le.source
FROM ledger_entries le
JOIN ledger_master lm ON lm.id = le.ledger_id AND lm.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND lm.ledger_type = 'supplier'
WHERE le.source = 'payment' AND le.reference_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = le.reference_id AND p.contact_id IS NOT NULL)
LIMIT 50;
