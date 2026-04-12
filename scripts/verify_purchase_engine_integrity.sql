-- =============================================================================
-- SCRIPT 6: verify_purchase_engine_integrity.sql
-- Purpose:  Verify that every finalised purchase has a matching GL journal
--           entry, that stock movements were created, that line-item totals
--           reconcile, that no purchase was double-posted, and that paid
--           purchases have sufficient payment postings.
-- Tables:   purchases, purchase_items, journal_entries, journal_entry_lines,
--           stock_movements, companies
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- =============================================================================

-- =============================================================================
-- CHECK 1: Final purchases with no GL journal entry
-- Expected: 0 rows — every purchase in status='final' must have at least one
--           active (non-void) journal entry with reference_type='purchase'.
--           Missing JEs mean Inventory is understated and AP is not recorded.
--           Fix: re-post the purchase via the purchase service.
-- =============================================================================
SELECT
    'CHECK 1: Final purchases with no GL journal entry' AS check_name,
    p.id                                                 AS purchase_id,
    p.company_id,
    p.supplier_name,
    p.total,
    p.status,
    p.created_at,
    c.name                                               AS company_name
FROM purchases p
JOIN companies c ON c.id = p.company_id
WHERE p.status = 'final'
  AND NOT EXISTS (
      SELECT 1
      FROM journal_entries je
      WHERE je.company_id     = p.company_id
        AND je.reference_id   = p.id::TEXT
        AND je.reference_type = 'purchase'
        AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
ORDER BY p.company_id, p.created_at DESC;

-- =============================================================================
-- CHECK 2: Final purchases with no stock movement
-- Expected: 0 rows — every finalised purchase must generate stock_movements
--           with movement_type='purchase' for each line item. Missing movements
--           mean inventory levels are understated even though the cost was
--           posted to the GL. This is especially dangerous as it can lead to
--           negative stock on subsequent sales.
-- =============================================================================
SELECT
    'CHECK 2: Final purchases with no stock movement' AS check_name,
    p.id                                               AS purchase_id,
    p.company_id,
    p.supplier_name,
    p.total,
    p.created_at,
    c.name                                             AS company_name
FROM purchases p
JOIN companies c ON c.id = p.company_id
WHERE p.status = 'final'
  AND NOT EXISTS (
      SELECT 1
      FROM stock_movements sm
      WHERE sm.company_id    = p.company_id
        AND sm.reference_id  = p.id
        AND sm.movement_type = 'purchase'
  )
ORDER BY p.company_id, p.created_at DESC;

-- =============================================================================
-- CHECK 3: Purchases where SUM(purchase_items.total) != purchases.subtotal
-- Expected: 0 rows — the sum of all purchase line totals must equal the
--           recorded subtotal (before discount). A mismatch could be caused
--           by a line being edited after finalisation, a rounding bug, or
--           a direct DB update bypassing the application layer.
-- =============================================================================
SELECT
    'CHECK 3: Purchases with line-item total mismatch' AS check_name,
    p.id                                                AS purchase_id,
    p.company_id,
    p.supplier_name,
    p.subtotal                                          AS recorded_subtotal,
    line_sum.calculated_subtotal,
    ABS(p.subtotal - line_sum.calculated_subtotal)     AS discrepancy,
    c.name                                              AS company_name
FROM purchases p
JOIN companies c ON c.id = p.company_id
JOIN (
    SELECT
        pi.purchase_id,
        SUM(pi.total) AS calculated_subtotal
    FROM purchase_items pi
    GROUP BY pi.purchase_id
) line_sum ON line_sum.purchase_id = p.id
WHERE p.status IN ('final', 'draft')
  AND ABS(p.subtotal - line_sum.calculated_subtotal) > 0.01
ORDER BY discrepancy DESC;

-- =============================================================================
-- CHECK 4: Purchases with duplicate active JEs (double-posted)
-- Expected: 0 rows — the action_fingerprint UNIQUE partial index prevents
--           duplicate posting in the normal flow. However, if a purchase was
--           posted via two different code paths (or a fingerprint was NULL),
--           two active JEs could exist for the same purchase. This double-
--           counts inventory cost and AP, inflating both sides of the balance
--           sheet. Fix by voiding the duplicate JE.
-- =============================================================================
SELECT
    'CHECK 4: Purchases with duplicate active JEs (double-posted)' AS check_name,
    je.reference_id                                                  AS purchase_id,
    je.company_id,
    COUNT(je.id)                                                     AS active_je_count,
    array_agg(je.id      ORDER BY je.created_at)                   AS je_ids,
    array_agg(je.entry_no ORDER BY je.created_at)                  AS entry_nos,
    array_agg(je.created_at ORDER BY je.created_at)                AS created_ats,
    c.name                                                           AS company_name
FROM journal_entries je
JOIN companies c ON c.id = je.company_id
WHERE je.reference_type = 'purchase'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.reference_id, je.company_id, c.name
HAVING COUNT(je.id) > 1
ORDER BY active_je_count DESC, je.company_id;

-- =============================================================================
-- CHECK 5: Paid purchases where sum of payment JEs < purchase.total - 1.00
-- Expected: 0 rows — if payment_status='paid', the GL must reflect the full
--           payment amount via payment JEs that credit AP and debit Cash/Bank.
--           A shortfall means the purchase is marked paid but the GL under-
--           states cash outflow. This will cause AP to appear inflated and
--           cash/bank to appear overstated.
-- NOTE:     Identifies payment JEs via reference_type='payment' and description
--           match on the purchase reference. Adjust if your payment posting
--           uses a different linkage mechanism.
-- =============================================================================
WITH purchase_payment_totals AS (
    SELECT
        je.company_id,
        jel.description,
        SUM(jel.credit) AS total_credit
    FROM journal_entries     je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE je.reference_type = 'payment'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
    GROUP BY je.company_id, je.reference_id, jel.description
),
purchase_paid_gl AS (
    SELECT
        p.id         AS purchase_id,
        p.company_id,
        p.total,
        COALESCE(SUM(ppt.total_credit), 0) AS total_paid_gl
    FROM purchases p
    LEFT JOIN purchase_payment_totals ppt
        ON  ppt.company_id = p.company_id
        AND ppt.description ILIKE '%' || CAST(p.id AS TEXT) || '%'
    WHERE p.status         = 'final'
      AND p.payment_status = 'paid'
    GROUP BY p.id, p.company_id, p.total
)
SELECT
    'CHECK 5: Paid purchases with GL payment shortfall > 1.00' AS check_name,
    ppg.purchase_id,
    ppg.company_id,
    ppg.total                                                    AS purchase_total,
    ppg.total_paid_gl,
    ppg.total - ppg.total_paid_gl                               AS shortfall,
    c.name                                                       AS company_name
FROM purchase_paid_gl ppg
JOIN companies c ON c.id = ppg.company_id
WHERE (ppg.total - ppg.total_paid_gl) > 1.00
ORDER BY shortfall DESC;
