-- PO2025/0003 — split bundled clearance into line unit prices + header freight
-- Formula: alloc_i = clearance_total × (line.total / sum(line.totals)); new unit = (total - alloc) / qty
--
-- Dry-run:
--   Get-Content scripts/sql/repair_po2025_0003_clearance_line_split.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"
--
-- Apply (transaction + gates):
--   (same pipe with -v ON_ERROR_STOP=1; script uses BEGIN/COMMIT)

\set ON_ERROR_STOP on

\set purchase_id 'a065035c-dca2-4079-837a-9c2aeca9332d'
\set clearance_total 24573440.00
\set expected_total 67978418.40

BEGIN;

-- Snapshot bundled line totals before change
CREATE TEMP TABLE po_line_split_plan ON COMMIT DROP AS
WITH base AS (
  SELECT
    pi.id,
    pi.product_name,
    pi.quantity,
    pi.unit_price,
    pi.total AS old_total,
    SUM(pi.total) OVER () AS bundled_subtotal
  FROM purchase_items pi
  WHERE pi.purchase_id = :'purchase_id'::uuid
)
SELECT
  id,
  product_name,
  quantity,
  unit_price AS old_unit_price,
  old_total,
  ROUND((:'clearance_total'::numeric * old_total / NULLIF(bundled_subtotal, 0)), 2) AS courier_alloc,
  ROUND(old_total - (:'clearance_total'::numeric * old_total / NULLIF(bundled_subtotal, 0)), 2) AS new_line_total,
  ROUND(
    (old_total - (:'clearance_total'::numeric * old_total / NULLIF(bundled_subtotal, 0)))
    / NULLIF(quantity, 0),
    4
  ) AS new_unit_price
FROM base;

SELECT 'DRY-RUN plan' AS phase, product_name, quantity, old_unit_price, new_unit_price, courier_alloc, new_line_total
FROM po_line_split_plan
ORDER BY product_name;

UPDATE purchase_items pi
SET
  unit_price = p.new_unit_price,
  total = p.new_line_total
FROM po_line_split_plan p
WHERE pi.id = p.id;

-- Ensure header freight matches clearance (trigger on items updates subtotal/total)
UPDATE purchases
SET
  shipping_cost = :'clearance_total',
  updated_at = NOW()
WHERE id = :'purchase_id'::uuid;

DO $$
DECLARE
  v_alloc_sum NUMERIC;
  v_subtotal NUMERIC;
  v_total NUMERIC;
  v_shipping NUMERIC;
BEGIN
  SELECT ROUND(COALESCE(SUM(courier_alloc), 0), 2) INTO v_alloc_sum FROM po_line_split_plan;
  SELECT subtotal, total, shipping_cost
  INTO v_subtotal, v_total, v_shipping
  FROM purchases WHERE id = 'a065035c-dca2-4079-837a-9c2aeca9332d';

  IF ABS(v_alloc_sum - 24573440.00) > 0.05 THEN
    RAISE EXCEPTION 'Gate fail: alloc sum % (expected 24573440)', v_alloc_sum;
  END IF;
  IF ABS(v_total - 67978418.40) > 0.05 THEN
    RAISE EXCEPTION 'Gate fail: purchase total % (expected 67978418.40)', v_total;
  END IF;
  IF ABS(v_shipping - 24573440.00) > 0.01 THEN
    RAISE EXCEPTION 'Gate fail: shipping_cost %', v_shipping;
  END IF;
  IF ABS(v_subtotal + v_shipping - v_total) > 0.05 THEN
    RAISE EXCEPTION 'Gate fail: subtotal+shipping % <> total %', v_subtotal + v_shipping, v_total;
  END IF;
END $$;

COMMIT;

SELECT po_no, subtotal, shipping_cost, total, paid_amount, due_amount
FROM purchases WHERE id = :'purchase_id'::uuid;
