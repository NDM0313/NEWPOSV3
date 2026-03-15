-- supplier_contact_backfill_preview.sql
-- PREVIEW: Rows that would be updated to set payments.contact_id (safe, inferrable only).
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run preview first; then run supplier_contact_backfill_apply.sql to apply.

-- 1) Purchase-linked: set contact_id = purchases.supplier_id where contact_id IS NULL
SELECT
  p.id AS payment_id,
  p.reference_type,
  p.reference_id AS purchase_id,
  p.contact_id AS current_contact_id,
  pur.supplier_id AS new_contact_id,
  pur.supplier_name
FROM payments p
JOIN purchases pur ON pur.id = p.reference_id AND pur.company_id = p.company_id
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type = 'purchase'
  AND p.contact_id IS NULL
  AND pur.supplier_id IS NOT NULL;

-- 2) On-account: already require contactId in app; no safe inference from elsewhere. Skip.
-- 3) Manual_payment: no deterministic inference (no purchase/reference). Skip in backfill.

-- Count of rows that would be updated (purchase only)
SELECT COUNT(*) AS rows_to_update
FROM payments p
JOIN purchases pur ON pur.id = p.reference_id AND pur.company_id = p.company_id
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type = 'purchase'
  AND p.contact_id IS NULL
  AND pur.supplier_id IS NOT NULL;
