-- Physical stock count: as-of date, submit≠stock, approve writes movements + STK doc no.
-- Additive on 2026101414/16/17/18*. Do not apply to production without explicit approval.
-- Design: docs/inventory/STOCK_COUNT_REVIEW_APPROVE_ASOF_DESIGN.md

-- ---------------------------------------------------------------------------
-- A) Session columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS as_of_date date;

ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS document_no text;

ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);

UPDATE public.stock_count_sessions
SET as_of_date = COALESCE(as_of_date, (created_at AT TIME ZONE 'UTC')::date)
WHERE as_of_date IS NULL;

ALTER TABLE public.stock_count_sessions
  ALTER COLUMN as_of_date SET DEFAULT (CURRENT_DATE);

DO $$
BEGIN
  ALTER TABLE public.stock_count_sessions
    ALTER COLUMN as_of_date SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'stock_count_sessions.as_of_date not-null skipped: %', SQLERRM;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS stock_count_sessions_company_document_no_uidx
  ON public.stock_count_sessions (company_id, document_no)
  WHERE document_no IS NOT NULL;

COMMENT ON COLUMN public.stock_count_sessions.as_of_date IS
  'Closing / count-as-of calendar date. Baseline = movements on or before this date (UTC day).';
COMMENT ON COLUMN public.stock_count_sessions.document_no IS
  'Operator-facing stock update number (STK-…) assigned on approve.';

-- ---------------------------------------------------------------------------
-- B) Status: awaiting_approval
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_count_sessions
  DROP CONSTRAINT IF EXISTS stock_count_sessions_status_check;

ALTER TABLE public.stock_count_sessions
  ADD CONSTRAINT stock_count_sessions_status_check
  CHECK (status IN (
    'draft',
    'in_progress',
    'pending_review',
    'awaiting_approval',
    'posted',
    'cancelled'
  ));

-- ---------------------------------------------------------------------------
-- C) As-of helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._stock_count_as_of_cutoff(p_as_of date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_as_of IS NULL THEN NULL
    ELSE ((p_as_of + 1)::timestamp AT TIME ZONE 'UTC')
  END;
$$;

COMMENT ON FUNCTION public._stock_count_as_of_cutoff(date) IS
  'Exclusive upper bound: movements with created_at < cutoff are on/before as_of_date (UTC calendar day).';

CREATE OR REPLACE FUNCTION public._stock_count_system_qty(
  p_company_id uuid,
  p_branch_id uuid,
  p_product_id uuid,
  p_variation_id uuid,
  p_as_of_cutoff timestamptz DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(sm.quantity), 0)::numeric(18, 4)
  FROM public.stock_movements sm
  WHERE sm.company_id = p_company_id
    AND sm.product_id = p_product_id
    AND sm.branch_id = p_branch_id
    AND (
      (p_variation_id IS NULL AND sm.variation_id IS NULL)
      OR sm.variation_id IS NOT DISTINCT FROM p_variation_id
    )
    AND (p_as_of_cutoff IS NULL OR sm.created_at < p_as_of_cutoff);
$$;

COMMENT ON FUNCTION public._stock_count_system_qty(uuid, uuid, uuid, uuid, timestamptz) IS
  'System qty; optional exclusive as-of cutoff for historical closing stock.';

-- ---------------------------------------------------------------------------
-- D) create_stock_count_session — as_of_date
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stock_count_session(
  p_branch_id uuid,
  p_notes text DEFAULT NULL,
  p_all_branches boolean DEFAULT false,
  p_as_of_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_row public.stock_count_sessions%ROWTYPE;
  v_branches uuid[];
  v_as_of date := COALESCE(p_as_of_date, CURRENT_DATE);
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: not authenticated';
  END IF;
  IF NOT (
    public.is_owner_or_admin()
    OR public.has_permission('inventory', 'count')
    OR public.has_permission('inventory', 'view')
    OR public.has_permission('inventory', 'adjust')
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: missing inventory.count permission';
  END IF;
  IF v_as_of > CURRENT_DATE THEN
    RAISE EXCEPTION 'STOCK_COUNT_INVALID_AS_OF: as_of_date cannot be in the future';
  END IF;

  IF COALESCE(p_all_branches, false) THEN
    v_branches := public._stock_count_accessible_branch_ids(v_company);
    IF coalesce(array_length(v_branches, 1), 0) < 1 THEN
      RAISE EXCEPTION 'STOCK_COUNT_BRANCH_REQUIRED: no accessible branches';
    END IF;
    INSERT INTO public.stock_count_sessions (
      company_id, branch_id, scope_type, status, notes, as_of_date, created_by, updated_by
    ) VALUES (
      v_company, NULL, 'all_branches', 'draft', NULLIF(trim(p_notes), ''), v_as_of, auth.uid(), auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    IF p_branch_id IS NULL THEN
      RAISE EXCEPTION 'STOCK_COUNT_BRANCH_REQUIRED: physical count requires a branch';
    END IF;
    PERFORM public._stock_count_assert_access(v_company, p_branch_id);
    INSERT INTO public.stock_count_sessions (
      company_id, branch_id, scope_type, status, notes, as_of_date, created_by, updated_by
    ) VALUES (
      v_company, p_branch_id, 'single_branch', 'draft', NULLIF(trim(p_notes), ''), v_as_of, auth.uid(), auth.uid()
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

-- ---------------------------------------------------------------------------
-- E) add_line — historical baseline
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

    SELECT * INTO v_line
    FROM public.stock_count_lines
    WHERE session_id = p_session_id
      AND product_id = p_product_id
      AND variation_id IS NOT DISTINCT FROM p_variation_id
      AND branch_id = v_bid;

    IF FOUND THEN
      UPDATE public.stock_count_lines
      SET updated_at = now(),
          notes = COALESCE(NULLIF(trim(p_notes), ''), notes)
      WHERE id = v_line.id
      RETURNING * INTO v_line;
    ELSE
      INSERT INTO public.stock_count_lines (
        company_id, session_id, branch_id, product_id, variation_id,
        system_qty_baseline, baseline_at, physical_qty, count_status, notes
      ) VALUES (
        v_company, p_session_id, v_bid, p_product_id, p_variation_id,
        v_baseline, COALESCE(v_cutoff - interval '1 microsecond', now()), NULL, 'uncounted', NULLIF(trim(p_notes), '')
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
-- F) apply_event — lock awaiting_approval; recount uses as-of baseline
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
    UPDATE public.stock_count_lines
    SET physical_qty = NULL,
        active_pass_number = v_pass,
        count_status = 'uncounted',
        variance = NULL,
        system_qty_baseline = v_baseline,
        baseline_at = COALESCE(v_cutoff - interval '1 microsecond', now()),
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
      COALESCE(NULLIF(trim(p_reason), ''), 'Recount — baseline refreshed to as-of system qty'),
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
  'Count events; recount refreshes baseline to session as_of historical qty. Locked when awaiting_approval/posted.';

-- ---------------------------------------------------------------------------
-- G) complete — freeze variances
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_stock_count_session(
  p_session_id uuid,
  p_allow_partial boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_session public.stock_count_sessions%ROWTYPE;
  v_uncounted int;
BEGIN
  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = p_session_id AND company_id = v_company
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;
  IF v_session.status IN ('awaiting_approval', 'posted', 'cancelled') THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED';
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);

  SELECT COUNT(*) INTO v_uncounted
  FROM public.stock_count_lines
  WHERE session_id = p_session_id AND count_status = 'uncounted';

  IF v_uncounted > 0 AND NOT (
    p_allow_partial AND (
      public.is_owner_or_admin()
      OR public.has_permission('inventory', 'post_count')
      OR public.has_permission('inventory', 'adjust')
    )
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_INCOMPLETE: % uncounted line(s)', v_uncounted;
  END IF;

  UPDATE public.stock_count_lines
  SET variance = CASE
        WHEN physical_qty IS NULL THEN NULL
        ELSE ROUND((physical_qty - system_qty_baseline)::numeric, 4)
      END,
      updated_at = now()
  WHERE session_id = p_session_id;

  UPDATE public.stock_count_sessions
  SET status = 'pending_review',
      completed_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN to_jsonb(v_session);
END;
$$;

-- ---------------------------------------------------------------------------
-- H) post = submit for approval (NO stock movements)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_stock_count_session(
  p_session_id uuid,
  p_client_operation_id uuid DEFAULT NULL,
  p_allow_partial boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_session public.stock_count_sessions%ROWTYPE;
  v_uncounted int;
  v_op uuid;
  v_over numeric(18, 4) := 0;
  v_short numeric(18, 4) := 0;
  v_lines int := 0;
BEGIN
  IF NOT (
    public.is_owner_or_admin()
    OR public.has_permission('inventory', 'post_count')
    OR public.has_permission('inventory', 'adjust')
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: missing inventory.post_count / adjust';
  END IF;

  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = p_session_id AND company_id = v_company
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);

  IF v_session.status = 'posted' THEN
    RETURN jsonb_build_object(
      'session', to_jsonb(v_session),
      'posted_movements', 0,
      'zero_variance', 0,
      'submitted', false,
      'idempotent', true
    );
  END IF;
  IF v_session.status = 'awaiting_approval' THEN
    RETURN jsonb_build_object(
      'session', to_jsonb(v_session),
      'posted_movements', 0,
      'zero_variance', 0,
      'submitted', true,
      'idempotent', true
    );
  END IF;
  IF v_session.status = 'cancelled' THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED: cancelled';
  END IF;

  v_op := COALESCE(p_client_operation_id, gen_random_uuid());
  IF EXISTS (
    SELECT 1 FROM public.stock_count_sessions
    WHERE company_id = v_company
      AND post_client_operation_id = v_op
      AND id IS DISTINCT FROM p_session_id
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_DUPLICATE_OPERATION';
  END IF;

  SELECT COUNT(*) INTO v_uncounted
  FROM public.stock_count_lines
  WHERE session_id = p_session_id AND count_status = 'uncounted';
  IF v_uncounted > 0 AND NOT p_allow_partial THEN
    RAISE EXCEPTION 'STOCK_COUNT_INCOMPLETE: % uncounted line(s)', v_uncounted;
  END IF;

  UPDATE public.stock_count_lines
  SET variance = CASE
        WHEN physical_qty IS NULL THEN NULL
        ELSE ROUND((physical_qty - system_qty_baseline)::numeric, 4)
      END,
      updated_at = now()
  WHERE session_id = p_session_id
    AND count_status IN ('counted_zero', 'counted_qty');

  SELECT
    COUNT(*) FILTER (WHERE count_status IN ('counted_zero', 'counted_qty')),
    COALESCE(SUM(GREATEST(variance, 0)) FILTER (WHERE variance IS NOT NULL), 0),
    COALESCE(SUM(ABS(LEAST(variance, 0))) FILTER (WHERE variance IS NOT NULL), 0)
  INTO v_lines, v_over, v_short
  FROM public.stock_count_lines
  WHERE session_id = p_session_id;

  UPDATE public.stock_count_sessions
  SET status = 'awaiting_approval',
      completed_at = COALESCE(completed_at, now()),
      submitted_at = now(),
      submitted_by = auth.uid(),
      reviewed_at = COALESCE(reviewed_at, now()),
      reviewed_by = COALESCE(reviewed_by, auth.uid()),
      post_client_operation_id = v_op,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'session', to_jsonb(v_session),
    'posted_movements', 0,
    'zero_variance', 0,
    'submitted', true,
    'counted_lines', v_lines,
    'qty_over', v_over,
    'qty_short', v_short,
    'idempotent', false
  );
END;
$$;

COMMENT ON FUNCTION public.post_stock_count_session(uuid, uuid, boolean) IS
  'Submit count for approval. Does NOT write stock_movements or GL. Status → awaiting_approval.';

-- ---------------------------------------------------------------------------
-- I) approve — STK doc no + dated stock movements
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_stock_count_session(
  p_session_id uuid,
  p_client_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_session public.stock_count_sessions%ROWTYPE;
  v_line public.stock_count_lines%ROWTYPE;
  v_delta numeric(18, 4);
  v_unit_cost numeric(18, 4);
  v_total_cost numeric(18, 4);
  v_movement_id uuid;
  v_posted int := 0;
  v_zero int := 0;
  v_op uuid;
  v_branch uuid;
  v_doc text;
  v_num_branch uuid;
  v_as_of_ts timestamptz;
  v_cutoff timestamptz;
BEGIN
  IF NOT (
    public.is_owner_or_admin()
    OR public.has_permission('inventory', 'post_count')
    OR public.has_permission('inventory', 'adjust')
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: missing inventory.post_count / adjust';
  END IF;

  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = p_session_id AND company_id = v_company
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);

  IF v_session.status = 'posted' THEN
    RETURN jsonb_build_object(
      'session', to_jsonb(v_session),
      'posted_movements', 0,
      'zero_variance', 0,
      'document_no', v_session.document_no,
      'idempotent', true
    );
  END IF;
  IF v_session.status IS DISTINCT FROM 'awaiting_approval' THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_SUBMITTED: status is % (submit first)', v_session.status;
  END IF;

  v_op := COALESCE(p_client_operation_id, gen_random_uuid());
  v_cutoff := public._stock_count_as_of_cutoff(v_session.as_of_date);
  v_as_of_ts := COALESCE(v_cutoff - interval '1 microsecond', now());

  v_num_branch := v_session.branch_id;
  IF v_num_branch IS NULL THEN
    SELECT l.branch_id INTO v_num_branch
    FROM public.stock_count_lines l
    WHERE l.session_id = p_session_id
    ORDER BY l.created_at
    LIMIT 1;
  END IF;
  IF v_num_branch IS NULL THEN
    SELECT b.id INTO v_num_branch
    FROM public.branches b
    WHERE b.company_id = v_company AND COALESCE(b.is_active, true)
    ORDER BY b.name
    LIMIT 1;
  END IF;
  IF v_num_branch IS NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_BRANCH_REQUIRED: cannot allocate document number';
  END IF;

  IF v_session.document_no IS NULL THEN
    BEGIN
      v_doc := public.get_next_document_number(v_company, v_num_branch, 'stock');
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        v_doc := public.get_next_document_number(v_company, v_num_branch, 'STOCK');
      EXCEPTION WHEN OTHERS THEN
        v_doc := 'STK-' || to_char(now(), 'YYYYMMDD') || '-' || substr(p_session_id::text, 1, 8);
      END;
    END;
  ELSE
    v_doc := v_session.document_no;
  END IF;

  FOR v_line IN
    SELECT * FROM public.stock_count_lines
    WHERE session_id = p_session_id
      AND count_status IN ('counted_zero', 'counted_qty')
      AND stock_movement_id IS NULL
      AND reconciled_at IS NULL
    FOR UPDATE
  LOOP
    v_branch := COALESCE(v_line.branch_id, v_session.branch_id);
    IF v_branch IS NULL THEN
      RAISE EXCEPTION 'STOCK_COUNT_BRANCH_REQUIRED: line % missing branch_id', v_line.id;
    END IF;
    PERFORM public._stock_count_assert_access(v_company, v_branch);

    v_delta := ROUND((v_line.physical_qty - v_line.system_qty_baseline)::numeric, 4);

    IF ABS(v_delta) < 0.0000001 THEN
      UPDATE public.stock_count_lines
      SET variance = 0,
          reconciled_at = now(),
          posted_at = now(),
          updated_at = now()
      WHERE id = v_line.id;
      v_zero := v_zero + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_movement_id
    FROM public.stock_movements
    WHERE reference_type = 'stock_count' AND reference_id = v_line.id
    LIMIT 1;

    IF v_movement_id IS NULL THEN
      v_unit_cost := public._stock_count_resolve_unit_cost(v_line.product_id, v_line.variation_id);
      v_total_cost := ROUND(ABS(v_delta) * COALESCE(v_unit_cost, 0), 2);

      INSERT INTO public.stock_movements (
        company_id, branch_id, product_id, variation_id,
        movement_type, quantity, unit_cost, total_cost,
        reference_type, reference_id, notes, created_by, created_at
      ) VALUES (
        v_company,
        v_branch,
        v_line.product_id,
        v_line.variation_id,
        'adjustment',
        v_delta,
        v_unit_cost,
        v_total_cost,
        'stock_count',
        v_line.id,
        'Physical stock count ' || v_doc || ' as of ' || v_session.as_of_date::text,
        auth.uid(),
        v_as_of_ts
      )
      RETURNING id INTO v_movement_id;
    END IF;

    UPDATE public.stock_count_lines
    SET stock_movement_id = v_movement_id,
        variance = v_delta,
        reconciled_at = now(),
        posted_at = now(),
        updated_at = now()
    WHERE id = v_line.id;

    v_posted := v_posted + 1;
  END LOOP;

  UPDATE public.stock_count_sessions
  SET status = 'posted',
      document_no = v_doc,
      posted_at = now(),
      posted_by = auth.uid(),
      approved_at = now(),
      approved_by = auth.uid(),
      post_client_operation_id = COALESCE(post_client_operation_id, v_op),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'session', to_jsonb(v_session),
    'posted_movements', v_posted,
    'zero_variance', v_zero,
    'document_no', v_doc,
    'idempotent', false
  );
END;
$$;

COMMENT ON FUNCTION public.approve_stock_count_session(uuid, uuid) IS
  'Final approval: assigns STK document_no and writes as-of-dated stock_movements (+ GL via existing trigger).';

-- ---------------------------------------------------------------------------
-- J) reject — reopen count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_stock_count_session(
  p_session_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_session public.stock_count_sessions%ROWTYPE;
BEGIN
  IF NOT (
    public.is_owner_or_admin()
    OR public.has_permission('inventory', 'post_count')
    OR public.has_permission('inventory', 'adjust')
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: missing inventory.post_count / adjust';
  END IF;

  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = p_session_id AND company_id = v_company
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;
  IF v_session.status IS DISTINCT FROM 'awaiting_approval' THEN
    RAISE EXCEPTION 'STOCK_COUNT_REJECT_INVALID: status is %', v_session.status;
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);

  UPDATE public.stock_count_sessions
  SET status = 'in_progress',
      submitted_at = NULL,
      submitted_by = NULL,
      notes = CASE
        WHEN NULLIF(trim(p_reason), '') IS NULL THEN notes
        ELSE COALESCE(notes || E'\n', '') || 'Reject: ' || trim(p_reason)
      END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN to_jsonb(v_session);
END;
$$;

-- ---------------------------------------------------------------------------
-- K) cancel / remove — respect awaiting_approval
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_stock_count_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_session public.stock_count_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = p_session_id AND company_id = v_company
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;
  IF v_session.status = 'posted' THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED: already posted';
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);

  UPDATE public.stock_count_sessions
  SET status = 'cancelled',
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN to_jsonb(v_session);
END;
$$;

-- ---------------------------------------------------------------------------
-- L) remove_line — also lock awaiting_approval
-- ---------------------------------------------------------------------------
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
  v_assert_branch uuid;
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

  IF v_session.status IN ('awaiting_approval', 'posted', 'cancelled') THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED: session is %', v_session.status;
  END IF;

  IF v_line.stock_movement_id IS NOT NULL OR v_line.posted_at IS NOT NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_LINE_POSTED: cannot remove a posted count line';
  END IF;

  v_assert_branch := COALESCE(v_line.branch_id, v_session.branch_id);
  PERFORM public._stock_count_assert_access(v_company, v_assert_branch);

  DELETE FROM public.stock_count_lines
  WHERE id = v_line.id AND company_id = v_company;

  UPDATE public.stock_count_sessions
  SET status = CASE WHEN status = 'pending_review' THEN 'in_progress' ELSE status END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'removed', true,
    'line_id', p_line_id,
    'session_id', v_session.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_stock_count_session(uuid, text, boolean, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_stock_count_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_stock_count_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._stock_count_as_of_cutoff(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public._stock_count_system_qty(uuid, uuid, uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_count_remove_line(uuid) TO authenticated;
