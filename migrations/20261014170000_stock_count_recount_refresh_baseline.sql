-- Recount refreshes count baseline to current system qty (additive).
-- Physical resets to uncounted; prior pass remains in stock_count_events.
-- Do not apply to production without explicit approval.

CREATE OR REPLACE FUNCTION public.stock_count_apply_event(
  p_line_id uuid,
  p_event_type text,
  p_value numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_line public.stock_count_lines%ROWTYPE;
  v_session public.stock_count_sessions%ROWTYPE;
  v_prior numeric(18, 4);
  v_new numeric(18, 4);
  v_pass int;
  v_branch uuid;
  v_baseline numeric(18, 4);
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: not authenticated';
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
  WHERE id = v_line.session_id
  FOR UPDATE;
  IF v_session.status IN ('posted', 'cancelled') THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED: session is %', v_session.status;
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);

  v_prior := v_line.physical_qty;
  v_pass := v_line.active_pass_number;
  v_branch := COALESCE(v_line.branch_id, v_session.branch_id);

  IF p_event_type = 'increment' THEN
    v_new := COALESCE(v_prior, 0) + COALESCE(NULLIF(ABS(p_value), 0), 1);
  ELSIF p_event_type = 'decrement' THEN
    IF v_prior IS NULL THEN
      v_new := NULL;
    ELSE
      v_new := GREATEST(0, v_prior - COALESCE(NULLIF(ABS(p_value), 0), 1));
    END IF;
  ELSIF p_event_type = 'set' THEN
    IF p_value IS NULL OR p_value < 0 THEN
      RAISE EXCEPTION 'STOCK_COUNT_INVALID_QTY';
    END IF;
    v_new := p_value;
  ELSIF p_event_type = 'confirm_zero' THEN
    v_new := 0;
  ELSIF p_event_type = 'start_recount' THEN
    v_pass := v_pass + 1;
    v_new := NULL;
    -- Fresh baseline from current movement balance (same helper as add_line)
    IF v_branch IS NULL THEN
      RAISE EXCEPTION 'STOCK_COUNT_BRANCH_REQUIRED: line missing branch_id for recount baseline';
    END IF;
    v_baseline := public._stock_count_system_qty(
      v_company, v_branch, v_line.product_id, v_line.variation_id
    );
    UPDATE public.stock_count_lines
    SET physical_qty = NULL,
        active_pass_number = v_pass,
        count_status = 'uncounted',
        variance = NULL,
        system_qty_baseline = v_baseline,
        baseline_at = now(),
        reason = COALESCE(NULLIF(trim(p_reason), ''), reason),
        updated_at = now()
    WHERE id = v_line.id
    RETURNING * INTO v_line;

    INSERT INTO public.stock_count_events (
      company_id, session_id, line_id, pass_number, event_type,
      prior_qty, new_qty, reason, created_by
    ) VALUES (
      v_company, v_line.session_id, v_line.id, v_pass, p_event_type,
      v_prior, NULL,
      COALESCE(NULLIF(trim(p_reason), ''), 'Recount — baseline refreshed to current system qty'),
      auth.uid()
    );

    UPDATE public.stock_count_sessions
    SET status = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = v_session.id;

    RETURN to_jsonb(v_line);
  ELSE
    RAISE EXCEPTION 'STOCK_COUNT_INVALID_EVENT: %', p_event_type;
  END IF;

  INSERT INTO public.stock_count_events (
    company_id, session_id, line_id, pass_number, event_type,
    prior_qty, new_qty, reason, created_by
  ) VALUES (
    v_company, v_line.session_id, v_line.id, v_pass, p_event_type,
    v_prior, v_new, NULLIF(trim(p_reason), ''), auth.uid()
  );

  UPDATE public.stock_count_lines
  SET physical_qty = v_new,
      active_pass_number = v_pass,
      count_status = public._stock_count_line_status(v_new),
      variance = CASE WHEN v_new IS NULL THEN NULL ELSE (v_new - system_qty_baseline) END,
      reason = COALESCE(NULLIF(trim(p_reason), ''), reason),
      updated_at = now()
  WHERE id = v_line.id
  RETURNING * INTO v_line;

  UPDATE public.stock_count_sessions
  SET status = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = v_session.id;

  RETURN to_jsonb(v_line);
END;
$$;

COMMENT ON FUNCTION public.stock_count_apply_event(uuid, text, numeric, text) IS
  'Count events; start_recount clears physical and refreshes system_qty_baseline from live movements.';
