-- ============================================================================
-- RPC: get_studio_stages_for_sale – returns stage details for a sale (SECURITY DEFINER)
-- ============================================================================
-- Used by Sales detail so Studio Cost Summary always shows Dyeing/Stitching/Handwork
-- with worker name, cost, completed_at. Bypasses RLS so data is always available.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_studio_stages_for_sale(p_sale_id UUID)
RETURNS TABLE(
  task_type TEXT,
  cost NUMERIC(15,2),
  worker_name TEXT,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_sale_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    s.stage_type::TEXT AS task_type,
    COALESCE(s.cost, 0)::NUMERIC(15,2) AS cost,
    COALESCE(w.name, c.name)::TEXT AS worker_name,
    s.completed_at AS completed_at
  FROM studio_production_stages s
  INNER JOIN studio_productions p ON p.id = s.production_id AND p.sale_id = p_sale_id
  LEFT JOIN workers w ON w.id = s.assigned_worker_id
  LEFT JOIN contacts c ON c.id = s.assigned_worker_id AND w.id IS NULL
  ORDER BY s.completed_at NULLS LAST, s.created_at;
END;
$$;

COMMENT ON FUNCTION get_studio_stages_for_sale(UUID) IS 'Returns studio stage details for a sale (stage type, cost, worker name, completed_at). Used by Sales detail Studio Cost Summary.';
