-- =====================================================================
-- VERIFY: Purchase Return Document Numbering (Post P1-4 Patch)
-- Purpose : Confirm the purchase return numbering redirect to canonical
--           erp_document_sequences is working, and identify whether a
--           dedicated 'purchase_return' sequence exists or the 'purchase'
--           sequence fallback is in use.
-- Safe    : SELECT only. No modifications.
-- Context : 35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK section 7,
--           31_P1_DOCUMENT_NUMBERING_UNIFICATION,
--           39_PURCHASE_RETURN_NUMBERING_DECISION
-- =====================================================================

-- ─── CHECK 1: erp_document_sequences state for purchase return types ──────────
-- Shows which sequence types exist in the canonical numbering table.
-- Good result: 'purchase_return' sequence exists per company/branch.
-- Acceptable: 'purchase' sequence exists (P1-4 fallback).
-- Failure: Neither exists → return numbers using timestamp fallback (PRET-YYYYMMDD-xxxx)
SELECT
  document_type,
  prefix,
  current_value,
  branch_id,
  company_id,
  created_at,
  updated_at
FROM erp_document_sequences
WHERE document_type IN ('purchase', 'purchase_return')
ORDER BY company_id, document_type, branch_id;

-- ─── CHECK 2: All sequences in erp_document_sequences (full picture) ─────────
SELECT
  document_type,
  prefix,
  COUNT(*) AS sequence_count,
  MAX(current_value) AS max_current_value
FROM erp_document_sequences
GROUP BY document_type, prefix
ORDER BY document_type;

-- ─── CHECK 3: Legacy document_sequences — was it updated after P1-4 patch? ───
-- SUCCESS: MAX(updated_at) <= '2026-04-12' (no updates after redirect)
-- FAILURE: Recent updates → generateReturnNumber() still using legacy table
SELECT
  document_type,
  MAX(updated_at) AS last_updated,
  MAX(current_value) AS last_sequence_value,
  CASE
    WHEN MAX(updated_at) > '2026-04-12' THEN 'STILL BEING USED (regression)'
    ELSE 'CLEAN (no post-patch writes)'
  END AS status
FROM document_sequences
WHERE document_type = 'purchase_return'
GROUP BY document_type;

-- ─── CHECK 4: Sample of recent purchase return numbers ───────────────────────
-- Inspect actual return_no values to identify which format they are using:
--   Format 'PUR-NNNN'   → using shared purchase sequence (P1-4 fallback)
--   Format 'PRET-NNNN'  → using dedicated purchase_return sequence (ideal)
--   Format 'PRET-YYYYMMDD-xxxx' → timestamp fallback (no sequence seeded)
SELECT
  pr.company_id,
  pr.return_no,
  pr.created_at,
  CASE
    WHEN pr.return_no ~ '^PRET-[0-9]{4,}-' THEN 'timestamp-fallback'
    WHEN pr.return_no ~ '^PRET-[0-9]+$'    THEN 'dedicated-sequence'
    WHEN pr.return_no ~ '^PUR-[0-9]+$'     THEN 'shared-purchase-sequence'
    WHEN pr.return_no ~ '^PR-[0-9a-f]{8}'  THEN 'legacy-uuid-prefix'
    ELSE 'unknown-format'
  END AS number_format
FROM purchase_returns pr
WHERE pr.created_at > '2026-04-12'
ORDER BY pr.created_at DESC
LIMIT 50;

-- ─── CHECK 5: Distribution of number formats across all purchase returns ──────
SELECT
  CASE
    WHEN return_no ~ '^PRET-[0-9]{4,}-' THEN 'timestamp-fallback'
    WHEN return_no ~ '^PRET-[0-9]+$'    THEN 'dedicated-sequence'
    WHEN return_no ~ '^PUR-[0-9]+$'     THEN 'shared-purchase-sequence'
    WHEN return_no ~ '^PR-[0-9a-f]{8}'  THEN 'legacy-uuid-prefix'
    WHEN return_no IS NULL              THEN 'null'
    ELSE 'unknown-format'
  END AS number_format,
  COUNT(*) AS count,
  MIN(created_at) AS earliest,
  MAX(created_at) AS latest
FROM purchase_returns
GROUP BY 1
ORDER BY count DESC;

-- ─── CHECK 6: document_sequences_global — any purchase_return entries? ────────
-- If the global table was ever used for purchase returns, it should show here.
SELECT
  document_type,
  current_value,
  prefix,
  updated_at
FROM document_sequences_global
WHERE document_type IN ('purchase', 'purchase_return')
ORDER BY document_type;
