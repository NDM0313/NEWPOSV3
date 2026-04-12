-- verify_orphan_operational_documents_without_gl.sql
-- Purpose: Identify finalized operational documents (sales, purchases,
--          purchase returns, payments) that have no corresponding non-void
--          journal entry. These are "GL orphans" — transactions recorded
--          operationally but absent from the general ledger.
-- Severity: P1 for sales and payments; P1 for purchase_returns (known gap);
--           P2 for purchases.
-- Run: read-only; no writes.
-- Expected output: zero rows for sales and payments in a healthy system;
--                  all finalized purchase_returns are expected to appear
--                  until the JE posting gap is fixed.

-- ============================================================
-- Section 1: Finalized SALES without a journal entry
-- ============================================================
SELECT
    'SALE'                          AS document_type,
    s.id                            AS document_id,
    s.reference_number,
    s.status,
    s.created_at::DATE              AS document_date,
    s.total_amount,
    je.id                           AS journal_entry_id
FROM sales s
LEFT JOIN journal_entries je
    ON je.reference_id   = s.id::TEXT
    AND je.reference_type = 'sale'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE
    s.status = 'final'
    AND je.id IS NULL

UNION ALL

-- ============================================================
-- Section 2: Finalized PURCHASES without a journal entry
-- ============================================================
SELECT
    'PURCHASE'                      AS document_type,
    pu.id                           AS document_id,
    pu.reference_number,
    pu.status,
    pu.created_at::DATE             AS document_date,
    pu.total_amount,
    je.id                           AS journal_entry_id
FROM purchases pu
LEFT JOIN journal_entries je
    ON je.reference_id   = pu.id::TEXT
    AND je.reference_type = 'purchase'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE
    pu.status = 'final'
    AND je.id IS NULL

UNION ALL

-- ============================================================
-- Section 3: Finalized PURCHASE RETURNS without a journal entry
-- (known P1 gap — all rows expected until fix is deployed)
-- ============================================================
SELECT
    'PURCHASE_RETURN'               AS document_type,
    pr.id                           AS document_id,
    pr.reference_number,
    pr.status,
    pr.created_at::DATE             AS document_date,
    pr.total_amount,
    je.id                           AS journal_entry_id
FROM purchase_returns pr
LEFT JOIN journal_entries je
    ON je.reference_id   = pr.id::TEXT
    AND je.reference_type = 'purchase_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE
    pr.status = 'final'
    AND je.id IS NULL

UNION ALL

-- ============================================================
-- Section 4: PAYMENTS without a journal entry
-- ============================================================
SELECT
    'PAYMENT'                       AS document_type,
    py.id                           AS document_id,
    py.reference_number,
    py.status,
    py.created_at::DATE             AS document_date,
    py.amount                       AS total_amount,
    je.id                           AS journal_entry_id
FROM payments py
LEFT JOIN journal_entries je
    ON je.reference_id   = py.id::TEXT
    AND je.reference_type = 'payment'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE
    py.status = 'final'
    AND je.id IS NULL

ORDER BY document_type, document_date DESC;
