-- verify_sale_return_partial_value_and_terminal_state.sql
-- Read-only verification. Replace the company UUID in `params` before running.
--
-- Flags:
--  A) Partial return (return qty < original sale line qty) but return line total ~= full original line total.
--  B) Voided sale return with more than one sale_return_void stock row per (return, product, variation).
--  C) Final sale return: count active (non-void) journal_entries with reference_type sale_return.

WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS company_id
),
sr AS (
  SELECT r.id, r.company_id, r.original_sale_id, r.status, r.return_no
  FROM public.sale_returns r
  CROSS JOIN params p
  WHERE r.company_id = p.company_id
    AND r.original_sale_id IS NOT NULL
    AND lower(trim(coalesce(r.status, ''))) = 'final'
),
sri AS (
  SELECT
    i.id,
    i.sale_return_id,
    i.sale_item_id,
    i.product_id,
    i.variation_id,
    i.quantity::numeric AS ret_qty,
    i.total::numeric AS ret_line_total
  FROM public.sale_return_items i
  INNER JOIN sr ON sr.id = i.sale_return_id
),
si AS (
  SELECT
    sri.id AS return_item_id,
    si.quantity::numeric AS orig_qty,
    si.total::numeric AS orig_total
  FROM sri
  INNER JOIN public.sales_items si ON si.id = sri.sale_item_id
  WHERE sri.sale_item_id IS NOT NULL
),
flag_partial_full_total AS (
  SELECT
    sri.id,
    sri.sale_return_id,
    sri.ret_qty,
    si.orig_qty,
    sri.ret_line_total,
    si.orig_total,
    round((sri.ret_qty / nullif(si.orig_qty, 0)) * si.orig_total, 2) AS expected_ret_total
  FROM sri
  INNER JOIN si ON si.return_item_id = sri.id
  WHERE si.orig_qty > 0
    AND sri.ret_qty + 0.000001 < si.orig_qty
    AND si.orig_total > 0
    AND abs(sri.ret_line_total - si.orig_total) <= greatest(0.02, 0.0001 * si.orig_total)
),
void_dups AS (
  SELECT sm.reference_id::uuid AS sale_return_id, sm.product_id, sm.variation_id, count(*)::int AS n
  FROM public.stock_movements sm
  CROSS JOIN params p
  WHERE sm.company_id = p.company_id
    AND sm.reference_type = 'sale_return'
    AND sm.movement_type = 'sale_return_void'
  GROUP BY 1, 2, 3
  HAVING count(*) > 1
),
active_je AS (
  SELECT je.reference_id::uuid AS sale_return_id, count(*)::int AS n
  FROM public.journal_entries je
  CROSS JOIN params p
  WHERE je.company_id = p.company_id
    AND lower(trim(coalesce(je.reference_type, ''))) = 'sale_return'
    AND coalesce(je.is_void, false) = false
  GROUP BY 1
)
SELECT 'A_partial_qty_full_line_total_count' AS metric, count(*)::int AS value FROM flag_partial_full_total
UNION ALL
SELECT 'B_duplicate_sale_return_void_rows', count(*)::int FROM void_dups
UNION ALL
SELECT 'C_final_returns_tracked', (SELECT count(*)::int FROM sr);

-- Detail for A (candidates needing repair or re-post)
SELECT
  'DETAIL_A' AS kind,
  f.*
FROM flag_partial_full_total f
ORDER BY f.sale_return_id, f.id;
