-- =============================================================================
-- SCRIPT 9: verify_inventory_qty_value_integrity.sql
-- Purpose:  Verify inventory quantity and value integrity — cached balance
--           divergence, negative stock, orphan movements, cost vs price
--           mismatches on sale movements, ghost movements from voided sales,
--           and a high-level inventory value reconciliation.
-- Tables:   stock_movements, inventory_balance, products, product_variations,
--           sales, sales_items, journal_entries, companies
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- =============================================================================

-- =============================================================================
-- CHECK 1: inventory_balance.quantity diverges from SUM(stock_movements.quantity)
-- Expected: 0 rows — inventory_balance is a cached snapshot. If its quantity
--           differs from the authoritative movement sum by more than 0.001,
--           the cache is stale. UI stock displays will be wrong until the
--           cache is refreshed. Fix: run the inventory balance recalculation
--           job, or update directly from the movements aggregate.
-- =============================================================================
SELECT
    'CHECK 1: inventory_balance quantity diverges from movements' AS check_name,
    ib.company_id,
    ib.branch_id,
    ib.product_id,
    ib.variation_id,
    ib.quantity                                                    AS cached_qty,
    COALESCE(sm_agg.total_qty, 0)                                 AS movements_qty,
    ABS(ib.quantity - COALESCE(sm_agg.total_qty, 0))             AS divergence,
    p.name                                                         AS product_name,
    pv.name                                                        AS variation_name,
    c.name                                                         AS company_name
FROM inventory_balance ib
JOIN products  p  ON p.id  = ib.product_id
JOIN companies c  ON c.id  = ib.company_id
LEFT JOIN product_variations pv ON pv.id = ib.variation_id
LEFT JOIN (
    SELECT
        company_id,
        branch_id,
        product_id,
        variation_id,
        SUM(quantity) AS total_qty
    FROM stock_movements
    GROUP BY company_id, branch_id, product_id, variation_id
) sm_agg
    ON  sm_agg.company_id  = ib.company_id
    AND sm_agg.branch_id   = ib.branch_id
    AND sm_agg.product_id  = ib.product_id
    AND sm_agg.variation_id IS NOT DISTINCT FROM ib.variation_id
WHERE ABS(ib.quantity - COALESCE(sm_agg.total_qty, 0)) > 0.001
ORDER BY divergence DESC;

-- =============================================================================
-- CHECK 2: Products/variations with negative total stock (from movements)
-- Expected: 0 rows — negative stock is physically impossible. Causes include:
--           sales movements posted without prior purchase/opening stock, a
--           voided purchase that didn't reverse stock, or a data migration gap.
--           List every negative line so each can be investigated individually.
-- =============================================================================
SELECT
    'CHECK 2: Products with negative total stock' AS check_name,
    sm.company_id,
    sm.branch_id,
    sm.product_id,
    sm.variation_id,
    SUM(sm.quantity)                              AS current_stock,
    p.name                                        AS product_name,
    pv.name                                       AS variation_name,
    c.name                                        AS company_name
FROM stock_movements sm
JOIN products  p  ON p.id  = sm.product_id
JOIN companies c  ON c.id  = sm.company_id
LEFT JOIN product_variations pv ON pv.id = sm.variation_id
GROUP BY sm.company_id, sm.branch_id, sm.product_id, sm.variation_id,
         p.name, pv.name, c.name
HAVING SUM(sm.quantity) < 0
ORDER BY current_stock ASC;

-- =============================================================================
-- CHECK 3: Stock movements with NULL product_id (orphan movements)
-- Expected: 0 rows — every stock movement must reference a valid product.
--           NULL product_id movements cannot be attributed to any item and
--           will silently corrupt all inventory aggregations.
--           Fix: delete these rows if they are confirmed bogus, or update
--           product_id to the correct product if recoverable.
-- =============================================================================
SELECT
    'CHECK 3: Stock movements with NULL product_id' AS check_name,
    sm.id                                            AS movement_id,
    sm.company_id,
    sm.branch_id,
    sm.movement_type,
    sm.reference_type,
    sm.reference_id,
    sm.quantity,
    sm.unit_cost,
    sm.total_cost,
    sm.created_at,
    c.name                                           AS company_name
FROM stock_movements sm
JOIN companies c ON c.id = sm.company_id
WHERE sm.product_id IS NULL
ORDER BY sm.company_id, sm.created_at DESC;

-- =============================================================================
-- CHECK 4: Sale stock movements where ABS(total_cost) != sale line total
-- Expected: review carefully — ideally the movement total_cost reflects the
--           cost of goods (cost_price * qty), NOT the selling price.
--           This check flags where the cost recorded in the movement appears
--           to equal the selling price instead (often a copy-paste bug in
--           the service layer). A mismatch here inflates COGS if selling
--           price > cost, or understates it if selling price < cost.
-- NOTE:     This cross-references stock_movements with sales_items totals.
--           Movement total_cost should reflect cost_price * qty, not unit_price * qty.
-- =============================================================================
SELECT
    'CHECK 4: Sale movements where total_cost matches selling price (not cost)' AS check_name,
    sm.id                                                                         AS movement_id,
    sm.company_id,
    sm.product_id,
    sm.variation_id,
    sm.quantity,
    sm.unit_cost,
    sm.total_cost,
    si.unit_price                                                                 AS selling_unit_price,
    si.total                                                                      AS sale_line_total,
    p.cost_price,
    p.cost_price * sm.quantity                                                    AS expected_cogs,
    ABS(sm.total_cost - si.total)                                                AS cost_vs_sell_delta,
    c.name                                                                        AS company_name
FROM stock_movements sm
JOIN products   p  ON p.id  = sm.product_id
JOIN companies  c  ON c.id  = sm.company_id
JOIN sales      s  ON s.id  = sm.reference_id
                   AND sm.reference_type = 'sale'
                   AND sm.movement_type  = 'sale'
JOIN sales_items si
    ON  si.sale_id     = s.id
    AND si.product_id  = sm.product_id
    AND si.variation_id IS NOT DISTINCT FROM sm.variation_id
WHERE ABS(sm.total_cost - si.total) < 0.01  -- total_cost matches selling price
  AND ABS(sm.total_cost - (p.cost_price * sm.quantity)) > 0.01  -- but NOT cost price
ORDER BY cost_vs_sell_delta DESC, sm.company_id;

-- =============================================================================
-- CHECK 5: Stock movements for voided sales that are not themselves reversed
-- Expected: 0 rows — when a sale is voided, the corresponding sale stock
--           movements must be reversed (either deleted or offset by a counter-
--           movement with movement_type='sale_void'). Un-reversed ghost
--           movements silently deflate inventory.
-- =============================================================================
SELECT
    'CHECK 5: Ghost stock movements from voided sales' AS check_name,
    sm.id                                               AS movement_id,
    sm.company_id,
    sm.product_id,
    sm.variation_id,
    sm.quantity,
    sm.movement_type,
    sm.reference_id                                     AS sale_id,
    sm.created_at,
    s.invoice_no,
    s.status                                            AS sale_status,
    c.name                                              AS company_name
FROM stock_movements sm
JOIN sales     s  ON s.id  = sm.reference_id AND sm.reference_type = 'sale'
JOIN companies c  ON c.id  = sm.company_id
WHERE sm.movement_type = 'sale'
  AND s.status IN ('void', 'cancelled')
  AND NOT EXISTS (
      SELECT 1
      FROM stock_movements sm2
      WHERE sm2.reference_id   = sm.reference_id
        AND sm2.company_id     = sm.company_id
        AND sm2.product_id     = sm.product_id
        AND sm2.variation_id   IS NOT DISTINCT FROM sm.variation_id
        AND sm2.movement_type  IN ('sale_void', 'sale_cancel')
  )
ORDER BY sm.company_id, sm.created_at DESC;

-- =============================================================================
-- CHECK 6: High-level inventory value reconciliation
-- Purpose: Compute expected inventory value as:
--   Opening stock value + Purchase value - COGS (sale movements) - Return adjustments
--   and compare to SUM(stock_movements.total_cost) as the authoritative figure.
-- Expected: discrepancy should be near 0. A large variance indicates one of
--   the movement categories (opening, purchase, sale, return) has incorrect
--   total_cost values, or movements are missing/duplicated.
-- =============================================================================
SELECT
    'CHECK 6: Inventory value reconciliation by company'       AS check_name,
    sm.company_id,
    SUM(CASE WHEN sm.reference_type = 'opening_balance'
             THEN sm.total_cost ELSE 0 END)                   AS opening_stock_value,
    SUM(CASE WHEN sm.movement_type = 'purchase'
             THEN sm.total_cost ELSE 0 END)                   AS purchase_value_in,
    SUM(CASE WHEN sm.movement_type = 'sale'
             THEN ABS(sm.total_cost) ELSE 0 END)              AS cogs_out,
    SUM(CASE WHEN sm.movement_type IN ('sale_return','purchase_return')
             THEN sm.total_cost ELSE 0 END)                   AS returns_net,
    SUM(sm.total_cost)                                        AS net_inventory_value,
    COUNT(sm.id)                                              AS total_movement_rows,
    c.name                                                    AS company_name
FROM stock_movements sm
JOIN companies c ON c.id = sm.company_id
GROUP BY sm.company_id, c.name
ORDER BY sm.company_id;
