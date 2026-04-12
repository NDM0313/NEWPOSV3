-- =============================================================================
-- SCRIPT 3: verify_products_variations_and_opening_stock.sql
-- Purpose:  Verify product and variation data integrity — inactive/ghost
--           products, negative stock, unposted opening stock, zero-price
--           variations, coverage gaps, and duplicate SKUs.
-- Tables:   products, product_variations, stock_movements, journal_entries,
--           sales_items, purchase_items, companies
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- =============================================================================

-- =============================================================================
-- CHECK 1: Active products with no stock movement ever
-- Expected: 0 rows (warning level) — an active product that has never been
--           sold, purchased, or given opening stock is likely misconfigured,
--           a test record, or was never initialised. Review and deactivate
--           or create an opening-stock movement as appropriate.
-- =============================================================================
SELECT
    'CHECK 1: Active products with no stock movement' AS check_name,
    p.id                                              AS product_id,
    p.company_id,
    p.name                                            AS product_name,
    p.retail_price,
    p.cost_price,
    p.created_at,
    c.name                                            AS company_name
FROM products p
JOIN companies c ON c.id = p.company_id
WHERE p.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.company_id = p.company_id
  )
ORDER BY p.company_id, p.name;

-- =============================================================================
-- CHECK 2: Products with negative current stock
-- Expected: 0 rows — negative stock is physically impossible and indicates
--           either a missing purchase/opening-stock movement, a double-counted
--           sale movement, or a voided purchase without reversing the stock.
--           Investigate each product's movement history and add a corrective
--           adjustment movement.
-- =============================================================================
SELECT
    'CHECK 2: Products with negative stock'  AS check_name,
    sm.company_id,
    sm.product_id,
    sm.variation_id,
    p.name                                   AS product_name,
    pv.name                                  AS variation_name,
    SUM(sm.quantity)                         AS current_stock,
    c.name                                   AS company_name
FROM stock_movements sm
JOIN products  p  ON p.id  = sm.product_id
JOIN companies c  ON c.id  = sm.company_id
LEFT JOIN product_variations pv ON pv.id = sm.variation_id
GROUP BY sm.company_id, sm.product_id, sm.variation_id, p.name, pv.name, c.name
HAVING SUM(sm.quantity) < 0
ORDER BY sm.company_id, current_stock ASC;

-- =============================================================================
-- CHECK 3: Opening stock movements with no corresponding GL journal entry
-- Expected: 0 rows — every opening-stock movement (reference_type =
--           'opening_balance') must be paired with a journal entry that
--           debits Inventory (1200) and credits Opening Balance Equity (3000).
--           Missing JEs mean the balance sheet is understated.
-- =============================================================================
SELECT
    'CHECK 3: Opening stock movements with no GL journal entry' AS check_name,
    sm.id                                                        AS movement_id,
    sm.company_id,
    sm.product_id,
    sm.reference_id,
    sm.quantity,
    sm.total_cost,
    sm.created_at,
    p.name                                                       AS product_name,
    c.name                                                       AS company_name
FROM stock_movements sm
JOIN products  p ON p.id  = sm.product_id
JOIN companies c ON c.id  = sm.company_id
WHERE sm.reference_type = 'opening_balance'
  AND NOT EXISTS (
      SELECT 1
      FROM journal_entries je
      WHERE je.company_id      = sm.company_id
        AND je.reference_id    = sm.reference_id
        AND je.reference_type  = 'opening_balance'
        AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
ORDER BY sm.company_id, sm.created_at;

-- =============================================================================
-- CHECK 4: Product variations with retail_price = 0 or NULL
-- Expected: 0 rows — a zero or null retail price will allow zero-value sales
--           to be posted silently. Every variation should have a positive price
--           before it is offered for sale.
-- =============================================================================
SELECT
    'CHECK 4: Variations with zero or null retail_price' AS check_name,
    pv.id                                                 AS variation_id,
    pv.product_id,
    pv.company_id,
    pv.name                                               AS variation_name,
    pv.sku,
    pv.retail_price,
    p.name                                                AS product_name,
    c.name                                                AS company_name
FROM product_variations pv
JOIN products  p ON p.id  = pv.product_id
JOIN companies c ON c.id  = pv.company_id
WHERE (pv.retail_price IS NULL OR pv.retail_price = 0)
  AND p.is_active = TRUE
ORDER BY pv.company_id, p.name, pv.name;

-- =============================================================================
-- CHECK 5: Products sold but never purchased (no purchase movement)
-- Expected: review carefully — these products may have been seeded via opening
--           stock (reference_type='opening_balance') rather than a purchase.
--           If no opening stock movement exists either, this indicates a data
--           gap: stock was consumed without ever being recorded as received.
-- =============================================================================
SELECT
    'CHECK 5: Products sold but never purchased or received' AS check_name,
    si_agg.company_id,
    si_agg.product_id,
    p.name                                                    AS product_name,
    si_agg.total_qty_sold,
    c.name                                                    AS company_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM stock_movements sm2
            WHERE sm2.product_id = si_agg.product_id
              AND sm2.company_id = si_agg.company_id
              AND sm2.reference_type = 'opening_balance'
        ) THEN 'has_opening_stock'
        ELSE 'NO_STOCK_SOURCE'
    END AS stock_source_status
FROM (
    SELECT
        s.company_id,
        si.product_id,
        SUM(si.quantity) AS total_qty_sold
    FROM sales_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.status = 'final'
    GROUP BY s.company_id, si.product_id
) si_agg
JOIN products  p ON p.id  = si_agg.product_id
JOIN companies c ON c.id  = si_agg.company_id
WHERE NOT EXISTS (
    SELECT 1
    FROM stock_movements sm
    WHERE sm.product_id    = si_agg.product_id
      AND sm.company_id    = si_agg.company_id
      AND sm.movement_type = 'purchase'
)
ORDER BY stock_source_status DESC, si_agg.company_id, p.name;

-- =============================================================================
-- CHECK 6: Duplicate product variation SKUs within the same company
-- Expected: 0 rows — SKUs must be unique per company. Duplicate SKUs cause
--           barcode scan ambiguity, incorrect stock updates, and mis-matched
--           purchase/sale line items. Rename or merge the duplicate variations.
-- =============================================================================
SELECT
    'CHECK 6: Duplicate variation SKUs within a company' AS check_name,
    pv.company_id,
    pv.sku,
    COUNT(pv.id)                                          AS sku_count,
    array_agg(pv.id   ORDER BY pv.id)                   AS variation_ids,
    array_agg(p.name  ORDER BY pv.id)                   AS product_names,
    array_agg(pv.name ORDER BY pv.id)                   AS variation_names,
    c.name                                                AS company_name
FROM product_variations pv
JOIN products  p ON p.id  = pv.product_id
JOIN companies c ON c.id  = pv.company_id
WHERE pv.sku IS NOT NULL
  AND pv.sku <> ''
GROUP BY pv.company_id, pv.sku, c.name
HAVING COUNT(pv.id) > 1
ORDER BY pv.company_id, pv.sku;
