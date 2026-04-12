-- =============================================================================
-- SCRIPT 4: verify_sales_engine_integrity.sql
-- Purpose:  Verify that every finalised sale has a matching GL journal entry,
--           that JE amounts agree with the sale total, that stock movements
--           were created, that line-item totals reconcile, that discounts are
--           sane, and that paid sales have enough payment postings.
-- Tables:   sales, sales_items, journal_entries, journal_entry_lines,
--           stock_movements, companies
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- =============================================================================

-- =============================================================================
-- CHECK 1: Final sales with no GL journal entry
-- Expected: 0 rows — every sale in status='final' must have at least one
--           active (non-void) journal entry with reference_type='sale'.
--           Missing JEs mean revenue and AR/cash are not recorded in the GL.
--           Re-post the sale via the sale service to create the missing JE.
-- =============================================================================
SELECT
    'CHECK 1: Final sales with no GL journal entry' AS check_name,
    s.id                                             AS sale_id,
    s.company_id,
    s.invoice_no,
    s.total,
    s.payment_method,
    s.created_at,
    c.name                                           AS company_name
FROM sales s
JOIN companies c ON c.id = s.company_id
WHERE s.status = 'final'
  AND NOT EXISTS (
      SELECT 1
      FROM journal_entries je
      WHERE je.company_id     = s.company_id
        AND je.reference_id   = s.id::TEXT
        AND je.reference_type = 'sale'
        AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
ORDER BY s.company_id, s.created_at DESC;

-- =============================================================================
-- CHECK 2: Final sales where the JE debit total != sale.total
-- Expected: 0 rows — the total debit (or credit) posted in the settlement
--           journal entry must equal sales.total exactly (within 0.01).
--           A mismatch means the wrong amount was posted to the GL,
--           causing AR/cash to be over- or under-stated.
-- =============================================================================
WITH sale_je_totals AS (
    SELECT
        je.reference_id                 AS sale_id,
        je.company_id,
        SUM(jel.debit)                  AS total_debit
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE je.reference_type = 'sale'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
    GROUP BY je.reference_id, je.company_id
)
SELECT
    'CHECK 2: Final sales with JE amount mismatch' AS check_name,
    s.id                                            AS sale_id,
    s.company_id,
    s.invoice_no,
    s.total                                         AS sale_total,
    sjt.total_debit                                 AS je_debit_total,
    ABS(s.total - sjt.total_debit)                 AS discrepancy,
    c.name                                          AS company_name
FROM sales s
JOIN sale_je_totals sjt ON sjt.sale_id = s.id::TEXT AND sjt.company_id = s.company_id
JOIN companies       c  ON c.id = s.company_id
WHERE s.status = 'final'
  AND ABS(s.total - COALESCE(sjt.total_debit, 0)) > 0.01
ORDER BY discrepancy DESC;

-- =============================================================================
-- CHECK 3: Final sales with no stock movement
-- Expected: 0 rows — every finalised sale must generate stock_movements rows
--           with movement_type='sale' for each line item. Missing movements
--           mean inventory levels are overstated. Check if the sale was posted
--           before stock movement logic was added (migration gap) or if the
--           service threw an error after posting the JE.
-- =============================================================================
SELECT
    'CHECK 3: Final sales with no stock movement' AS check_name,
    s.id                                           AS sale_id,
    s.company_id,
    s.invoice_no,
    s.total,
    s.created_at,
    c.name                                         AS company_name
FROM sales s
JOIN companies c ON c.id = s.company_id
WHERE s.status = 'final'
  AND NOT EXISTS (
      SELECT 1
      FROM stock_movements sm
      WHERE sm.company_id    = s.company_id
        AND sm.reference_id  = s.id
        AND sm.movement_type = 'sale'
  )
ORDER BY s.company_id, s.created_at DESC;

-- =============================================================================
-- CHECK 4: Sales where SUM(sales_items.total) != sales.subtotal
-- Expected: 0 rows — the sum of all line item totals must equal the invoice
--           subtotal (before discount and tax). A mismatch indicates either
--           a rounding error in the application layer or a line was
--           deleted/edited after the sale was finalised.
-- =============================================================================
SELECT
    'CHECK 4: Sales with line-item total mismatch' AS check_name,
    s.id                                            AS sale_id,
    s.company_id,
    s.invoice_no,
    s.subtotal                                      AS recorded_subtotal,
    line_sum.calculated_subtotal,
    ABS(s.subtotal - line_sum.calculated_subtotal) AS discrepancy,
    c.name                                          AS company_name
FROM sales s
JOIN companies c ON c.id = s.company_id
JOIN (
    SELECT
        si.sale_id,
        SUM(si.total) AS calculated_subtotal
    FROM sales_items si
    GROUP BY si.sale_id
) line_sum ON line_sum.sale_id = s.id
WHERE s.status IN ('final', 'draft')
  AND ABS(s.subtotal - line_sum.calculated_subtotal) > 0.01
ORDER BY discrepancy DESC;

-- =============================================================================
-- CHECK 5: Sales with discount_amount > subtotal (impossible discount)
-- Expected: 0 rows — a discount cannot exceed the subtotal; that would
--           result in a negative invoice total. This indicates a data-entry
--           bug or a UI validation gap. Void and re-enter the affected sale.
-- =============================================================================
SELECT
    'CHECK 5: Sales where discount_amount > subtotal' AS check_name,
    s.id                                               AS sale_id,
    s.company_id,
    s.invoice_no,
    s.subtotal,
    s.discount_amount,
    s.total,
    s.status,
    c.name                                             AS company_name
FROM sales s
JOIN companies c ON c.id = s.company_id
WHERE COALESCE(s.discount_amount, 0) > COALESCE(s.subtotal, 0)
  AND s.status NOT IN ('void', 'cancelled')
ORDER BY s.company_id, s.created_at DESC;

-- =============================================================================
-- CHECK 6: Final paid sales where payment JEs are short of sale.total
-- Expected: 0 rows — if payment_status='paid', the cumulative amount posted
--           to GL accounts from payment JEs referencing this sale must cover
--           the full sale total (within 1.00 tolerance).
--           A shortfall means the sale is marked paid but the cash/bank account
--           was not fully debited in the GL.
-- NOTE:     This joins via reference_id='payment' JEs that also contain the
--           sale's reference_id in a linked payment allocation. If payment
--           allocations table structure differs, adjust the join accordingly.
-- =============================================================================
WITH payment_je_totals AS (
    SELECT
        je.reference_id   AS payment_reference,
        je.company_id,
        SUM(jel.debit)    AS total_payment_posted
    FROM journal_entries     je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE je.reference_type = 'payment'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
    GROUP BY je.reference_id, je.company_id
),
sale_payment_je AS (
    -- Payment JEs that reference this sale via reference_id matching the sale JE chain.
    -- Fallback: find payment JEs whose reference_id appears in sale JEs for the same sale.
    SELECT
        s.id                                           AS sale_id,
        s.company_id,
        COALESCE(SUM(pjt.total_payment_posted), 0)    AS total_paid_in_gl
    FROM sales s
    LEFT JOIN journal_entries je_pay
        ON  je_pay.company_id     = s.company_id
        AND je_pay.reference_type = 'payment'
        AND (je_pay.is_void IS NULL OR je_pay.is_void = FALSE)
        -- payment JEs that have a line referencing the sale account or sale reference
        AND EXISTS (
            SELECT 1
            FROM journal_entry_lines jel_pay
            WHERE jel_pay.journal_entry_id = je_pay.id
              AND jel_pay.description ILIKE '%' || s.invoice_no || '%'
        )
    LEFT JOIN payment_je_totals pjt
        ON pjt.payment_reference = je_pay.reference_id
       AND pjt.company_id        = s.company_id
    WHERE s.status         = 'final'
      AND s.payment_status = 'paid'
    GROUP BY s.id, s.company_id
)
SELECT
    'CHECK 6: Paid sales with GL payment shortfall > 1.00' AS check_name,
    s.id                                                     AS sale_id,
    s.company_id,
    s.invoice_no,
    s.total                                                  AS sale_total,
    spj.total_paid_in_gl,
    s.total - spj.total_paid_in_gl                          AS shortfall,
    c.name                                                   AS company_name
FROM sales s
JOIN sale_payment_je spj ON spj.sale_id = s.id AND spj.company_id = s.company_id
JOIN companies        c  ON c.id = s.company_id
WHERE s.status         = 'final'
  AND s.payment_status = 'paid'
  AND (s.total - spj.total_paid_in_gl) > 1.00
ORDER BY shortfall DESC;
