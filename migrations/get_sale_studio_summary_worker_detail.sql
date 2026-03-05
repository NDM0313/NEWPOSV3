-- ============================================================================
-- get_sale_studio_summary: add worker name + completed_at to tasks_with_workers
-- ============================================================================
-- Fallback path (studio_productions + studio_production_stages) now returns
-- tasks_with_workers with worker_name and completed_at for Sales Studio Cost detail.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sale_studio_summary(p_sale_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_tasks RECORD;
  v_breakdown JSONB := '[]'::JSONB;
  v_tasks_done INT := 0;
  v_tasks_total INT := 0;
  v_started_at TIMESTAMPTZ;
  v_completed_at TIMESTAMPTZ;
  v_days INT;
  v_row RECORD;
  v_worker_name TEXT;
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

  SELECT o.id, o.sale_id, o.status, o.started_at, o.completed_at, o.total_worker_cost
  INTO v_order
  FROM studio_orders o
  WHERE o.sale_id = p_sale_id
  LIMIT 1;

  IF v_order.id IS NULL THEN
    -- Fallback: from studio_productions + studio_production_stages (with worker name + completed_at)
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
  END IF;

  -- studio_orders path (existing logic; add completed_at if studio_tasks has it)
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_tasks_total, v_tasks_done
  FROM studio_tasks
  WHERE studio_order_id = v_order.id;

  v_started_at := v_order.started_at;
  v_completed_at := v_order.completed_at;
  v_days := NULL;
  IF v_started_at IS NOT NULL AND v_completed_at IS NOT NULL THEN
    v_days := EXTRACT(DAY FROM (v_completed_at::timestamp - v_started_at::timestamp))::INT;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'task_type', t.task_type,
      'cost', t.cost,
      'worker_id', t.worker_id,
      'created_by', t.created_by,
      'completed_by', t.completed_by,
      'completed_at', t.completed_at
    )
  ), '[]'::JSONB) INTO v_breakdown
  FROM studio_tasks t
  WHERE t.studio_order_id = v_order.id;

  RETURN json_build_object(
    'has_studio', true,
    'production_status', COALESCE(v_order.status, 'pending'),
    'total_studio_cost', COALESCE(v_order.total_worker_cost, 0),
    'tasks_completed', COALESCE(v_tasks_done, 0),
    'tasks_total', COALESCE(v_tasks_total, 0),
    'production_duration_days', v_days,
    'completed_at', v_completed_at,
    'breakdown', COALESCE(v_breakdown, '[]'::JSONB),
    'tasks_with_workers', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'task_type', t.task_type,
          'cost', t.cost,
          'worker_id', t.worker_id,
          'worker_name', c.name,
          'created_by', t.created_by,
          'completed_by', t.completed_by,
          'completed_at', t.completed_at
        )
      ), '[]'::JSONB)
      FROM studio_tasks t
      LEFT JOIN contacts c ON c.id = t.worker_id
      WHERE t.studio_order_id = v_order.id
    )
  );
END;
$$;

COMMENT ON FUNCTION get_sale_studio_summary(UUID) IS 'Returns studio cost summary for Sales Detail: status, total cost, tasks with worker name and completed_at per job.';
