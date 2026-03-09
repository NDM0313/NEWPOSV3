-- ============================================================================
-- Run AFTER drop_studio_orders_legacy.sql – fixes "relation studio_orders does not exist"
-- and makes get_sale_studio_charges_batch never touch studio_orders.
-- Optionally ensures studio_production_stages table exists (fixes 404 if missing).
-- Run in Supabase SQL Editor.
--
-- IMPORTANT: Run the ENTIRE file from LINE 1. Do not run only the bottom part.
-- The two CREATE OR REPLACE FUNCTION blocks at the top (get_sale_studio_summary
-- and get_sale_studio_charges_batch) must run so the DB stops referencing studio_orders.
-- ============================================================================

-- 1. get_sale_studio_summary: use only studio_productions + studio_production_stages (no studio_orders)
CREATE OR REPLACE FUNCTION get_sale_studio_summary(p_sale_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_tasks RECORD;
  v_days INT;
BEGIN
  IF p_sale_id IS NULL THEN
    RETURN json_build_object(
      'has_studio', false,
      'production_status', 'none',
      'total_studio_cost', 0,
      'tasks_completed', 0,
      'tasks_total', 0,
      'production_duration_days', NULL,
      'completed_at', NULL,
      'breakdown', '[]'::JSONB,
      'tasks_with_workers', '[]'::JSONB
    );
  END IF;

  SELECT
    COALESCE(SUM(s.cost), 0)::NUMERIC(15,2) AS total_cost,
    MIN(COALESCE(s.assigned_at, s.created_at))::TIMESTAMPTZ AS started_at,
    MAX(s.completed_at) AS completed_at,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE s.status = 'completed') AS done
  INTO v_tasks
  FROM studio_production_stages s
  INNER JOIN studio_productions p ON p.id = s.production_id
  WHERE p.sale_id = p_sale_id;

  IF v_tasks.total IS NULL OR v_tasks.total = 0 THEN
    RETURN json_build_object(
      'has_studio', false,
      'production_status', 'none',
      'total_studio_cost', 0,
      'tasks_completed', 0,
      'tasks_total', 0,
      'production_duration_days', NULL,
      'completed_at', NULL,
      'breakdown', '[]'::JSONB,
      'tasks_with_workers', '[]'::JSONB
    );
  END IF;

  v_days := NULL;
  IF v_tasks.started_at IS NOT NULL AND v_tasks.completed_at IS NOT NULL THEN
    v_days := EXTRACT(DAY FROM (v_tasks.completed_at::timestamp - v_tasks.started_at::timestamp))::INT;
  END IF;

  RETURN json_build_object(
    'has_studio', true,
    'production_status', CASE WHEN v_tasks.done = v_tasks.total THEN 'completed' ELSE 'in_progress' END,
    'total_studio_cost', COALESCE(v_tasks.total_cost, 0),
    'tasks_completed', COALESCE(v_tasks.done, 0),
    'tasks_total', COALESCE(v_tasks.total, 0),
    'production_duration_days', v_days,
    'completed_at', v_tasks.completed_at,
    'breakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'task_type', s.stage_type,
          'cost', s.cost,
          'worker_id', s.assigned_worker_id,
          'worker_name', COALESCE(w.name, c.name),
          'completed_at', s.completed_at
        ) ORDER BY s.completed_at NULLS LAST, s.created_at
      ), '[]'::JSONB)
      FROM studio_production_stages s
      INNER JOIN studio_productions p ON p.id = s.production_id
      LEFT JOIN workers w ON w.id = s.assigned_worker_id
      LEFT JOIN contacts c ON c.id = s.assigned_worker_id AND w.id IS NULL
      WHERE p.sale_id = p_sale_id
    ),
    'tasks_with_workers', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'task_type', s.stage_type,
          'cost', s.cost,
          'worker_id', s.assigned_worker_id,
          'worker_name', COALESCE(w.name, c.name),
          'completed_at', s.completed_at
        ) ORDER BY s.completed_at NULLS LAST, s.created_at
      ), '[]'::JSONB)
      FROM studio_production_stages s
      INNER JOIN studio_productions p ON p.id = s.production_id
      LEFT JOIN workers w ON w.id = s.assigned_worker_id
      LEFT JOIN contacts c ON c.id = s.assigned_worker_id AND w.id IS NULL
      WHERE p.sale_id = p_sale_id
    )
  );
END;
$$;

-- 2. get_sale_studio_charges_batch: only studio_production_stages path (no studio_orders)
CREATE OR REPLACE FUNCTION get_sale_studio_charges_batch(p_sale_ids UUID[])
RETURNS TABLE(sale_id UUID, studio_cost NUMERIC(15,2))
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF p_sale_ids IS NULL OR array_length(p_sale_ids, 1) IS NULL OR array_length(p_sale_ids, 1) = 0 THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_productions' AND column_name = 'sale_id') THEN
    RETURN QUERY
    SELECT p.sale_id::UUID AS sale_id, COALESCE(SUM(s.cost), 0)::NUMERIC(15,2) AS studio_cost
    FROM studio_production_stages s
    INNER JOIN studio_productions p ON p.id = s.production_id
    WHERE p.sale_id = ANY(p_sale_ids)
    GROUP BY p.sale_id;
  END IF;
END;
$$;

-- 3. Ensure studio_production_stages table exists (fixes 404 if it was missing)
-- assigned_worker_id → contacts(id) so it works without a workers table (app uses contact IDs for workers).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_productions') THEN
    BEGIN
      CREATE TYPE studio_production_stage_type AS ENUM ('dyer', 'stitching', 'handwork');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      CREATE TYPE studio_production_stage_status AS ENUM ('pending', 'in_progress', 'completed');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    CREATE TABLE studio_production_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      production_id UUID NOT NULL REFERENCES studio_productions(id) ON DELETE CASCADE,
      stage_type studio_production_stage_type NOT NULL,
      assigned_worker_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      cost NUMERIC(15,2) DEFAULT 0,
      status studio_production_stage_status NOT NULL DEFAULT 'pending',
      completed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(production_id, stage_type)
    );
    CREATE INDEX IF NOT EXISTS idx_studio_production_stages_production ON studio_production_stages(production_id);
    CREATE INDEX IF NOT EXISTS idx_studio_production_stages_worker ON studio_production_stages(assigned_worker_id);
  END IF;
END $$;

-- 3b. Add 'assigned' to status enum if type exists and value missing (app uses assigned for worker-assigned stages)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'studio_production_stage_status') THEN
    ALTER TYPE studio_production_stage_status ADD VALUE 'assigned';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add common columns if table exists but columns missing (later migrations may add these)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages') THEN
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS stage_order INT;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS expected_cost NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS expected_completion_date DATE;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
  END IF;
END $$;
