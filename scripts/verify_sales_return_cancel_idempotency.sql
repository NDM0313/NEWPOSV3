-- Read-only: verify sale return finalize/void safety for one return UUID.
-- Edit the two UUIDs in `params` CTE, then run.

WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS return_id,
    '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid AS company_id
),
sr AS (
  SELECT s.status
  FROM public.sale_returns s
  CROSS JOIN params p
  WHERE s.id = p.return_id AND s.company_id = p.company_id
),
sm AS (
  SELECT sm.movement_type, sm.product_id, sm.variation_id, sm.quantity, sm.created_at
  FROM public.stock_movements sm
  CROSS JOIN params p
  WHERE sm.company_id = p.company_id
    AND sm.reference_type = 'sale_return'
    AND sm.reference_id = p.return_id
),
dup_finalize AS (
  SELECT product_id, variation_id, COUNT(*) AS n
  FROM sm WHERE movement_type = 'sale_return'
  GROUP BY product_id, variation_id HAVING COUNT(*) > 1
),
dup_void AS (
  SELECT product_id, variation_id, COUNT(*) AS n
  FROM sm WHERE movement_type = 'sale_return_void'
  GROUP BY product_id, variation_id HAVING COUNT(*) > 1
),
jes AS (
  SELECT je.id, je.entry_no, je.is_void,
    (SELECT trim(max(coalesce(a.code, ''))) FROM public.journal_entry_lines jel
     JOIN public.accounts a ON a.id = jel.account_id
     WHERE jel.journal_entry_id = je.id AND jel.debit > 0) AS any_debit_code
  FROM public.journal_entries je
  CROSS JOIN params p
  WHERE je.company_id = p.company_id
    AND lower(trim(coalesce(je.reference_type, ''))) = 'sale_return'
    AND je.reference_id = p.return_id
)
SELECT json_build_object(
  'sale_return_status', (SELECT status FROM sr),
  'stock_sale_return_rows', (SELECT COUNT(*) FROM sm WHERE movement_type = 'sale_return'),
  'stock_sale_return_void_rows', (SELECT COUNT(*) FROM sm WHERE movement_type = 'sale_return_void'),
  'duplicate_finalize_product_keys', (SELECT COUNT(*) FROM dup_finalize),
  'duplicate_void_product_keys', (SELECT COUNT(*) FROM dup_void),
  'active_sale_return_je_count', (SELECT COUNT(*) FROM jes WHERE COALESCE(jes.is_void, false) = false),
  'debit_codes_on_active_sale_return_jes', (SELECT json_agg(DISTINCT any_debit_code) FROM jes WHERE COALESCE(jes.is_void, false) = false),
  'correction_reversal_count_for_those_jes', (
    SELECT COUNT(*)::bigint FROM public.journal_entries r
    CROSS JOIN params p
    WHERE r.company_id = p.company_id
      AND lower(trim(coalesce(r.reference_type, ''))) = 'correction_reversal'
      AND r.reference_id IN (SELECT id::text FROM jes)
  )
) AS report;
