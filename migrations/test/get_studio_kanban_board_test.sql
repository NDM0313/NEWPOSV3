-- ============================================================================
-- TEST ONLY — DO NOT RUN ON PRODUCTION
-- ============================================================================
-- Kanban board backend: RPC to list productions grouped by current stage.
-- Plan: MASTER_PROMPT_STUDIO_SAFETY.md STEP 7. Use in test DB only.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_studio_kanban_board_test(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Returns columns: Cutting, Stitching, Embroidery, Finishing, Ready
  -- Each column has array of { id, production_no, sale_id, expected_date, current_stage_id, status }
  SELECT jsonb_build_object(
    'Cutting', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'production_no', p.production_no, 'sale_id', p.sale_id,
        'expected_date', p.expected_date, 'current_stage_id', p.current_stage_id, 'status', p.status
      ))
      FROM studio_productions p
      INNER JOIN studio_production_stages s ON s.id = p.current_stage_id AND s.stage_type = 'dyer'
      WHERE p.company_id = p_company_id AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        AND p.status NOT IN ('cancelled')
    ), '[]'::jsonb),
    'Stitching', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'production_no', p.production_no, 'sale_id', p.sale_id,
        'expected_date', p.expected_date, 'current_stage_id', p.current_stage_id, 'status', p.status
      ))
      FROM studio_productions p
      INNER JOIN studio_production_stages s ON s.id = p.current_stage_id AND s.stage_type = 'stitching'
      WHERE p.company_id = p_company_id AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        AND p.status NOT IN ('cancelled')
    ), '[]'::jsonb),
    'Embroidery', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'production_no', p.production_no, 'sale_id', p.sale_id,
        'expected_date', p.expected_date, 'current_stage_id', p.current_stage_id, 'status', p.status
      ))
      FROM studio_productions p
      INNER JOIN studio_production_stages s ON s.id = p.current_stage_id AND s.stage_type = 'embroidery'
      WHERE p.company_id = p_company_id AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        AND p.status NOT IN ('cancelled')
    ), '[]'::jsonb),
    'Finishing', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'production_no', p.production_no, 'sale_id', p.sale_id,
        'expected_date', p.expected_date, 'current_stage_id', p.current_stage_id, 'status', p.status
      ))
      FROM studio_productions p
      INNER JOIN studio_production_stages s ON s.id = p.current_stage_id AND s.stage_type IN ('finishing', 'quality_check', 'handwork')
      WHERE p.company_id = p_company_id AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        AND p.status NOT IN ('cancelled')
    ), '[]'::jsonb),
    'Ready', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'production_no', p.production_no, 'sale_id', p.sale_id,
        'expected_date', p.expected_date, 'current_stage_id', p.current_stage_id, 'status', p.status
      ))
      FROM studio_productions p
      WHERE p.company_id = p_company_id
        AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        AND p.status = 'completed'
        AND p.current_stage_id IS NULL
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_studio_kanban_board_test(UUID, UUID) IS 'TEST: Kanban board data by stage. Do not use in production until approved.';
