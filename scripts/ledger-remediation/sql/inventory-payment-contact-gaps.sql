-- Payment contact gaps: sale-linked payments with NULL contact_id (Phase 1.6 inventory)
-- Matches v_single_core_ledger_company_diagnostics payments_missing_contact_sale_linked predicate.

SELECT
  p.id AS payment_id,
  p.reference_number,
  p.reference_type,
  p.reference_id AS sale_id,
  p.contact_id AS old_contact_id,
  s.invoice_no,
  s.customer_id AS proposed_contact_id,
  s.status AS sale_status,
  s.cancelled_at AS sale_cancelled_at,
  p.company_id,
  c.name AS company_name,
  p.branch_id,
  ct.code AS proposed_contact_code,
  ct.name AS proposed_contact_name,
  EXISTS (
    SELECT 1
    FROM payment_allocations pa
    INNER JOIN sales sa ON sa.id = pa.sale_id AND sa.company_id = p.company_id
    WHERE pa.payment_id = p.id
      AND sa.customer_id IS DISTINCT FROM s.customer_id
  ) AS allocation_customer_conflict
FROM payments p
INNER JOIN sales s ON s.id = p.reference_id AND s.company_id = p.company_id
INNER JOIN companies c ON c.id = p.company_id
LEFT JOIN contacts ct ON ct.id = s.customer_id
WHERE LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'sale'
  AND p.contact_id IS NULL
  AND p.voided_at IS NULL
  AND s.customer_id IS NOT NULL
  AND ($1::uuid IS NULL OR p.company_id = $1::uuid)
ORDER BY c.name, p.reference_number NULLS LAST, p.id;
