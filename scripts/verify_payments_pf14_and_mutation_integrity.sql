-- =============================================================================
-- SCRIPT 8: verify_payments_pf14_and_mutation_integrity.sql
-- Purpose:  Verify payment GL integrity — payment JEs with no allocation
--           records, sales marked paid but GL shortfalled, allocations
--           pointing to ghost documents, near-duplicate payment JEs,
--           and journal entries with NULL is_void (standardisation).
-- Tables:   journal_entries, journal_entry_lines, sales, purchases,
--           payment_allocations (if exists), companies
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- NOTE:     payment_allocations is referenced by several checks. If this
--           table does not exist in your schema, those checks will error —
--           comment them out or create the table first.
-- =============================================================================

-- =============================================================================
-- CHECK 1: Payment JEs with no payment_allocations row
-- Expected: 0 rows — every GL journal entry for a payment (reference_type=
--           'payment') must be backed by at least one payment_allocations row
--           that records which sale/purchase the payment was applied to.
--           Without an allocation, the payment amount floats unattributed and
--           the AR/AP sub-ledger cannot be reconciled.
--           Fix: insert the missing allocation row or void the orphan JE.
-- =============================================================================
SELECT
    'CHECK 1: Payment JEs with no allocation record' AS check_name,
    je.id                                             AS je_id,
    je.company_id,
    je.entry_no,
    je.entry_date,
    je.reference_id                                   AS payment_reference_id,
    je.created_at,
    c.name                                            AS company_name
FROM journal_entries je
JOIN companies c ON c.id = je.company_id
WHERE je.reference_type = 'payment'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND NOT EXISTS (
      SELECT 1
      FROM payment_allocations pa
      WHERE pa.journal_entry_id = je.id
         OR pa.payment_reference = je.reference_id
  )
ORDER BY je.company_id, je.created_at DESC;

-- =============================================================================
-- CHECK 2: Sales where payment_status='paid' but allocated amount < total - 1.00
-- Expected: 0 rows — payment_allocations must cover the full sale total for
--           any sale flagged as paid. A shortfall here means the AR subledger
--           still shows an open balance even though the document is marked paid.
--           This leads to incorrect AR aging and incorrect customer statements.
-- =============================================================================
SELECT
    'CHECK 2: Paid sales with allocation shortfall > 1.00' AS check_name,
    s.id                                                     AS sale_id,
    s.company_id,
    s.invoice_no,
    s.total                                                  AS sale_total,
    COALESCE(alloc_agg.total_allocated, 0)                  AS total_allocated,
    s.total - COALESCE(alloc_agg.total_allocated, 0)        AS shortfall,
    c.name                                                   AS company_name
FROM sales s
JOIN companies c ON c.id = s.company_id
LEFT JOIN (
    SELECT
        pa.sale_id,
        SUM(pa.amount) AS total_allocated
    FROM payment_allocations pa
    WHERE pa.sale_id IS NOT NULL
    GROUP BY pa.sale_id
) alloc_agg ON alloc_agg.sale_id = s.id
WHERE s.status         = 'final'
  AND s.payment_status = 'paid'
  AND (s.total - COALESCE(alloc_agg.total_allocated, 0)) > 1.00
ORDER BY shortfall DESC;

-- =============================================================================
-- CHECK 3: Payment allocations referencing non-existent sale or purchase
-- Expected: 0 rows — every payment_allocations row that references a sale_id
--           or purchase_id must point to a real record. Dangling references
--           indicate records were deleted without cleaning up allocations,
--           or allocation rows were inserted with the wrong ID.
-- =============================================================================
SELECT
    'CHECK 3a: Allocations with non-existent sale_id' AS check_name,
    pa.id                                              AS allocation_id,
    pa.sale_id,
    pa.amount,
    pa.created_at
FROM payment_allocations pa
WHERE pa.sale_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM sales s WHERE s.id = pa.sale_id
  )
ORDER BY pa.created_at DESC;

SELECT
    'CHECK 3b: Allocations with non-existent purchase_id' AS check_name,
    pa.id                                                   AS allocation_id,
    pa.purchase_id,
    pa.amount,
    pa.created_at
FROM payment_allocations pa
WHERE pa.purchase_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM purchases p WHERE p.id = pa.purchase_id
  )
ORDER BY pa.created_at DESC;

-- =============================================================================
-- CHECK 4: Near-duplicate payment JEs (same reference_id, same total,
--          within 1 second of each other, both non-void)
-- Expected: 0 rows — the action_fingerprint UNIQUE partial index on
--           journal_entries prevents exact duplicates where fingerprint IS NOT
--           NULL. However, if the fingerprint was NULL (pre-fingerprint code
--           path), two identical payment JEs could both exist. Near-duplicates
--           double-count cash/bank and AR/AP.
--           Fix: identify which JE is the correct one, void the other.
-- =============================================================================
SELECT
    'CHECK 4: Near-duplicate payment JEs within 1 second' AS check_name,
    je1.id                                                  AS je1_id,
    je2.id                                                  AS je2_id,
    je1.company_id,
    je1.reference_id,
    je1.entry_date,
    je1.created_at                                          AS je1_created_at,
    je2.created_at                                          AS je2_created_at,
    EXTRACT(EPOCH FROM (je2.created_at - je1.created_at))  AS seconds_apart,
    c.name                                                  AS company_name
FROM journal_entries je1
JOIN journal_entries je2
    ON  je2.company_id     = je1.company_id
    AND je2.reference_id   = je1.reference_id
    AND je2.reference_type = je1.reference_type
    AND je2.id             > je1.id
    AND ABS(EXTRACT(EPOCH FROM (je2.created_at - je1.created_at))) <= 1
JOIN companies c ON c.id = je1.company_id
WHERE je1.reference_type = 'payment'
  AND (je1.is_void IS NULL OR je1.is_void = FALSE)
  AND (je2.is_void IS NULL OR je2.is_void = FALSE)
  -- Confirm the totals also match
  AND (
      SELECT COALESCE(SUM(jel.debit), 0)
      FROM journal_entry_lines jel WHERE jel.journal_entry_id = je1.id
  ) = (
      SELECT COALESCE(SUM(jel.debit), 0)
      FROM journal_entry_lines jel WHERE jel.journal_entry_id = je2.id
  )
ORDER BY je1.company_id, je1.created_at DESC;

-- =============================================================================
-- CHECK 5: Journal entries where is_void IS NULL (standardisation check)
-- Expected: 0 rows — is_void should always be set to TRUE or FALSE. NULL
--           creates ambiguity: queries using (is_void = FALSE) will exclude
--           these rows and may miss active entries; queries using
--           (is_void IS NULL OR is_void = FALSE) will include them correctly.
--           Standardise by running: UPDATE journal_entries SET is_void = FALSE
--           WHERE is_void IS NULL; — after verifying these are truly active.
-- =============================================================================
SELECT
    'CHECK 5: Journal entries with NULL is_void' AS check_name,
    je.id                                         AS je_id,
    je.company_id,
    je.entry_no,
    je.entry_date,
    je.reference_type,
    je.reference_id,
    je.created_at,
    c.name                                        AS company_name
FROM journal_entries je
JOIN companies c ON c.id = je.company_id
WHERE je.is_void IS NULL
ORDER BY je.company_id, je.created_at DESC;
