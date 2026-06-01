-- Link fabric child to parent + post stock for SL-0007 WO
UPDATE public.sales_items
   SET bespoke_parent_item_id = '9ef3ec40-850f-4959-9484-928490d5265c'::uuid
 WHERE id = '2af29fab-2f7b-433c-b43a-7702f44ff63f'::uuid
   AND bespoke_parent_item_id IS NULL;

WITH wo AS (
  SELECT w.id AS wo_id,
         w.company_id,
         COALESCE(w.branch_id, s.branch_id) AS branch_id,
         w.work_order_no
  FROM public.bespoke_work_orders w
  JOIN public.sales s ON s.id = w.sale_id
  WHERE w.id = 'bf4c47af-0e73-470c-b837-9579f31e73f1'::uuid
),
fabric AS (
  SELECT
    wo.wo_id,
    wo.company_id,
    wo.branch_id,
    wo.work_order_no,
    si.product_id,
    si.variation_id,
    si.quantity,
    COALESCE(NULLIF(si.unit_price, 0), p.cost_price, 0) AS unit_cost,
    COALESCE(si.product_name, si.sku, si.product_id::text) AS line_name
  FROM wo
  JOIN public.sales_items si ON si.id = '2af29fab-2f7b-433c-b43a-7702f44ff63f'::uuid
  LEFT JOIN public.products p ON p.id = si.product_id
  WHERE COALESCE(si.quantity, 0) > 0
)
INSERT INTO public.stock_movements (
  company_id, branch_id, product_id, variation_id,
  quantity, unit_cost, total_cost,
  movement_type, reference_type, reference_id,
  notes, created_at
)
SELECT
  f.company_id,
  f.branch_id,
  f.product_id,
  f.variation_id,
  -f.quantity,
  f.unit_cost,
  -f.quantity * f.unit_cost,
  'sale',
  'bespoke_work_order',
  f.wo_id,
  'Bespoke fabric OUT — ' || COALESCE(f.work_order_no, f.wo_id::text) || ' — ' || f.line_name,
  now()
FROM fabric f
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_movements sm
  WHERE sm.reference_type = 'bespoke_work_order'
    AND sm.reference_id = f.wo_id
    AND sm.product_id = f.product_id
    AND COALESCE(sm.variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = COALESCE(f.variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
RETURNING id, product_id, quantity, notes;

-- Parent custom-order line OUT (CUSTOM-BRIDAL ledger) — uses live parent_sales_item_id on WO
WITH wo AS (
  SELECT w.id AS wo_id,
         w.company_id,
         COALESCE(w.branch_id, s.branch_id) AS branch_id,
         w.work_order_no,
         w.parent_sales_item_id
  FROM public.bespoke_work_orders w
  JOIN public.sales s ON s.id = w.sale_id
  WHERE w.id = 'bf4c47af-0e73-470c-b837-9579f31e73f1'::uuid
),
parent_line AS (
  SELECT
    wo.wo_id,
    wo.company_id,
    wo.branch_id,
    wo.work_order_no,
    si.product_id,
    si.variation_id,
    si.quantity,
    COALESCE(NULLIF(si.unit_price, 0), p.cost_price, 0) AS unit_cost,
    COALESCE(si.product_name, si.sku, si.product_id::text) AS line_name
  FROM wo
  JOIN public.sales_items si ON si.id = wo.parent_sales_item_id
  LEFT JOIN public.products p ON p.id = si.product_id
  WHERE COALESCE(si.quantity, 0) > 0
)
INSERT INTO public.stock_movements (
  company_id, branch_id, product_id, variation_id,
  quantity, unit_cost, total_cost,
  movement_type, reference_type, reference_id,
  notes, created_at
)
SELECT
  pl.company_id,
  pl.branch_id,
  pl.product_id,
  pl.variation_id,
  pl.quantity,
  pl.unit_cost,
  pl.quantity * pl.unit_cost,
  'sale',
  'bespoke_work_order',
  pl.wo_id,
  'Bespoke custom order IN — ' || COALESCE(pl.work_order_no, pl.wo_id::text) || ' — ' || pl.line_name,
  now()
FROM parent_line pl
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_movements sm
  WHERE sm.reference_type = 'bespoke_work_order'
    AND sm.reference_id = pl.wo_id
    AND sm.product_id = pl.product_id
    AND COALESCE(sm.variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = COALESCE(pl.variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      sm.notes LIKE 'Bespoke custom order IN%'
      OR sm.notes LIKE 'Bespoke custom order OUT%'
    )
)
RETURNING id, product_id, quantity, notes;
