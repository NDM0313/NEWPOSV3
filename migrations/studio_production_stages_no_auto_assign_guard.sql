-- ============================================================================
-- STUDIO PRODUCTION STAGES: NO AUTO-ASSIGN GUARD
-- ============================================================================
-- Ensures new stages are ALWAYS created clean. Prevents regression of auto-assign bug.
-- Run after: studio_assign_receive_workflow.sql (or studio_production_sale_linked.sql)
-- ============================================================================

-- 1. BEFORE INSERT: Force clean state for ALL new stage rows
-- No matter what the app sends, new rows get: assigned_worker_id=NULL, status=pending, assigned_at=NULL, cost=0, expected_cost=0
CREATE OR REPLACE FUNCTION studio_production_stages_force_clean_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.assigned_worker_id := NULL;
  NEW.status := 'pending';
  NEW.assigned_at := NULL;
  NEW.cost := 0;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_production_stages' AND column_name = 'expected_cost') THEN
    NEW.expected_cost := 0;
  END IF;
  NEW.completed_at := NULL;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_production_stages' AND column_name = 'journal_entry_id') THEN
    NEW.journal_entry_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_studio_production_stages_force_clean_insert ON studio_production_stages;
CREATE TRIGGER trigger_studio_production_stages_force_clean_insert
  BEFORE INSERT ON studio_production_stages
  FOR EACH ROW
  EXECUTE PROCEDURE studio_production_stages_force_clean_insert();

COMMENT ON FUNCTION studio_production_stages_force_clean_insert IS 'No auto-assign: new stages always pending, no worker. Assignment only via rpc_assign_worker_to_stage.';

-- 2. Fix existing bad data: status=assigned/in_progress but worker null → reset to pending
UPDATE studio_production_stages
SET status = 'pending', assigned_worker_id = NULL, assigned_at = NULL
WHERE status IN ('assigned', 'in_progress') AND assigned_worker_id IS NULL;

-- 3. CHECK constraints (validate on UPDATE; INSERT is already guarded by trigger)
-- If constraint add fails: fix bad data first, then re-run:
--   UPDATE studio_production_stages SET status='pending', assigned_worker_id=NULL WHERE status IN ('assigned','in_progress') AND assigned_worker_id IS NULL;
ALTER TABLE studio_production_stages DROP CONSTRAINT IF EXISTS chk_studio_stage_pending_no_worker;
ALTER TABLE studio_production_stages ADD CONSTRAINT chk_studio_stage_pending_no_worker
  CHECK ((status::text != 'pending') OR (assigned_worker_id IS NULL));

ALTER TABLE studio_production_stages DROP CONSTRAINT IF EXISTS chk_studio_stage_assigned_has_worker;
ALTER TABLE studio_production_stages ADD CONSTRAINT chk_studio_stage_assigned_has_worker
  CHECK ((status::text NOT IN ('assigned', 'in_progress')) OR (assigned_worker_id IS NOT NULL));

ALTER TABLE studio_production_stages DROP CONSTRAINT IF EXISTS chk_studio_stage_completed_has_cost;
ALTER TABLE studio_production_stages ADD CONSTRAINT chk_studio_stage_completed_has_cost
  CHECK ((status::text != 'completed') OR (cost IS NOT NULL AND cost >= 0));
