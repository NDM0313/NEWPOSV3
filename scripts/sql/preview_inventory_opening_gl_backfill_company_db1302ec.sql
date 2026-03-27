-- =============================================================================
-- PREVIEW: inventory opening → GL (opening_balance_inventory) backfill
-- Company: db1302ec-a8d7-4cff-81ad-3c8d7cb55509
--
-- Shows stock_movements (reference_type = opening_balance) vs existing JEs.
-- Run before apply_inventory_opening_gl_backfill_company_db1302ec.sql
-- =============================================================================

WITH sm AS (
  SELECT
    m.id,
    m.company_id,
    m.branch_id,
    m.product_id,
    m.variation_id,
    m.quantity,
    m.unit_cost,
    m.total_cost,
    m.created_at,
    round(
      abs(
        COALESCE(NULLIF(m.total_cost, 0), m.quantity * COALESCE(m.unit_cost, 0), 0)::numeric
      ),
      2
    ) AS amount_abs
  FROM public.stock_movements m
  WHERE m.company_id = 'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'
    AND m.movement_type = 'adjustment'
    AND lower(trim(COALESCE(m.reference_type, ''))) = 'opening_balance'
)
SELECT
  sm.id AS movement_id,
  sm.branch_id,
  sm.product_id,
  sm.variation_id,
  p.sku AS product_sku,
  p.name AS product_name,
  sm.quantity,
  sm.unit_cost,
  sm.total_cost,
  sm.amount_abs AS opening_value,
  (sm.created_at AT TIME ZONE 'UTC')::date AS movement_date_utc,
  EXISTS (
    SELECT 1
    FROM public.journal_entries je
    WHERE je.company_id = sm.company_id
      AND je.reference_type = 'opening_balance_inventory'
      AND je.reference_id = sm.id
      AND COALESCE(je.is_void, false) = false
  ) AS has_active_canonical_je,
  EXISTS (
    SELECT 1
    FROM public.journal_entries je
    WHERE je.reference_type = 'stock_adjustment'
      AND je.reference_id = sm.id
      AND COALESCE(je.is_void, false) = false
  ) AS has_active_legacy_stock_adjustment_je,
  CASE
    WHEN sm.amount_abs = 0 THEN 'skip_zero_amount'
    WHEN EXISTS (
      SELECT 1
      FROM public.journal_entries je
      WHERE je.company_id = sm.company_id
        AND je.reference_type = 'opening_balance_inventory'
        AND je.reference_id = sm.id
        AND COALESCE(je.is_void, false) = false
    ) THEN 'skip_already_posted'
    ELSE 'would_insert_canonical_je'
  END AS backfill_action
FROM sm
LEFT JOIN public.products p ON p.id = sm.product_id
ORDER BY sm.created_at;
