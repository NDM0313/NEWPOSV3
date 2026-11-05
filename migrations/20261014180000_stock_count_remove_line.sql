-- Physical Stock Count: allow removing a draft / in-progress line (mistake undo).
-- Additive only — does not alter posting math or stock_movements until post.
-- Events cascade via stock_count_events.line_id ON DELETE CASCADE.

CREATE OR REPLACE FUNCTION public.stock_count_remove_line(p_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_line public.stock_count_lines%ROWTYPE;
  v_session public.stock_count_sessions%ROWTYPE;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: company access denied';
  END IF;

  SELECT * INTO v_line
  FROM public.stock_count_lines
  WHERE id = p_line_id AND company_id = v_company
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_LINE_NOT_FOUND';
  END IF;

  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = v_line.session_id AND company_id = v_company
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;

  IF v_session.status IN ('posted', 'cancelled') THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED: session is %', v_session.status;
  END IF;

  IF v_line.stock_movement_id IS NOT NULL OR v_line.posted_at IS NOT NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_LINE_POSTED: cannot remove a posted count line';
  END IF;

  -- Prefer line branch; fall back to session branch for legacy single-branch rows.
  PERFORM public._stock_count_assert_access(
    v_company,
    COALESCE(v_line.branch_id, v_session.branch_id)
  );

  DELETE FROM public.stock_count_lines
  WHERE id = v_line.id AND company_id = v_company;

  UPDATE public.stock_count_sessions
  SET updated_at = now(),
      updated_by = auth.uid()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'removed', true,
    'line_id', p_line_id,
    'session_id', v_session.id
  );
END;
$$;

COMMENT ON FUNCTION public.stock_count_remove_line(uuid) IS
  'Removes an unposted stock_count_lines row (and cascaded events). Blocked when session posted/cancelled.';

GRANT EXECUTE ON FUNCTION public.stock_count_remove_line(uuid) TO authenticated;
