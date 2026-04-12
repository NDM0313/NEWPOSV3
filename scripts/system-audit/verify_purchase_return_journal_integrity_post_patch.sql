-- =====================================================================
-- VERIFY: Purchase Return Journal Integrity (Post P1-1 Patch)
-- Purpose : Confirm that all final purchase returns have an active
--           settlement JE after the P1-1 code patch.
-- Safe    : SELECT only. No modifications.
-- Context : 35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK, 28_P1_PURCHASE_RETURN_GL_GAP_FIX
-- =====================================================================

-- ─── CHECK 1: Final returns WITHOUT a settlement JE (should be 0 post-repair) ─
-- SUCCESS: 0 rows
-- FAILURE: Rows exist → use repair_purchase_return_missing_journal_entries.sql
SELECT
  pr.company_id,
  pr.id AS return_id,
  pr.return_no,
  pr.total AS return_total,
  pr.created_at,
  pr.updated_at
FROM purchase_returns pr
WHERE pr.status = 'final'
  AND NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.reference_id   = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
ORDER BY pr.company_id, pr.created_at;

-- ─── CHECK 2: Returns finalized AFTER patch date with JE (should be > 0 if any returns happened post-patch) ─
SELECT
  pr.company_id,
  COUNT(*) AS returns_with_je_post_patch,
  SUM(pr.total) AS total_amount
FROM purchase_returns pr
WHERE pr.status = 'final'
  AND pr.updated_at >= '2026-04-12'
  AND EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.reference_id   = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
GROUP BY pr.company_id;

-- ─── CHECK 3: JE debit (AP reversal) MATCHES return.total per return ──────────
-- SUCCESS: discrepancy < 0.01 for all rows
-- FAILURE: discrepancy > 0.01 → JE was posted with wrong amount
SELECT
  pr.return_no,
  pr.company_id,
  pr.total AS return_total,
  SUM(jel.debit) AS je_debit_ap,
  ABS(SUM(jel.debit) - pr.total) AS discrepancy,
  CASE WHEN ABS(SUM(jel.debit) - pr.total) < 0.01 THEN 'MATCH' ELSE 'MISMATCH' END AS status
FROM purchase_returns pr
JOIN journal_entries je
  ON je.reference_id   = pr.id
  AND je.reference_type = 'purchase_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.debit > 0
JOIN accounts a ON a.id = jel.account_id
  AND (a.code IN ('2000','2100','2010') OR a.code LIKE 'AP-%')
WHERE pr.status = 'final'
GROUP BY pr.return_no, pr.company_id, pr.total
ORDER BY discrepancy DESC;

-- ─── CHECK 4: Inventory credit MATCHES return.total ──────────────────────────
SELECT
  pr.return_no,
  pr.total AS return_total,
  SUM(jel.credit) AS je_credit_inventory,
  ABS(SUM(jel.credit) - pr.total) AS discrepancy,
  CASE WHEN ABS(SUM(jel.credit) - pr.total) < 0.01 THEN 'MATCH' ELSE 'MISMATCH' END AS status
FROM purchase_returns pr
JOIN journal_entries je
  ON je.reference_id   = pr.id
  AND je.reference_type = 'purchase_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.credit > 0
JOIN accounts a ON a.id = jel.account_id
  AND a.code IN ('1200','1500')
WHERE pr.status = 'final'
GROUP BY pr.return_no, pr.total
ORDER BY discrepancy DESC;

-- ─── CHECK 5: Idempotency — no duplicate active JEs per return ───────────────
-- SUCCESS: 0 rows (no return has > 1 active JE)
-- FAILURE: Duplicate JEs exist → audit fingerprint uniqueness
SELECT
  je.reference_id AS return_id,
  COUNT(*) AS active_je_count,
  STRING_AGG(je.id::text, ', ') AS je_ids
FROM journal_entries je
WHERE je.reference_type = 'purchase_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.reference_id
HAVING COUNT(*) > 1
ORDER BY active_je_count DESC;

-- ─── CHECK 6: Voided returns — all JEs must also be void ─────────────────────
-- SUCCESS: 0 rows
SELECT
  pr.id AS return_id,
  pr.return_no,
  je.id AS je_id,
  je.entry_no,
  je.is_void
FROM purchase_returns pr
JOIN journal_entries je ON je.reference_id = pr.id
  AND je.reference_type = 'purchase_return'
WHERE pr.status = 'void'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
ORDER BY pr.created_at DESC;

-- ─── SUMMARY: Per-company gap report ─────────────────────────────────────────
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
