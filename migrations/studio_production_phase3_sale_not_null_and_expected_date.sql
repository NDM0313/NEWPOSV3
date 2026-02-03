-- ============================================================================
-- STUDIO PRODUCTION – PHASE 3: sale_id NOT NULL, expected_completion_date on stages
-- ============================================================================
-- Run after: studio_production_sale_linked.sql
-- 1. Add expected_completion_date to studio_production_stages
-- 2. Enforce sale_id NOT NULL on studio_productions (backfill or leave existing nulls)
-- ============================================================================

-- 1. expected_completion_date on stages (manager-set target date)
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS expected_completion_date DATE;
COMMENT ON COLUMN studio_production_stages.expected_completion_date IS 'Manager-set expected completion date for this stage.';

-- 2. sale_id NOT NULL: only apply if you have no legacy rows with NULL sale_id.
--    If you have existing productions without a sale, run this one-off first (or skip NOT NULL):
--    DELETE FROM studio_productions WHERE sale_id IS NULL;
--    Or backfill: UPDATE studio_productions SET sale_id = '<some-valid-sale-uuid>' WHERE sale_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM studio_productions WHERE sale_id IS NULL LIMIT 1) THEN
    ALTER TABLE studio_productions ALTER COLUMN sale_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'sale_id NOT NULL skipped: %', SQLERRM;
END $$;
