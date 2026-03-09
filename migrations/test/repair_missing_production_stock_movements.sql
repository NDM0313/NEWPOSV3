-- ============================================================================
-- TEST ONLY — Repair missing PRODUCTION stock movements
-- ============================================================================
-- Productions with generated_product_id but no stock_movements PRODUCTION row
-- get one backfilled. Idempotent: never creates duplicates.
-- Run in TEST DB first. After verification, use production script.
-- ============================================================================

INSERT INTO stock_movements (
  company_id,
  branch_id,
  product_id,
  quantity,
  unit_cost,
  total_cost,
  movement_type,
  reference_type,
  reference_id,
  notes,
  created_at
)
SELECT
  p.company_id,
  p.branch_id,
  p.generated_product_id,
  1,
  COALESCE(p.actual_cost, 0),
  COALESCE(p.actual_cost, 0),
  'PRODUCTION',
  'studio_production',
  p.id,
  'Production ' || COALESCE(p.production_no, p.id::TEXT) || ' – finished goods (backfill)',
  NOW()
FROM studio_productions p
WHERE p.generated_product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM stock_movements sm
    WHERE sm.reference_type = 'studio_production'
      AND sm.reference_id = p.id
      AND sm.movement_type = 'PRODUCTION'
  );

-- ============================================================================
-- VERIFICATION (run after repair)
-- ============================================================================
-- After repair every row must have movement NOT NULL:
--
-- SELECT p.id, p.generated_product_id, p.actual_cost, m.id AS movement
-- FROM studio_productions p
-- LEFT JOIN stock_movements m
--   ON m.reference_id = p.id AND m.reference_type = 'studio_production' AND m.movement_type = 'PRODUCTION'
-- WHERE p.generated_product_id IS NOT NULL;
-- Expected: movement IS NOT NULL for every row.
--
-- List all PRODUCTION movements:
-- SELECT * FROM stock_movements WHERE movement_type = 'PRODUCTION' ORDER BY created_at DESC;
--
-- ============================================================================
-- ROLLBACK (only if you must remove backfilled rows)
-- ============================================================================
-- DELETE FROM stock_movements
-- WHERE movement_type = 'PRODUCTION'
--   AND reference_type = 'studio_production'
--   AND notes LIKE '%(backfill)%';
-- (Re-run repair to recreate if needed.)
