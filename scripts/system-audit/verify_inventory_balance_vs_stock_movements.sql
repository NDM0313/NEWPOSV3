-- verify_inventory_balance_vs_stock_movements.sql
-- Purpose: Verify that the trigger-maintained inventory_balance table matches
--          the movement-based canonical stock quantity per product.
-- Severity: P3 — inventory_balance is not read by app code but is maintained
--           by trigger trigger_sync_inventory_balance_from_movement. Divergence
--           indicates the trigger is missing movement types or failing silently.
-- Run: read-only; no writes.
-- Expected output: zero rows if the trigger is working correctly.

WITH movement_totals AS (
    -- Canonical stock per product: sum of all movements respecting direction.
    -- Convention: positive movement_type values add stock; negative remove it.
    -- Adjust sign logic below if your schema uses a separate quantity_in/quantity_out.
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
                ELSE quantity  -- unknown types: treat as additive; investigate separately
            END
        ) AS movement_based_qty
    FROM stock_movements
    GROUP BY product_id
),
cached_totals AS (
    -- Trigger-maintained cached quantity per product.
    SELECT
        product_id,
        SUM(quantity) AS cached_qty   -- assumes inventory_balance stores signed qty
    FROM inventory_balance
    GROUP BY product_id
),
all_products AS (
    SELECT product_id FROM movement_totals
    UNION
    SELECT product_id FROM cached_totals
)
SELECT
    ap.product_id,
    p.name                                          AS product_name,
    COALESCE(mt.movement_based_qty, 0)              AS movement_based_qty,
    COALESCE(ct.cached_qty, 0)                      AS cached_qty,
    COALESCE(mt.movement_based_qty, 0)
        - COALESCE(ct.cached_qty, 0)                AS divergence
FROM all_products ap
LEFT JOIN movement_totals mt  ON mt.product_id  = ap.product_id
LEFT JOIN cached_totals ct    ON ct.product_id  = ap.product_id
LEFT JOIN products p          ON p.id           = ap.product_id
WHERE
    ABS(
        COALESCE(mt.movement_based_qty, 0) - COALESCE(ct.cached_qty, 0)
    ) > 0.0001
ORDER BY ABS(
    COALESCE(mt.movement_based_qty, 0) - COALESCE(ct.cached_qty, 0)
) DESC;
