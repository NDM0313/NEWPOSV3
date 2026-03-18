-- PF-14.5B: Backup then void duplicate/orphan journal entries (production-safe).
-- Run migration pf145_backup_tables_and_fingerprint.sql first.
-- Replace (SELECT id FROM companies LIMIT 1) with your company_id if needed.

-- ========== STEP A: BACKUP duplicate sale_adjustment (keep earliest, backup rest for delete/void) ==========
-- Generate backup batch id for this run
-- In application: run INSERT into backup_pf145_journal_entries from SELECT for ids in (dupes where rn > 1).

-- Example: Backup duplicate sale_adjustment rows (those that will be voided)
/*
INSERT INTO backup_pf145_journal_entries (
  id, backup_batch_id, backup_reason, backed_up_at,
  company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id,
  payment_id, created_by, created_at, updated_at, is_void, void_reason, voided_at, voided_by
)
SELECT je.id, gen_random_uuid(), 'PF-14.5B duplicate sale_adjustment', NOW(),
  je.company_id, je.branch_id, je.entry_no, je.entry_date, je.description, je.reference_type, je.reference_id,
  je.payment_id, je.created_by, je.created_at, je.updated_at, je.is_void, je.void_reason, je.voided_at, je.voided_by
FROM journal_entries je
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY reference_id, description ORDER BY created_at) AS rn
  FROM journal_entries
  WHERE company_id = (SELECT id FROM companies LIMIT 1)
    AND reference_type = 'sale_adjustment'
    AND (is_void IS NOT TRUE)
) dupes ON je.id = dupes.id
WHERE dupes.rn > 1;
*/

-- ========== STEP B: VOID duplicate sale_adjustment (keep earliest, void rest) ==========
/*
WITH dupes AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY reference_id, description ORDER BY created_at) AS rn
  FROM journal_entries
  WHERE company_id = (SELECT id FROM companies LIMIT 1)
    AND reference_type = 'sale_adjustment'
    AND (is_void IS NOT TRUE)
)
UPDATE journal_entries
SET is_void = true, void_reason = 'PF-14.5B duplicate sale_adjustment (kept first)', voided_at = NOW()
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);
*/

-- ========== STEP C: VOID duplicate payment_adjustment (keep earliest, void rest) ==========
/*
WITH dupes AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY reference_id, description ORDER BY created_at) AS rn
  FROM journal_entries
  WHERE company_id = (SELECT id FROM companies LIMIT 1)
    AND reference_type = 'payment_adjustment'
    AND (is_void IS NOT TRUE)
)
UPDATE journal_entries
SET is_void = true, void_reason = 'PF-14.5B duplicate payment_adjustment (kept first)', voided_at = NOW()
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);
*/

-- ========== STEP D: VOID orphan sale_adjustment ==========
/*
UPDATE journal_entries je
SET is_void = true, void_reason = 'PF-14.5B orphan (sale deleted)', voided_at = NOW()
WHERE je.id IN (
  SELECT je2.id FROM journal_entries je2
  LEFT JOIN sales s ON s.id = je2.reference_id
  WHERE je2.company_id = (SELECT id FROM companies LIMIT 1)
    AND je2.reference_type = 'sale_adjustment'
    AND je2.reference_id IS NOT NULL
    AND s.id IS NULL
    AND (je2.is_void IS NOT TRUE)
);
*/

-- ========== STEP E: VOID orphan payment_adjustment ==========
/*
UPDATE journal_entries je
SET is_void = true, void_reason = 'PF-14.5B orphan (payment deleted)', voided_at = NOW()
WHERE je.id IN (
  SELECT je2.id FROM journal_entries je2
  LEFT JOIN payments p ON p.id = je2.reference_id
  WHERE je2.company_id = (SELECT id FROM companies LIMIT 1)
    AND je2.reference_type = 'payment_adjustment'
    AND je2.reference_id IS NOT NULL
    AND p.id IS NULL
    AND (je2.is_void IS NOT TRUE)
);
*/
