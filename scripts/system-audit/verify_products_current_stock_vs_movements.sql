-- verify_products_current_stock_vs_movements.sql
-- Purpose: Identify products where products.current_stock diverges from the
--          movement-based canonical quantity.
-- Severity: P3 — products.current_stock is suppressed in queries and writes
--           (productService.ts:59, 206-209) but is still used as a display
--           fallback in POS.tsx. Divergence causes incorrect stock shown to
--           cashiers while the movement-based total loads.
-- Run: read-only; no writes.
-- Expected output: zero rows if the cached field has been zeroed or dropped.

WITH movement_totals AS (
    SELECT
        product_id,
        SUM(
            CASE
                WHEN movement_type IN (
                    'purchase', 'purchase_return_reversal', 'adjustment_in', 'opening'
                ) THEN quantity
                WHEN movement_type IN (
                    'sale', 'purchase_return', 'adjustment_out', 'transfer_out'
                ) THEN -quantity
                ELSE quantity
            END
        ) AS movement_based_qty
    FROM stock_movements
    GROUP BY product_id
)
SELECT
    p.id                                                        AS product_id,
    p.name                                                      AS product_name,
    p.sku,
    COALESCE(p.current_stock, 0)                               AS cached_current_stock,
    COALESCE(mt.movement_based_qty, 0)                         AS movement_based_qty,
    COALESCE(p.current_stock, 0)
        - COALESCE(mt.movement_based_qty, 0)                   AS divergence,
    ABS(
        COALESCE(p.current_stock, 0)
        - COALESCE(mt.movement_based_qty, 0)
    )                                                          AS abs_divergence
FROM products p
LEFT JOIN movement_totals mt ON mt.product_id = p.id
WHERE
    p.current_stock IS NOT NULL
    AND ABS(
        COALESCE(p.current_stock, 0) - COALESCE(mt.movement_based_qty, 0)
    ) > 0.0001
ORDER BY abs_divergence DESC;
