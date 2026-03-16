-- Backfill payments.contact_id for purchase-linked payments where contact_id is NULL.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5. Idempotent.

UPDATE payments p
SET contact_id = pur.supplier_id
FROM purchases pur
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type = 'purchase'
  AND p.reference_id = pur.id
  AND p.contact_id IS NULL
  AND pur.supplier_id IS NOT NULL;
