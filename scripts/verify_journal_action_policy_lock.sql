-- verify_journal_action_policy_lock.sql
-- Read-only checks supporting Journal action policy (PF-07 + source control).
-- Run in Supabase SQL editor or psql against the app database.

-- 1) More than one ACTIVE correction_reversal for the same original JE (should be empty).
SELECT rev.reference_id AS original_journal_id,
       COUNT(*)::int AS active_reversal_count
FROM journal_entries rev
WHERE rev.reference_type = 'correction_reversal'
  AND (rev.is_void IS NULL OR rev.is_void = false)
GROUP BY rev.reference_id
HAVING COUNT(*) > 1
ORDER BY active_reversal_count DESC;

-- 2) Document / return originals that already have an active reversal (informational:
--    app treats these as terminal for Edit/Reverse from Journal).
SELECT orig.reference_type,
       COUNT(*)::int AS originals_with_active_reversal
FROM journal_entries orig
WHERE EXISTS (
  SELECT 1
  FROM journal_entries rev
  WHERE rev.company_id = orig.company_id
    AND rev.reference_type = 'correction_reversal'
    AND rev.reference_id::text = orig.id::text
    AND (rev.is_void IS NULL OR rev.is_void = false)
)
AND (orig.is_void IS NULL OR orig.is_void = false)
AND LOWER(COALESCE(orig.reference_type, '')) IN (
  'sale', 'purchase', 'sale_return', 'purchase_return',
  'sale_adjustment', 'purchase_adjustment', 'rental'
)
GROUP BY orig.reference_type
ORDER BY originals_with_active_reversal DESC;

-- 3) Sample rows for audit (latest 50): source-controlled types with active reversal child.
SELECT orig.id,
       orig.entry_no,
       orig.entry_date,
       orig.reference_type,
       orig.reference_id,
       rev.id AS reversal_je_id,
       rev.entry_no AS reversal_entry_no
FROM journal_entries orig
JOIN journal_entries rev
  ON rev.company_id = orig.company_id
 AND rev.reference_type = 'correction_reversal'
 AND rev.reference_id::text = orig.id::text
 AND (rev.is_void IS NULL OR rev.is_void = false)
WHERE (orig.is_void IS NULL OR orig.is_void = false)
  AND LOWER(COALESCE(orig.reference_type, '')) IN ('sale_return', 'purchase_return', 'sale', 'purchase')
ORDER BY orig.entry_date DESC, orig.created_at DESC
LIMIT 50;
