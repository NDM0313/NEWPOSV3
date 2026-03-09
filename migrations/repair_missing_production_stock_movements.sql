-- ============================================================================
-- Repair missing PRODUCTION stock movements (production-safe)
-- ============================================================================
-- Run only AFTER verifying the test script on a test DB.
-- Productions with generated_product_id but no PRODUCTION stock_movements
-- get one backfilled. Idempotent: never creates duplicates.
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
