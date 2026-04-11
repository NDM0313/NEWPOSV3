-- LIVE REPAIR (optional): remove **duplicate** stock movements from repeated void attempts
-- before engine fix. Keeps the oldest row per (company_id, reference_id, product_id, variation_id, movement_type).
--
-- Review counts first:
--   SELECT reference_id, movement_type, product_id, variation_id, COUNT(*)
--   FROM public.stock_movements
--   WHERE reference_type = 'sale_return' AND movement_type = 'sale_return_void'
--   GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
--
-- Then set company_id / return_id and run the delete CTE below inside a transaction.

BEGIN;

-- Example: scope to one return
-- WITH dups AS (
--   SELECT sm.id,
--          ROW_NUMBER() OVER (
--            PARTITION BY sm.company_id, sm.reference_id, sm.product_id, COALESCE(sm.variation_id::text, ''), sm.movement_type
--            ORDER BY sm.created_at ASC NULLS LAST, sm.id ASC
--          ) AS rn
--   FROM public.stock_movements sm
--   WHERE sm.company_id = 'YOUR-COMPANY'::uuid
--     AND sm.reference_type = 'sale_return'
--     AND sm.reference_id = 'YOUR-RETURN'::uuid
--     AND sm.movement_type = 'sale_return_void'
-- )
-- DELETE FROM public.stock_movements sm
-- USING dups d WHERE sm.id = d.id AND d.rn > 1;

ROLLBACK;
