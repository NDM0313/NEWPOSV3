-- PF-14.4: Verification – idempotent posting and void filtering.
-- Ensures: no new duplicates after fix; voided entries excluded from counts.

-- 1) Count sale_adjustment JEs per (sale_id, description) – should be 1 each after idempotency + cleanup
SELECT reference_id AS sale_id, description, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type = 'sale_adjustment'
  AND (is_void IS NOT TRUE)
GROUP BY reference_id, description
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates in business view).

-- 2) Count payment_adjustment JEs per (payment_id, description) – should be 1 each
SELECT reference_id AS payment_id, description, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type = 'payment_adjustment'
  AND (is_void IS NOT TRUE)
GROUP BY reference_id, description
HAVING COUNT(*) > 1;
-- Expected: 0 rows.

-- 3) Voided entries count (for audit; business reports exclude these)
SELECT reference_type, COUNT(*) AS voided_count
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND is_void = true
GROUP BY reference_type
ORDER BY reference_type;

-- 4) Total JEs by type (non-void only)
SELECT reference_type, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND (is_void IS NOT TRUE)
GROUP BY reference_type
ORDER BY reference_type;
