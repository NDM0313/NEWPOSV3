-- PF-14.4: Classify and safe-cleanup duplicate/orphan adjustment journal entries.
-- Run after migration pf14_4_journal_entries_void_support.sql (is_void column must exist).
-- Replace (SELECT id FROM companies LIMIT 1) with your company UUID if needed. Prefer void over delete; run PREVIEW first.

-- ========== PREVIEW: Duplicate sale_adjustment (same sale_id + same description) ==========
-- These are candidates for void: keep one, void the rest.
SELECT
  reference_id AS sale_id,
  description,
  COUNT(*) AS cnt,
  array_agg(id ORDER BY created_at) AS je_ids,
  array_agg(entry_no ORDER BY created_at) AS entry_nos
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type = 'sale_adjustment'
  AND (is_void IS NOT TRUE)
GROUP BY reference_id, description
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ========== PREVIEW: Duplicate payment_adjustment (same payment_id + same description pattern) ==========
SELECT
  reference_id AS payment_id,
  LEFT(description, 80) AS description_sample,
  COUNT(*) AS cnt,
  array_agg(id ORDER BY created_at) AS je_ids
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type = 'payment_adjustment'
  AND (is_void IS NOT TRUE)
GROUP BY reference_id, description
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ========== PREVIEW: Orphan sale_adjustment (sale no longer exists) ==========
SELECT je.id, je.entry_no, je.reference_id AS sale_id, je.description, je.created_at
FROM journal_entries je
LEFT JOIN sales s ON s.id = je.reference_id
WHERE je.company_id = (SELECT id FROM companies LIMIT 1)
  AND je.reference_type = 'sale_adjustment'
  AND je.reference_id IS NOT NULL
  AND s.id IS NULL
  AND (je.is_void IS NOT TRUE);

-- ========== PREVIEW: Orphan payment_adjustment (payment no longer exists) ==========
SELECT je.id, je.entry_no, je.reference_id AS payment_id, je.description, je.created_at
FROM journal_entries je
LEFT JOIN payments p ON p.id = je.reference_id
WHERE je.company_id = (SELECT id FROM companies LIMIT 1)
  AND je.reference_type = 'payment_adjustment'
  AND je.reference_id IS NOT NULL
  AND p.id IS NULL
  AND (je.is_void IS NOT TRUE);

-- ========== APPLY: Void duplicate sale_adjustment (keep earliest, void rest) ==========
-- Uncomment and run after reviewing PREVIEW. Replace company_id if needed.
/*
WITH dupes AS (
  SELECT id, reference_id, description, created_at,
         ROW_NUMBER() OVER (PARTITION BY reference_id, description ORDER BY created_at) AS rn
  FROM journal_entries
  WHERE company_id = (SELECT id FROM companies LIMIT 1)
    AND reference_type = 'sale_adjustment'
    AND (is_void IS NOT TRUE)
)
UPDATE journal_entries
SET is_void = true, void_reason = 'PF-14.4 duplicate sale_adjustment (kept first)', voided_at = NOW()
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);
*/

-- ========== APPLY: Void duplicate payment_adjustment (keep earliest, void rest) ==========
/*
WITH dupes AS (
  SELECT id, reference_id, description, created_at,
         ROW_NUMBER() OVER (PARTITION BY reference_id, description ORDER BY created_at) AS rn
  FROM journal_entries
  WHERE company_id = (SELECT id FROM companies LIMIT 1)
    AND reference_type = 'payment_adjustment'
    AND (is_void IS NOT TRUE)
)
UPDATE journal_entries
SET is_void = true, void_reason = 'PF-14.4 duplicate payment_adjustment (kept first)', voided_at = NOW()
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);
*/

-- ========== APPLY: Void orphan sale_adjustment ==========
/*
UPDATE journal_entries je
SET is_void = true, void_reason = 'PF-14.4 orphan (sale deleted)', voided_at = NOW()
FROM (SELECT je2.id FROM journal_entries je2
      LEFT JOIN sales s ON s.id = je2.reference_id
      WHERE je2.company_id = (SELECT id FROM companies LIMIT 1) AND je2.reference_type = 'sale_adjustment'
        AND je2.reference_id IS NOT NULL AND s.id IS NULL AND (je2.is_void IS NOT TRUE)) sub
WHERE je.id = sub.id;
*/

-- ========== APPLY: Void orphan payment_adjustment ==========
/*
UPDATE journal_entries je
SET is_void = true, void_reason = 'PF-14.4 orphan (payment deleted)', voided_at = NOW()
FROM (SELECT je2.id FROM journal_entries je2
      LEFT JOIN payments p ON p.id = je2.reference_id
      WHERE je2.company_id = (SELECT id FROM companies LIMIT 1) AND je2.reference_type = 'payment_adjustment'
        AND je2.reference_id IS NOT NULL AND p.id IS NULL AND (je2.is_void IS NOT TRUE)) sub
WHERE je.id = sub.id;
*/
