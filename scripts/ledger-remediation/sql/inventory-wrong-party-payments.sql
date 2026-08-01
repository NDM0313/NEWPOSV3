-- Wrong-party sale-linked payments (for exclusion from safe_apply backfill)
SELECT
  p.id AS payment_id,
  p.company_id,
  c.name AS company_name
FROM payments p
INNER JOIN sales s ON s.id = p.reference_id AND s.company_id = p.company_id
INNER JOIN companies c ON c.id = p.company_id
WHERE LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'sale'
  AND p.contact_id IS NOT NULL
  AND p.contact_id IS DISTINCT FROM s.customer_id
  AND p.voided_at IS NULL
  AND ($1::uuid IS NULL OR p.company_id = $1::uuid);
