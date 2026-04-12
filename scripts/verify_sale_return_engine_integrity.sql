-- =============================================================================
-- SCRIPT 5: verify_sale_return_engine_integrity.sql
-- Purpose:  Comprehensive verification of the sale return engine — discount
--           propagation bug, proportional discount accuracy, settlement JE
--           amount correctness, quantity over-returns, voided returns with
--           lingering active JEs, missing settlement JEs, and orphan return
--           items. Based on repairs performed for company 595c08c2.
-- Tables:   sale_returns, sale_return_items, sales, sales_items,
--           journal_entries, journal_entry_lines, companies
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- =============================================================================

-- =============================================================================
-- CHECK 1: Final returns where discount_amount=0 but original sale had discount
-- Expected: 0 rows — this is the "MISSING DISCOUNT" bug. When a return is
--           created from a discounted sale, the return's discount_amount must
--           be set proportionally (return_subtotal / sale_subtotal * sale_discount).
--           A zero discount here means the return total is overstated, causing
--           the refund JE to be too large and the customer's AR to be over-credited.
--           Fix: void the return JE and re-post with corrected discount amounts.
-- =============================================================================
SELECT
    'CHECK 1: Missing discount on return from discounted sale' AS check_name,
    sr.id                                                       AS return_id,
    sr.company_id,
    sr.return_no,
    sr.subtotal                                                 AS return_subtotal,
    sr.discount_amount                                          AS return_discount,
    sr.total                                                    AS return_total,
    s.id                                                        AS original_sale_id,
    s.invoice_no                                                AS original_invoice_no,
    s.subtotal                                                  AS sale_subtotal,
    s.discount_amount                                           AS sale_discount,
    s.total                                                     AS sale_total,
    ROUND(
        (sr.subtotal / NULLIF(s.subtotal, 0)) * s.discount_amount,
        2
    )                                                           AS expected_return_discount,
    c.name                                                      AS company_name
FROM sale_returns sr
JOIN sales     s ON s.id = sr.original_sale_id
JOIN companies c ON c.id = sr.company_id
WHERE sr.status              = 'final'
  AND COALESCE(sr.discount_amount, 0) = 0
  AND COALESCE(s.discount_amount, 0) > 0
ORDER BY sr.company_id, sr.return_no;

-- =============================================================================
-- CHECK 2: Proportional discount ratio accuracy check
-- Expected: 0 rows — where a discount has been applied, its ratio to the
--           return subtotal must match the original sale's ratio to within
--           0.001. A larger deviation means the discount was applied using
--           a wrong formula (flat amount instead of proportional, for example).
-- =============================================================================
SELECT
    'CHECK 2: Disproportionate discount on return' AS check_name,
    sr.id                                           AS return_id,
    sr.company_id,
    sr.return_no,
    sr.subtotal                                     AS return_subtotal,
    sr.discount_amount                              AS return_discount,
    sr.total                                        AS return_total,
    s.invoice_no                                    AS original_invoice_no,
    s.subtotal                                      AS sale_subtotal,
    s.discount_amount                               AS sale_discount,
    ROUND(sr.discount_amount / NULLIF(sr.subtotal, 0), 6)    AS return_ratio,
    ROUND(s.discount_amount  / NULLIF(s.subtotal,  0), 6)    AS sale_ratio,
    ABS(
        (sr.discount_amount / NULLIF(sr.subtotal, 0)) -
        (s.discount_amount  / NULLIF(s.subtotal,  0))
    )                                               AS ratio_divergence,
    c.name                                          AS company_name
FROM sale_returns sr
JOIN sales     s ON s.id = sr.original_sale_id
JOIN companies c ON c.id = sr.company_id
WHERE sr.status                          = 'final'
  AND COALESCE(sr.discount_amount, 0)   > 0
  AND COALESCE(s.discount_amount, 0)    > 0
  AND sr.subtotal                        > 0
  AND s.subtotal                         > 0
  AND ABS(
      (sr.discount_amount / NULLIF(sr.subtotal, 0)) -
      (s.discount_amount  / NULLIF(s.subtotal,  0))
  ) > 0.001
ORDER BY ratio_divergence DESC;

-- =============================================================================
-- CHECK 3: Settlement JE amount vs return.total discrepancy > 0.01
-- Expected: 0 rows — the total credit (refund side) posted in the return
--           settlement JE must equal sale_returns.total within 0.01.
--           A discrepancy means the customer was refunded the wrong amount
--           in the GL (even if the physical refund was correct).
-- =============================================================================
WITH return_je_totals AS (
    SELECT
        je.reference_id                  AS return_id,
        je.company_id,
        SUM(jel.credit)                  AS total_credit_posted
    FROM journal_entries     je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE je.reference_type = 'sale_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
    GROUP BY je.reference_id, je.company_id
)
SELECT
    'CHECK 3: Return settlement JE amount mismatch > 0.01' AS check_name,
    sr.id                                                    AS return_id,
    sr.company_id,
    sr.return_no,
    sr.total                                                 AS return_total,
    rjt.total_credit_posted,
    ABS(sr.total - rjt.total_credit_posted)                AS discrepancy,
    c.name                                                   AS company_name
FROM sale_returns sr
JOIN return_je_totals rjt ON rjt.return_id = sr.id::TEXT AND rjt.company_id = sr.company_id
JOIN companies        c   ON c.id = sr.company_id
WHERE sr.status = 'final'
  AND ABS(sr.total - COALESCE(rjt.total_credit_posted, 0)) > 0.01
ORDER BY discrepancy DESC;

-- =============================================================================
-- CHECK 4: Return quantities exceeding original sale quantities (over-return)
-- Expected: 0 rows — the sum of all return quantities for a given sale line
--           must not exceed the quantity originally sold. An over-return means
--           inventory is being credited for more stock than was ever sold,
--           inflating inventory balances.
-- =============================================================================
SELECT
    'CHECK 4: Return quantity exceeds original sale quantity' AS check_name,
    si.id                                                      AS sale_item_id,
    si.sale_id,
    si.product_id,
    si.product_name,
    si.quantity                                                AS sold_qty,
    COALESCE(ret_agg.total_returned_qty, 0)                   AS total_returned_qty,
    COALESCE(ret_agg.total_returned_qty, 0) - si.quantity     AS over_return_qty,
    s.invoice_no,
    s.company_id,
    c.name                                                     AS company_name
FROM sales_items si
JOIN sales     s ON s.id = si.sale_id
JOIN companies c ON c.id = s.company_id
LEFT JOIN (
    SELECT
        sri.sale_item_id,
        SUM(sri.quantity) AS total_returned_qty
    FROM sale_return_items sri
    JOIN sale_returns sr ON sr.id = sri.sale_return_id
    WHERE sr.status = 'final'
    GROUP BY sri.sale_item_id
) ret_agg ON ret_agg.sale_item_id = si.id
WHERE COALESCE(ret_agg.total_returned_qty, 0) > si.quantity
ORDER BY over_return_qty DESC;

-- =============================================================================
-- CHECK 5: Voided returns with still-active (non-void) settlement JEs
-- Expected: 0 rows — when a sale return is voided, all its journal entries
--           must also be voided. An active JE on a void return means the
--           GL still reflects the refund even though the return was cancelled.
--           This overstates the refund amount and distorts AR/cash balances.
--           Fix: void the JE with reference_type='sale_return' for this return.
-- =============================================================================
SELECT
    'CHECK 5: Voided returns with active settlement JEs' AS check_name,
    sr.id                                                 AS return_id,
    sr.company_id,
    sr.return_no,
    sr.status                                             AS return_status,
    je.id                                                 AS active_je_id,
    je.entry_no,
    je.entry_date,
    c.name                                                AS company_name
FROM sale_returns sr
JOIN journal_entries je
    ON  je.reference_id   = sr.id::TEXT
    AND je.reference_type = 'sale_return'
    AND je.company_id     = sr.company_id
    AND (je.is_void IS NULL OR je.is_void = FALSE)
JOIN companies c ON c.id = sr.company_id
WHERE sr.status = 'void'
ORDER BY sr.company_id, sr.return_no;

-- =============================================================================
-- CHECK 6: Final returns with no settlement JE (missing JE — most critical)
-- Expected: 0 rows — this is the most severe failure. A finalised return with
--           no active settlement JE means the refund was recorded in the
--           document table but never posted to the GL. The customer's AR
--           balance is wrong and the cash/bank account is wrong.
--           Fix: repost the return via the sale return service to create
--           the missing JE, or manually create and post the corrective JE.
-- =============================================================================
SELECT
    'CHECK 6: Final returns with no settlement JE (CRITICAL)' AS check_name,
    sr.id                                                       AS return_id,
    sr.company_id,
    sr.return_no,
    sr.subtotal,
    sr.discount_amount,
    sr.total,
    sr.refund_method,
    sr.original_sale_id,
    s.invoice_no                                                AS original_invoice_no,
    c.name                                                      AS company_name
FROM sale_returns sr
JOIN sales     s ON s.id = sr.original_sale_id
JOIN companies c ON c.id = sr.company_id
WHERE sr.status = 'final'
  AND NOT EXISTS (
      SELECT 1
      FROM journal_entries je
      WHERE je.reference_id   = sr.id::TEXT
        AND je.reference_type = 'sale_return'
        AND je.company_id     = sr.company_id
        AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
ORDER BY sr.company_id, sr.return_no;

-- =============================================================================
-- CHECK 7: Orphan return items (sale_return_items with no matching sale_return)
-- Expected: 0 rows — every sale_return_items row must reference a valid
--           sale_returns record. Orphan items indicate a partial delete or
--           a broken cascade. They consume sale item quota without being
--           associated with any return document.
-- =============================================================================
SELECT
    'CHECK 7: Orphan sale_return_items' AS check_name,
    sri.id                               AS return_item_id,
    sri.sale_return_id,
    sri.product_id,
    sri.quantity,
    sri.unit_price,
    sri.total
FROM sale_return_items sri
WHERE NOT EXISTS (
    SELECT 1
    FROM sale_returns sr
    WHERE sr.id = sri.sale_return_id
)
ORDER BY sri.sale_return_id;
