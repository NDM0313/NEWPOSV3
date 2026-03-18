-- PF-14.5B: Verification – no active duplicate fingerprints; voided excluded from business view.
-- Run after migration pf145_backup_tables_and_fingerprint.sql and any cleanup.

-- 1) No duplicate sale_adjustment (same reference_id, description) among non-void
SELECT reference_id, description, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type = 'sale_adjustment'
  AND (is_void IS NOT TRUE)
GROUP BY reference_id, description
HAVING COUNT(*) > 1;
-- Expected: 0 rows.

-- 2) No duplicate payment_adjustment (same reference_id, description) among non-void
SELECT reference_id, LEFT(description, 80) AS desc_sample, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type = 'payment_adjustment'
  AND (is_void IS NOT TRUE)
GROUP BY reference_id, description
HAVING COUNT(*) > 1;
-- Expected: 0 rows.

-- 3) No duplicate action_fingerprint among active JEs (if column exists)
-- Run only after migration that adds action_fingerprint:
/*
SELECT action_fingerprint, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND action_fingerprint IS NOT NULL
  AND (is_void IS NOT TRUE)
GROUP BY action_fingerprint
HAVING COUNT(*) > 1;
-- Expected: 0 rows.
*/

-- 4) Voided count by type (audit)
SELECT reference_type, COUNT(*) AS voided_count
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND is_void = true
GROUP BY reference_type
ORDER BY reference_type;

-- 5) Active JEs by type (business view)
SELECT reference_type, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND (is_void IS NOT TRUE)
GROUP BY reference_type
ORDER BY reference_type;
