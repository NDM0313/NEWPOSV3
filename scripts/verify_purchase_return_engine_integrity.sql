-- =============================================================================
-- SCRIPT 7: verify_purchase_return_engine_integrity.sql
-- Purpose:  Verify that purchase returns correctly reverse stock movements,
--           that no unexpected settlement JEs were posted (purchase return
--           JE posting is not currently implemented by the service), that
--           return quantities are valid, that voided returns have reversed
--           their stock, and that stale draft returns are flagged.
-- Tables:   purchase_returns, purchase_return_items, purchase_items,
--           purchases, stock_movements, journal_entries, companies
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- =============================================================================

-- =============================================================================
-- CHECK 1: Final purchase returns with no stock reversal movement
-- Expected: 0 rows — when a purchase return is finalised, a stock_movements
--           row with movement_type='purchase_return' (negative quantity) must
--           be created for each returned item. Without this, the inventory
--           balance remains inflated even though the supplier was credited.
--           Fix: create the missing reversal movements via the inventory service.
-- =============================================================================
SELECT
    'CHECK 1: Final purchase returns with no stock reversal' AS check_name,
    pr.id                                                     AS return_id,
    pr.company_id,
    pr.original_purchase_id,
    pr.subtotal,
    pr.total,
    pr.status,
    pr.created_at,
    c.name                                                    AS company_name
FROM purchase_returns pr
JOIN companies c ON c.id = pr.company_id
WHERE pr.status = 'final'
  AND NOT EXISTS (
      SELECT 1
      FROM stock_movements sm
      WHERE sm.company_id    = pr.company_id
        AND sm.reference_id  = pr.id
        AND sm.movement_type = 'purchase_return'
  )
ORDER BY pr.company_id, pr.created_at DESC;

-- =============================================================================
-- CHECK 2: Final purchase returns WITH a settlement journal entry
-- Expected: 0 rows — per current service design, the purchase return service
--           does NOT post a GL settlement JE. Any JE found here was posted
--           by a previous version, a manual entry, or a bug. Review each
--           one: if the original purchase AP was already reversed elsewhere,
--           these JEs may double-count the credit to AP and should be voided.
-- =============================================================================
SELECT
    'CHECK 2: Purchase returns with unexpected settlement JE' AS check_name,
    pr.id                                                      AS return_id,
    pr.company_id,
    pr.original_purchase_id,
    pr.status,
    je.id                                                      AS je_id,
    je.entry_no,
    je.entry_date,
    je.created_at                                              AS je_created_at,
    c.name                                                     AS company_name
FROM purchase_returns pr
JOIN journal_entries je
    ON  je.reference_id   = pr.id::TEXT
    AND je.reference_type = 'purchase_return'
    AND je.company_id     = pr.company_id
    AND (je.is_void IS NULL OR je.is_void = FALSE)
JOIN companies c ON c.id = pr.company_id
WHERE pr.status = 'final'
ORDER BY pr.company_id, pr.created_at DESC;

-- =============================================================================
-- CHECK 3: Purchase return quantities exceeding original purchase quantities
-- Expected: 0 rows — the total quantity returned for a given purchase line
--           must not exceed the quantity originally purchased. An over-return
--           inflates AP credits and creates phantom stock reversal movements.
-- =============================================================================
SELECT
    'CHECK 3: Purchase return qty exceeds original purchase qty' AS check_name,
    pi.id                                                         AS purchase_item_id,
    pi.purchase_id,
    pi.product_id,
    pi.quantity                                                   AS purchased_qty,
    COALESCE(ret_agg.total_returned_qty, 0)                      AS total_returned_qty,
    COALESCE(ret_agg.total_returned_qty, 0) - pi.quantity        AS over_return_qty,
    p.company_id,
    c.name                                                        AS company_name
FROM purchase_items pi
JOIN purchases p  ON p.id  = pi.purchase_id
JOIN companies c  ON c.id  = p.company_id
LEFT JOIN (
    SELECT
        pri.purchase_item_id,
        SUM(pri.quantity) AS total_returned_qty
    FROM purchase_return_items pri
    JOIN purchase_returns pr ON pr.id = pri.purchase_return_id
    WHERE pr.status = 'final'
    GROUP BY pri.purchase_item_id
) ret_agg ON ret_agg.purchase_item_id = pi.id
WHERE COALESCE(ret_agg.total_returned_qty, 0) > pi.quantity
ORDER BY over_return_qty DESC;

-- =============================================================================
-- CHECK 4: Voided purchase returns with active (non-reversed) stock movements
-- Expected: 0 rows — when a purchase return is voided, any stock movement
--           that was created for it must be reversed (either deleted or offset
--           by a counter-movement). Active movements on a void return mean
--           inventory is incorrectly deflated.
-- =============================================================================
SELECT
    'CHECK 4: Voided purchase returns with active stock movements' AS check_name,
    pr.id                                                           AS return_id,
    pr.company_id,
    pr.original_purchase_id,
    pr.status                                                       AS return_status,
    sm.id                                                           AS movement_id,
    sm.product_id,
    sm.quantity,
    sm.movement_type,
    sm.created_at                                                   AS movement_created_at,
    c.name                                                          AS company_name
FROM purchase_returns pr
JOIN stock_movements sm
    ON  sm.reference_id  = pr.id
    AND sm.company_id    = pr.company_id
    AND sm.movement_type = 'purchase_return'
JOIN companies c ON c.id = pr.company_id
WHERE pr.status = 'void'
  -- Check if this movement has not been reversed by a counter movement
  AND NOT EXISTS (
      SELECT 1
      FROM stock_movements sm2
      WHERE sm2.reference_id    = pr.id
        AND sm2.company_id      = pr.company_id
        AND sm2.movement_type   = 'purchase_return_void'
        AND sm2.product_id      = sm.product_id
        AND sm2.variation_id    IS NOT DISTINCT FROM sm.variation_id
  )
ORDER BY pr.company_id, pr.created_at DESC;

-- =============================================================================
-- CHECK 5: Draft purchase returns older than 7 days (stale drafts)
-- Expected: 0 rows ideally — draft returns that have not been finalised or
--           cancelled within 7 days represent unresolved supplier negotiations
--           or forgotten workflows. These are not accounting errors yet, but
--           they will become one if the supplier dispute is resolved and the
--           draft is never finalised. Review with the purchasing team.
-- =============================================================================
SELECT
    'CHECK 5: Draft purchase returns older than 7 days' AS check_name,
    pr.id                                                AS return_id,
    pr.company_id,
    pr.original_purchase_id,
    pr.status,
    pr.total,
    pr.created_at,
    NOW() - pr.created_at                               AS age,
    EXTRACT(DAY FROM NOW() - pr.created_at)             AS days_old,
    p.supplier_name,
    c.name                                               AS company_name
FROM purchase_returns pr
JOIN purchases p  ON p.id  = pr.original_purchase_id
JOIN companies c  ON c.id  = pr.company_id
WHERE pr.status     = 'draft'
  AND pr.created_at < NOW() - INTERVAL '7 days'
ORDER BY pr.created_at ASC;
