-- Mid-count drift vs as-of baseline: store live qty at capture separately.
-- system_qty_baseline remains historical as-of (posting basis).
-- live_qty_at_capture = live stock when line added / recounted (drift badge basis).
-- Additive on 20261014190000_*. Do not apply to production without explicit approval.

ALTER TABLE public.stock_count_lines
  ADD COLUMN IF NOT EXISTS live_qty_at_capture numeric(18, 4);

COMMENT ON COLUMN public.stock_count_lines.live_qty_at_capture IS
  'Live system qty when line was added or recounted. STOCK CHANGED compares live_now to this, not to as-of baseline.';

-- Backfill: prefer not inventing capture from as-of; leave null → clients suppress false drift.

-- ---------------------------------------------------------------------------
-- add_line: as-of baseline + live capture
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_count_add_line(
  p_session_id uuid,
  p_product_id uuid,
  p_variation_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_session public.stock_count_sessions%ROWTYPE;
  v_product record;
  v_branches uuid[];
  v_bid uuid;
  v_baseline numeric(18, 4);
  v_live numeric(18, 4);
  v_cutoff timestamptz;
  v_line public.stock_count_lines%ROWTYPE;
  v_lines jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = p_session_id AND company_id = v_company
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;
  IF v_session.status IN ('awaiting_approval', 'posted', 'cancelled') THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED: session is %', v_session.status;
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);

  SELECT id, company_id, has_variations, is_active
  INTO v_product
  FROM public.products
  WHERE id = p_product_id AND company_id = v_company;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_PRODUCT_NOT_FOUND';
  END IF;
  IF COALESCE(v_product.has_variations, false) AND p_variation_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_VARIATION_REQUIRED: count variation SKUs, not parent total';
  END IF;
  IF NOT COALESCE(v_product.has_variations, false) AND p_variation_id IS NOT NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_VARIATION_INVALID';
  END IF;
  IF p_variation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variations pv
    WHERE pv.id = p_variation_id AND pv.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_VARIATION_NOT_FOUND';
  END IF;

  v_cutoff := public._stock_count_as_of_cutoff(v_session.as_of_date);

  IF v_session.scope_type = 'all_branches' THEN
    v_branches := public._stock_count_accessible_branch_ids(v_company);
  ELSE
    v_branches := ARRAY[v_session.branch_id];
  END IF;

  FOREACH v_bid IN ARRAY v_branches
  LOOP
    PERFORM public._stock_count_assert_access(v_company, v_bid);
    v_baseline := public._stock_count_system_qty(
      v_company, v_bid, p_product_id, p_variation_id, v_cutoff
    );
    v_live := public._stock_count_system_qty(
      v_company, v_bid, p_product_id, p_variation_id, NULL
    );

    SELECT * INTO v_line
    FROM public.stock_count_lines
    WHERE session_id = p_session_id
      AND product_id = p_product_id
      AND variation_id IS NOT DISTINCT FROM p_variation_id
      AND branch_id = v_bid;

    IF FOUND THEN
      UPDATE public.stock_count_lines
      SET updated_at = now(),
          notes = COALESCE(NULLIF(trim(p_notes), ''), notes),
          live_qty_at_capture = COALESCE(live_qty_at_capture, v_live)
      WHERE id = v_line.id
      RETURNING * INTO v_line;
    ELSE
      INSERT INTO public.stock_count_lines (
        company_id, session_id, branch_id, product_id, variation_id,
        system_qty_baseline, baseline_at, live_qty_at_capture,
        physical_qty, count_status, notes
      ) VALUES (
        v_company, p_session_id, v_bid, p_product_id, p_variation_id,
        v_baseline, COALESCE(v_cutoff - interval '1 microsecond', now()), v_live,
        NULL, 'uncounted', NULLIF(trim(p_notes), '')
      )
      RETURNING * INTO v_line;
    END IF;

    v_lines := v_lines || jsonb_build_array(to_jsonb(v_line));
  END LOOP;

  UPDATE public.stock_count_sessions
  SET status = CASE
        WHEN status IN ('draft', 'pending_review') THEN 'in_progress'
        ELSE status
      END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id;

  IF v_session.scope_type = 'all_branches' THEN
    RETURN jsonb_build_object('lines', v_lines, 'scope_type', 'all_branches');
  END IF;
  RETURN v_lines->0;
END;
$$;

-- ---------------------------------------------------------------------------
-- apply_event: recount refreshes live capture + as-of baseline
-- ---------------------------------------------------------------------------
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
  v_live numeric(18, 4);
  v_cutoff timestamptz;
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
  IF v_session.status IN ('awaiting_approval', 'posted', 'cancelled') THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED: session is %', v_session.status;
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);

  v_prior := v_line.physical_qty;
  v_pass := v_line.active_pass_number;
  v_branch := COALESCE(v_line.branch_id, v_session.branch_id);
  v_cutoff := public._stock_count_as_of_cutoff(v_session.as_of_date);

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
    IF v_branch IS NULL THEN
      RAISE EXCEPTION 'STOCK_COUNT_BRANCH_REQUIRED: line missing branch_id for recount baseline';
    END IF;
    v_baseline := public._stock_count_system_qty(
      v_company, v_branch, v_line.product_id, v_line.variation_id, v_cutoff
    );
    v_live := public._stock_count_system_qty(
      v_company, v_branch, v_line.product_id, v_line.variation_id, NULL
    );
    UPDATE public.stock_count_lines
    SET physical_qty = NULL,
        active_pass_number = v_pass,
        count_status = 'uncounted',
        variance = NULL,
        system_qty_baseline = v_baseline,
        baseline_at = COALESCE(v_cutoff - interval '1 microsecond', now()),
        live_qty_at_capture = v_live,
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
      COALESCE(NULLIF(trim(p_reason), ''), 'Recount — as-of baseline + live capture refreshed'),
      auth.uid()
    );

    UPDATE public.stock_count_sessions
    SET status = CASE WHEN status IN ('draft', 'pending_review') THEN 'in_progress' ELSE status END,
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
  SET status = CASE WHEN status IN ('draft', 'pending_review') THEN 'in_progress' ELSE status END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = v_session.id;

  RETURN to_jsonb(v_line);
END;
$$;

COMMENT ON FUNCTION public.stock_count_apply_event(uuid, text, numeric, text) IS
  'Count events; recount refreshes as-of baseline and live_qty_at_capture. Drift badge uses live capture vs live now.';

GRANT EXECUTE ON FUNCTION public.stock_count_add_line(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_count_apply_event(uuid, text, numeric, text) TO authenticated;
