-- ============================================================
-- Studio: Remove duplicate invoice lines per production order
-- Rule: 1 production order → 1 sale_items row
-- Strategy: keep the LATEST row (highest created_at), delete rest
-- ============================================================

-- Step 1: Preview what will be deleted (run this first to review)
/*
SELECT
  sp.id                     AS production_id,
  sp.sale_id,
  sp.generated_invoice_item_id,
  si.id                     AS item_id,
  si.sku,
  si.unit_price,
  si.created_at
FROM studio_productions sp
JOIN sales_items si
  ON si.sale_id = sp.sale_id
 AND si.is_studio_product = true
ORDER BY sp.id, si.created_at DESC;
*/

-- Step 2: Delete duplicate studio lines, keeping only the latest per sale
-- This uses a CTE to rank rows within each sale by created_at DESC
WITH ranked AS (
  SELECT
    si.id,
    si.sale_id,
    si.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY si.sale_id
      ORDER BY si.created_at DESC
    ) AS rn
  FROM sales_items si
  WHERE si.is_studio_product = true
)
DELETE FROM sales_items
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Step 3: Recalculate sale totals for any affected sales
-- (run after the delete to fix any totals that may have drifted)
UPDATE sales s
SET
  total = (
    SELECT COALESCE(SUM(si.unit_price * si.quantity), 0)
    FROM sales_items si
    WHERE si.sale_id = s.id
  ) + COALESCE(
    (SELECT SUM(ss.charged_to_customer) FROM sale_shipments ss WHERE ss.sale_id = s.id), 0
  ),
  updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT sale_id FROM sales_items WHERE is_studio_product = true
);
