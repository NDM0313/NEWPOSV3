-- =====================================================================
-- VERIFY: Historical Purchase Returns Missing Journal Entries
-- Purpose : Identify all pre-patch purchase returns that have no GL
--           entry. Used before running repair script.
-- Safe    : SELECT only. No modifications.
-- Context : 35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK section 2
-- Run before: repair_purchase_return_missing_journal_entries.sql
-- =====================================================================

-- ─── CHECK 1: Complete list of affected returns ───────────────────────────────
-- Shows: company, return details, amounts, supplier info
SELECT
  pr.company_id,
  pr.id AS return_id,
  pr.return_no,
  pr.status,
  pr.total AS return_total,
  pr.subtotal,
  pr.discount_amount,
  pr.supplier_id,
  c.name AS supplier_name,
  pr.original_purchase_id,
  pur.po_no AS original_purchase_no,
  pr.created_at,
  pr.updated_at,
  pr.branch_id
FROM purchase_returns pr
LEFT JOIN contacts c ON c.id = pr.supplier_id
LEFT JOIN purchases pur ON pur.id = pr.original_purchase_id
WHERE pr.status = 'final'
  AND NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.reference_id   = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
ORDER BY pr.company_id, pr.created_at;

-- ─── CHECK 2: Summary per company (scale check) ──────────────────────────────
SELECT
  pr.company_id,
  COUNT(*) AS returns_without_je,
  SUM(pr.total) AS total_unposted_amount,
  MIN(pr.created_at) AS earliest_affected,
  MAX(pr.created_at) AS latest_affected
FROM purchase_returns pr
WHERE pr.status = 'final'
  AND NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.reference_id   = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
GROUP BY pr.company_id
ORDER BY total_unposted_amount DESC;

-- ─── CHECK 3: Available AP accounts per company (for repair) ─────────────────
-- Use these account IDs in the repair script
SELECT
  a.company_id,
  a.id AS ap_account_id,
  a.code,
  a.name,
  a.type,
  a.is_active
FROM accounts a
WHERE a.is_active = TRUE
  AND (a.code IN ('2000','2100') OR a.code LIKE 'AP-%')
  AND a.company_id IN (
    SELECT DISTINCT pr.company_id
    FROM purchase_returns pr
    WHERE pr.status = 'final'
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.reference_id = pr.id
          AND je.reference_type = 'purchase_return'
          AND (je.is_void IS NULL OR je.is_void = FALSE)
      )
  )
ORDER BY a.company_id, a.code;

-- ─── CHECK 4: Available Inventory accounts per company (for repair) ───────────
SELECT
  a.company_id,
  a.id AS inventory_account_id,
  a.code,
  a.name,
  a.type,
  a.is_active
FROM accounts a
WHERE a.is_active = TRUE
  AND a.code IN ('1200','1500')
  AND a.company_id IN (
    SELECT DISTINCT pr.company_id
    FROM purchase_returns pr
    WHERE pr.status = 'final'
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.reference_id = pr.id
          AND je.reference_type = 'purchase_return'
          AND (je.is_void IS NULL OR je.is_void = FALSE)
      )
  )
ORDER BY a.company_id, a.code;

-- ─── CHECK 5: Branches used by affected returns ───────────────────────────────
SELECT DISTINCT
  pr.company_id,
  pr.branch_id,
  b.name AS branch_name
FROM purchase_returns pr
LEFT JOIN branches b ON b.id = pr.branch_id
WHERE pr.status = 'final'
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_id = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
ORDER BY pr.company_id, pr.branch_id;
