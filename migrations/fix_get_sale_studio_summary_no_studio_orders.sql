-- ============================================================================
-- Fix get_sale_studio_summary after studio_orders table is dropped
-- Use only studio_productions + studio_production_stages (no studio_orders path).
-- Create only if not exists to avoid "must be owner of function".
-- ============================================================================

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_sale_studio_summary') THEN
    CREATE FUNCTION get_sale_studio_summary(p_sale_id UUID)
    RETURNS JSON
    LANGUAGE plpgsql
    STABLE
    SET search_path = public
    AS $body$
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

  -- Only path: studio_productions + studio_production_stages (studio_orders removed)
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
$body$;
    COMMENT ON FUNCTION get_sale_studio_summary(UUID) IS 'Returns studio cost summary from studio_productions + studio_production_stages only (studio_orders removed).';
  END IF;
END $mig$;
