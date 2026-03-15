-- supplier_contact_backfill_apply.sql
-- APPLY: Set payments.contact_id from purchases.supplier_id for purchase-linked payments where contact_id IS NULL.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Idempotent: only updates rows where contact_id IS NULL.
-- Run with company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'

UPDATE payments p
SET contact_id = pur.supplier_id,
    updated_at = NOW()
FROM purchases pur
WHERE pur.id = p.reference_id
  AND pur.company_id = p.company_id
  AND p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type = 'purchase'
  AND p.contact_id IS NULL
  AND pur.supplier_id IS NOT NULL;

-- Optional: return count (run as separate SELECT if your client supports it)
-- SELECT COUNT(*) FROM payments p JOIN purchases pur ON pur.id = p.reference_id
-- WHERE p.company_id = :'company_id' AND p.reference_type = 'purchase' AND p.contact_id IS NULL AND pur.supplier_id IS NOT NULL;
