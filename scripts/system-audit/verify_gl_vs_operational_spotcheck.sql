-- =====================================================================
-- VERIFY: GL vs Operational Records Spot Check
-- Purpose : Cross-domain reconciliation — confirm that key operational
--           records (sales, purchases, returns) have corresponding GL
--           entries and that totals match within tolerance.
-- Safe    : SELECT only. No modifications.
-- Context : 35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK section 8,
--           18_SOURCE_OF_TRUTH_MATRIX, 20_FINAL_SYSTEM_AUDIT_SUMMARY
-- =====================================================================

-- ─── CHECK 1: Purchase returns — JE coverage per company ─────────────────────
-- The primary fix verified here: all final returns should have an active JE.
SELECT
  pr.company_id,
  COUNT(pr.id) AS total_final_returns,
  COUNT(je.id) AS returns_with_active_je,
  COUNT(pr.id) - COUNT(je.id) AS gap_count,
  SUM(CASE WHEN je.id IS NULL THEN pr.total ELSE 0 END) AS unposted_amount
FROM purchase_returns pr
LEFT JOIN journal_entries je
  ON je.reference_id   = pr.id
  AND je.reference_type = 'purchase_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE pr.status = 'final'
GROUP BY pr.company_id
ORDER BY gap_count DESC;
-- SUCCESS: gap_count = 0 for all companies

-- ─── CHECK 2: Sales — JE coverage for finalized sales ────────────────────────
-- All final sales should have an active settlement JE.
SELECT
  s.company_id,
  COUNT(s.id) AS total_final_sales,
  COUNT(je.id) AS sales_with_active_je,
  COUNT(s.id) - COUNT(je.id) AS gap_count,
  SUM(CASE WHEN je.id IS NULL THEN s.total ELSE 0 END) AS unposted_amount
FROM sales s
LEFT JOIN journal_entries je
  ON je.reference_id   = s.id
  AND je.reference_type IN ('sale', 'sales')
  AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE s.status = 'final'
GROUP BY s.company_id
ORDER BY gap_count DESC
LIMIT 20;

-- ─── CHECK 3: Purchases — JE coverage for finalized purchases ────────────────
SELECT
  p.company_id,
  COUNT(p.id) AS total_final_purchases,
  COUNT(je.id) AS purchases_with_active_je,
  COUNT(p.id) - COUNT(je.id) AS gap_count,
  SUM(CASE WHEN je.id IS NULL THEN p.total ELSE 0 END) AS unposted_amount
FROM purchases p
LEFT JOIN journal_entries je
  ON je.reference_id   = p.id
  AND je.reference_type = 'purchase'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE p.status = 'final'
GROUP BY p.company_id
ORDER BY gap_count DESC
LIMIT 20;

-- ─── CHECK 4: JE balance check — all active JEs should balance (Dr = Cr) ─────
-- An imbalanced JE is a data integrity error (should be prevented by constraint,
-- but worth verifying).
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.company_id,
  je.reference_type,
  SUM(jel.debit) AS total_debit,
  SUM(jel.credit) AS total_credit,
  ABS(SUM(jel.debit) - SUM(jel.credit)) AS imbalance
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.id, je.entry_no, je.company_id, je.reference_type
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01
ORDER BY imbalance DESC
LIMIT 20;
-- SUCCESS: 0 rows (no imbalanced JEs)

-- ─── CHECK 5: Orphan JE lines (lines with no parent JE) ──────────────────────
SELECT COUNT(*) AS orphan_lines
FROM journal_entry_lines jel
WHERE NOT EXISTS (
  SELECT 1 FROM journal_entries je WHERE je.id = jel.journal_entry_id
);
-- SUCCESS: 0

-- ─── CHECK 6: Duplicate active fingerprints (idempotency violations) ──────────
SELECT
  action_fingerprint,
  COUNT(*) AS active_je_count,
  STRING_AGG(id::text, ', ' ORDER BY created_at) AS je_ids,
  company_id
FROM journal_entries
WHERE action_fingerprint IS NOT NULL
  AND (is_void IS NULL OR is_void = FALSE)
GROUP BY action_fingerprint, company_id
HAVING COUNT(*) > 1
ORDER BY active_je_count DESC
LIMIT 20;
-- SUCCESS: 0 rows (no fingerprint collisions among active JEs)

-- ─── CHECK 7: Void JEs that have non-void reversal pairs ──────────────────────
-- A voided JE should have a corresponding active reversal JE.
-- Orphan void JEs (no reversal) may indicate incomplete void flows.
SELECT
  je.id AS voided_je_id,
  je.entry_no,
  je.company_id,
  je.reference_type,
  je.reference_id,
  je.is_void,
  COUNT(rev.id) AS reversal_count
FROM journal_entries je
LEFT JOIN journal_entries rev
  ON rev.reference_id = je.id
  AND rev.reference_type = 'correction_reversal'
  AND (rev.is_void IS NULL OR rev.is_void = FALSE)
WHERE je.is_void = TRUE
GROUP BY je.id, je.entry_no, je.company_id, je.reference_type, je.reference_id, je.is_void
HAVING COUNT(rev.id) = 0
ORDER BY je.company_id, je.created_at DESC
LIMIT 20;
-- Informational: some voided JEs may have been voided without a reversal JE
-- (direct void, not reversal). Flagged here for review, not necessarily an error.

-- ─── SUMMARY: Overall GL health snapshot ─────────────────────────────────────
SELECT
  'Total active JEs'            AS metric, COUNT(*)::text AS value FROM journal_entries WHERE (is_void IS NULL OR is_void = FALSE)
UNION ALL
SELECT 'Total voided JEs',             COUNT(*)::text FROM journal_entries WHERE is_void = TRUE
UNION ALL
SELECT 'Total JE lines',               COUNT(*)::text FROM journal_entry_lines
UNION ALL
SELECT 'Imbalanced JEs (Dr≠Cr>0.01)', COUNT(*)::text FROM (
  SELECT je.id FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE (je.is_void IS NULL OR je.is_void = FALSE)
  GROUP BY je.id HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01
) t
UNION ALL
SELECT 'Duplicate fingerprints',       COUNT(*)::text FROM (
  SELECT action_fingerprint FROM journal_entries
  WHERE action_fingerprint IS NOT NULL AND (is_void IS NULL OR is_void = FALSE)
  GROUP BY action_fingerprint, company_id HAVING COUNT(*) > 1
) t;
