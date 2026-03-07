-- ============================================================================
-- STUDIO PRODUCTION WORKFLOW PIPELINE
-- ============================================================================
-- 1. stage_order on studio_production_stages (sequential execution)
-- 2. current_stage_id on studio_productions (active stage)
-- 3. Extend stage type enum: embroidery, finishing, quality_check
-- 4. On stage complete: advance to next stage or set production completed
-- Run after: studio_production_stage_workflow_sent_received.sql
-- ============================================================================

-- 1. Add stage_order to studio_production_stages
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS stage_order INT NOT NULL DEFAULT 1;

-- Backfill stage_order by production_id order (created_at, id)
WITH ordered AS (
  SELECT id, production_id,
         ROW_NUMBER() OVER (PARTITION BY production_id ORDER BY created_at, id) AS rn
  FROM studio_production_stages
)
UPDATE studio_production_stages s
SET stage_order = ordered.rn
FROM ordered
WHERE s.id = ordered.id;

-- 2. Drop old unique (production_id, stage_type) so we can have multiple stages with order
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'studio_production_stages'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 2
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = conrelid AND a.attnum = ANY(conkey) AND a.attname = 'stage_type'
    );
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE studio_production_stages DROP CONSTRAINT IF EXISTS %I', cname);
  END IF;
END $$;

-- Unique per production + stage_order
ALTER TABLE studio_production_stages
  DROP CONSTRAINT IF EXISTS studio_production_stages_production_order_key;
ALTER TABLE studio_production_stages
  ADD CONSTRAINT studio_production_stages_production_order_key
  UNIQUE (production_id, stage_order);

COMMENT ON COLUMN studio_production_stages.stage_order IS 'Execution order: 1 = first, 2 = second, etc.';

-- 3. Add current_stage_id to studio_productions
ALTER TABLE studio_productions
  ADD COLUMN IF NOT EXISTS current_stage_id UUID REFERENCES studio_production_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_studio_productions_current_stage ON studio_productions(current_stage_id);
COMMENT ON COLUMN studio_productions.current_stage_id IS 'Currently active stage (NULL when no stages or all completed).';

-- 4. Extend stage type enum (Dyeing, Stitching, Handwork, Embroidery, Finishing, Quality Check)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'studio_production_stage_type') AND enumlabel = 'embroidery') THEN
    ALTER TYPE studio_production_stage_type ADD VALUE 'embroidery' AFTER 'handwork';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'studio_production_stage_type') AND enumlabel = 'finishing') THEN
    ALTER TYPE studio_production_stage_type ADD VALUE 'finishing' AFTER 'embroidery';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'studio_production_stage_type') AND enumlabel = 'quality_check') THEN
    ALTER TYPE studio_production_stage_type ADD VALUE 'quality_check' AFTER 'finishing';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. RPC: Complete stage and advance to next (or set production completed)
CREATE OR REPLACE FUNCTION rpc_complete_stage(p_stage_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
  v_next_id UUID;
  v_production_id UUID;
BEGIN
  SELECT s.*, s.production_id INTO v_stage
  FROM studio_production_stages s
  WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;
  IF v_stage.status != 'received' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only received stages can be completed. Confirm payment first.');
  END IF;
  IF COALESCE(v_stage.cost, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Confirm payment (cost) before completing');
  END IF;

  v_production_id := v_stage.production_id;

  UPDATE studio_production_stages
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_stage_id;

  -- Find next stage by stage_order
  SELECT id INTO v_next_id
  FROM studio_production_stages
  WHERE production_id = v_production_id
    AND stage_order > v_stage.stage_order
    AND status != 'completed'
  ORDER BY stage_order ASC
  LIMIT 1;

  IF v_next_id IS NOT NULL THEN
    UPDATE studio_productions
    SET current_stage_id = v_next_id, status = 'in_progress', updated_at = NOW()
    WHERE id = v_production_id;
  ELSE
    -- No next stage: mark production completed
    UPDATE studio_productions
    SET current_stage_id = NULL, status = 'completed', updated_at = NOW()
    WHERE id = v_production_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION rpc_complete_stage IS 'Complete stage; advance production to next stage or set production completed.';

-- 6. Helper: Set production current_stage when first stage is added (call from app or trigger)
-- When stages are inserted, app can set current_stage_id to first stage and status = in_progress.
-- Optional trigger when first stage gets status in_progress/assigned: set production.current_stage_id.
CREATE OR REPLACE FUNCTION studio_production_set_current_stage_on_first_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('assigned', 'in_progress', 'sent_to_worker', 'received')
     AND (OLD.status IS NULL OR OLD.status = 'pending')
     AND (SELECT current_stage_id FROM studio_productions WHERE id = NEW.production_id) IS NULL THEN
    UPDATE studio_productions
    SET current_stage_id = NEW.id, status = 'in_progress', updated_at = NOW()
    WHERE id = NEW.production_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_studio_production_set_current_stage ON studio_production_stages;
CREATE TRIGGER trigger_studio_production_set_current_stage
  AFTER UPDATE ON studio_production_stages
  FOR EACH ROW
  EXECUTE FUNCTION studio_production_set_current_stage_on_first_assign();

-- 7. When first stages are added, set current_stage_id to first stage and status = in_progress
CREATE OR REPLACE FUNCTION studio_production_set_current_stage_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_id UUID;
BEGIN
  IF (SELECT current_stage_id FROM studio_productions WHERE id = NEW.production_id) IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT id INTO v_first_id
  FROM studio_production_stages
  WHERE production_id = NEW.production_id
  ORDER BY stage_order ASC
  LIMIT 1;
  IF v_first_id IS NOT NULL THEN
    UPDATE studio_productions
    SET current_stage_id = v_first_id, status = 'in_progress', updated_at = NOW()
    WHERE id = NEW.production_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_studio_production_set_current_on_insert ON studio_production_stages;
CREATE TRIGGER trigger_studio_production_set_current_on_insert
  AFTER INSERT ON studio_production_stages
  FOR EACH ROW
  EXECUTE FUNCTION studio_production_set_current_stage_on_insert();
