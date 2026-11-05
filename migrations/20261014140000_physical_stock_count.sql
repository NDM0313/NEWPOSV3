-- Physical Stock Count and Reconciliation (web-first).
-- Additive schema + RPCs. Draft counts do NOT write stock_movements until post.
-- Posting applies adjustment_delta = accepted_physical - system_qty_at_baseline only.
-- Do not apply to production without explicit approval.

-- ---------------------------------------------------------------------------
-- A) Sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_count_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'pending_review', 'posted', 'cancelled')),
  notes text NULL,
  created_by uuid NULL,
  updated_by uuid NULL,
  reviewed_by uuid NULL,
  posted_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  reviewed_at timestamptz NULL,
  posted_at timestamptz NULL,
  post_client_operation_id uuid NULL,
  CONSTRAINT stock_count_sessions_company_post_op_unique
    UNIQUE (company_id, post_client_operation_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_company_branch
  ON public.stock_count_sessions (company_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_company_status
  ON public.stock_count_sessions (company_id, status, updated_at DESC);

COMMENT ON TABLE public.stock_count_sessions IS
  'Physical stock count session for one company + one branch. Draft until posted.';

-- ---------------------------------------------------------------------------
-- B) Lines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.stock_count_sessions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variation_id uuid NULL REFERENCES public.product_variations(id) ON DELETE RESTRICT,
  system_qty_baseline numeric(18, 4) NOT NULL DEFAULT 0,
  baseline_at timestamptz NOT NULL DEFAULT now(),
  physical_qty numeric(18, 4) NULL,
  active_pass_number int NOT NULL DEFAULT 1,
  variance numeric(18, 4) NULL,
  count_status text NOT NULL DEFAULT 'uncounted'
    CHECK (count_status IN ('uncounted', 'counted_zero', 'counted_qty')),
  notes text NULL,
  reason text NULL,
  stock_movement_id uuid NULL,
  posted_at timestamptz NULL,
  reconciled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  variation_key uuid GENERATED ALWAYS AS (
    COALESCE(variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) STORED,
  CONSTRAINT stock_count_lines_session_product_variation_unique
    UNIQUE (session_id, product_id, variation_key)
);

CREATE INDEX IF NOT EXISTS idx_stock_count_lines_session
  ON public.stock_count_lines (session_id, count_status);
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_company_product
  ON public.stock_count_lines (company_id, product_id, variation_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_count_lines_movement_once
  ON public.stock_count_lines (stock_movement_id)
  WHERE stock_movement_id IS NOT NULL;

COMMENT ON TABLE public.stock_count_lines IS
  'Count line: baseline system qty frozen at add/count time; physical_qty null = uncounted.';

-- ---------------------------------------------------------------------------
-- C) Events / passes (append-only audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_count_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.stock_count_sessions(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES public.stock_count_lines(id) ON DELETE CASCADE,
  pass_number int NOT NULL DEFAULT 1,
  event_type text NOT NULL
    CHECK (event_type IN (
      'increment', 'decrement', 'set', 'confirm_zero', 'start_recount', 'note'
    )),
  prior_qty numeric(18, 4) NULL,
  new_qty numeric(18, 4) NULL,
  reason text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_count_events_line
  ON public.stock_count_events (line_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_count_events_session
  ON public.stock_count_events (session_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- D) Unmatched catalog issues (no auto product create)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_count_unmatched_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.stock_count_sessions(id) ON DELETE CASCADE,
  description text NOT NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_count_unmatched_session
  ON public.stock_count_unmatched_issues (session_id, status);

-- Idempotent posting of movements per count line
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_stock_count_line_once
  ON public.stock_movements (reference_type, reference_id)
  WHERE reference_type = 'stock_count' AND reference_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- E) Permissions (additive)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, module, action, allowed)
SELECT r.role, 'inventory', a.action, true
FROM (VALUES ('owner'), ('admin'), ('manager')) AS r(role)
CROSS JOIN (VALUES ('count'), ('post_count')) AS a(action)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'role_permissions'
)
ON CONFLICT DO NOTHING;

-- Some installs use unique (role, module, action)
DO $$
BEGIN
  INSERT INTO public.role_permissions (role, module, action, allowed)
  VALUES
    ('owner', 'inventory', 'count', true),
    ('owner', 'inventory', 'post_count', true),
    ('admin', 'inventory', 'count', true),
    ('admin', 'inventory', 'post_count', true),
    ('manager', 'inventory', 'count', true),
    ('manager', 'inventory', 'post_count', true),
    ('user', 'inventory', 'count', true),
    ('user', 'inventory', 'post_count', false)
  ON CONFLICT (role, module, action) DO UPDATE
    SET allowed = EXCLUDED.allowed
  WHERE public.role_permissions.allowed IS DISTINCT FROM EXCLUDED.allowed;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN unique_violation THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- F) Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._stock_count_assert_access(p_company_id uuid, p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
BEGIN
  v_company := public.get_user_company_id();
  IF v_company IS NULL OR v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: company access denied';
  END IF;
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_BRANCH_REQUIRED: physical count requires a branch';
  END IF;
  IF NOT (
    public.is_owner_or_admin()
    OR public.has_branch_access(p_branch_id)
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: branch access denied';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._stock_count_system_qty(
  p_company_id uuid,
  p_branch_id uuid,
  p_product_id uuid,
  p_variation_id uuid
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
    );
$$;

CREATE OR REPLACE FUNCTION public._stock_count_line_status(p_physical numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_physical IS NULL THEN 'uncounted'
    WHEN p_physical = 0 THEN 'counted_zero'
    ELSE 'counted_qty'
  END;
$$;

CREATE OR REPLACE FUNCTION public._stock_count_resolve_unit_cost(
  p_product_id uuid,
  p_variation_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT NULLIF(p.cost_price, 0)
      FROM public.products p
      WHERE p.id = p_product_id
    ),
    0
  )::numeric;
$$;

-- ---------------------------------------------------------------------------
-- G) RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stock_count_session(
  p_branch_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_row public.stock_count_sessions%ROWTYPE;
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
  PERFORM public._stock_count_assert_access(v_company, p_branch_id);

  INSERT INTO public.stock_count_sessions (
    company_id, branch_id, status, notes, created_by, updated_by
  ) VALUES (
    v_company, p_branch_id, 'draft', NULLIF(trim(p_notes), ''), auth.uid(), auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_stock_count_sessions(
  p_branch_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: not authenticated';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.updated_at DESC)
    FROM (
      SELECT *
      FROM public.stock_count_sessions s
      WHERE s.company_id = v_company
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        AND (p_status IS NULL OR s.status = p_status)
        AND (
          public.is_owner_or_admin()
          OR public.has_branch_access(s.branch_id)
        )
      ORDER BY s.updated_at DESC
      LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    ) s
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stock_count_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_session public.stock_count_sessions%ROWTYPE;
  v_lines jsonb;
  v_issues jsonb;
BEGIN
  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = p_session_id AND company_id = v_company;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.updated_at DESC), '[]'::jsonb)
  INTO v_lines
  FROM public.stock_count_lines l
  WHERE l.session_id = p_session_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC), '[]'::jsonb)
  INTO v_issues
  FROM public.stock_count_unmatched_issues i
  WHERE i.session_id = p_session_id;

  RETURN jsonb_build_object(
    'session', to_jsonb(v_session),
    'lines', v_lines,
    'unmatched_issues', v_issues
  );
END;
$$;

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
  v_baseline numeric(18, 4);
  v_line public.stock_count_lines%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = p_session_id AND company_id = v_company
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;
  IF v_session.status IN ('posted', 'cancelled') THEN
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

  v_baseline := public._stock_count_system_qty(
    v_company, v_session.branch_id, p_product_id, p_variation_id
  );

  SELECT * INTO v_line
  FROM public.stock_count_lines
  WHERE session_id = p_session_id
    AND product_id = p_product_id
    AND variation_id IS NOT DISTINCT FROM p_variation_id;

  IF FOUND THEN
    UPDATE public.stock_count_lines
    SET updated_at = now(),
        notes = COALESCE(NULLIF(trim(p_notes), ''), notes)
    WHERE id = v_line.id
    RETURNING * INTO v_line;
  ELSE
    INSERT INTO public.stock_count_lines (
      company_id, session_id, product_id, variation_id,
      system_qty_baseline, baseline_at, physical_qty, count_status, notes
    ) VALUES (
      v_company, p_session_id, p_product_id, p_variation_id,
      v_baseline, now(), NULL, 'uncounted', NULLIF(trim(p_notes), '')
    )
    RETURNING * INTO v_line;
  END IF;

  UPDATE public.stock_count_sessions
  SET status = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id;

  RETURN to_jsonb(v_line);
END;
$$;

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
BEGIN
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

CREATE OR REPLACE FUNCTION public.stock_count_record_unmatched(
  p_session_id uuid,
  p_description text,
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
  v_row public.stock_count_unmatched_issues%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM public.stock_count_sessions
  WHERE id = p_session_id AND company_id = v_company;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
  END IF;
  IF v_session.status IN ('posted', 'cancelled') THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED';
  END IF;
  PERFORM public._stock_count_assert_access(v_session.company_id, v_session.branch_id);
  IF NULLIF(trim(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'STOCK_COUNT_DESCRIPTION_REQUIRED';
  END IF;

  INSERT INTO public.stock_count_unmatched_issues (
    company_id, session_id, description, notes, created_by
  ) VALUES (
    v_company, p_session_id, trim(p_description), NULLIF(trim(p_notes), ''), auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

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
  IF v_session.status IN ('posted', 'cancelled') THEN
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
  v_line public.stock_count_lines%ROWTYPE;
  v_delta numeric(18, 4);
  v_unit_cost numeric(18, 4);
  v_total_cost numeric(18, 4);
  v_movement_id uuid;
  v_posted int := 0;
  v_zero int := 0;
  v_uncounted int;
  v_op uuid;
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

  -- Idempotent retry: already posted
  IF v_session.status = 'posted' THEN
    RETURN jsonb_build_object(
      'session', to_jsonb(v_session),
      'posted_movements', v_posted,
      'zero_variance', v_zero,
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

  IF v_session.status IS DISTINCT FROM 'pending_review' THEN
    -- Auto-complete when reviewer posts from in_progress with no uncounted (or partial allowed)
    UPDATE public.stock_count_sessions
    SET status = 'pending_review',
        completed_at = COALESCE(completed_at, now()),
        updated_at = now()
    WHERE id = p_session_id;
  END IF;

  FOR v_line IN
    SELECT * FROM public.stock_count_lines
    WHERE session_id = p_session_id
      AND count_status IN ('counted_zero', 'counted_qty')
      AND stock_movement_id IS NULL
      AND reconciled_at IS NULL
    FOR UPDATE
  LOOP
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

    -- Skip if movement already exists (retry safety)
    SELECT id INTO v_movement_id
    FROM public.stock_movements
    WHERE reference_type = 'stock_count' AND reference_id = v_line.id
    LIMIT 1;

    IF v_movement_id IS NULL THEN
      v_unit_cost := public._stock_count_resolve_unit_cost(v_line.product_id, v_line.variation_id);
      -- Match productService.createStockMovement: total_cost is abs(qty)*unit; sign lives on quantity.
      v_total_cost := ROUND(ABS(v_delta) * COALESCE(v_unit_cost, 0), 2);

      INSERT INTO public.stock_movements (
        company_id, branch_id, product_id, variation_id,
        movement_type, quantity, unit_cost, total_cost,
        reference_type, reference_id, notes, created_by
      ) VALUES (
        v_company,
        v_session.branch_id,
        v_line.product_id,
        v_line.variation_id,
        'adjustment',
        v_delta,
        v_unit_cost,
        v_total_cost,
        'stock_count',
        v_line.id,
        'Physical stock count adjustment',
        auth.uid()
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
      posted_at = now(),
      posted_by = auth.uid(),
      reviewed_at = COALESCE(reviewed_at, now()),
      reviewed_by = COALESCE(reviewed_by, auth.uid()),
      post_client_operation_id = v_op,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'session', to_jsonb(v_session),
    'posted_movements', v_posted,
    'zero_variance', v_zero,
    'idempotent', false
  );
END;
$$;

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
  SET status = 'cancelled', updated_at = now(), updated_by = auth.uid()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN to_jsonb(v_session);
END;
$$;

-- Catalog search is implemented in the web stockCountService (company-scoped),
-- so missing optional columns (e.g. variation barcode) do not break this migration.

-- ---------------------------------------------------------------------------
-- H) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_unmatched_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_count_sessions_select ON public.stock_count_sessions;
CREATE POLICY stock_count_sessions_select ON public.stock_count_sessions
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (public.is_owner_or_admin() OR public.has_branch_access(branch_id))
  );

DROP POLICY IF EXISTS stock_count_sessions_write ON public.stock_count_sessions;
CREATE POLICY stock_count_sessions_write ON public.stock_count_sessions
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (public.is_owner_or_admin() OR public.has_branch_access(branch_id))
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND (public.is_owner_or_admin() OR public.has_branch_access(branch_id))
  );

DROP POLICY IF EXISTS stock_count_lines_all ON public.stock_count_lines;
CREATE POLICY stock_count_lines_all ON public.stock_count_lines
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.stock_count_sessions s
      WHERE s.id = session_id
        AND (public.is_owner_or_admin() OR public.has_branch_access(s.branch_id))
    )
  )
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS stock_count_events_all ON public.stock_count_events;
CREATE POLICY stock_count_events_all ON public.stock_count_events
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.stock_count_sessions s
      WHERE s.id = session_id
        AND (public.is_owner_or_admin() OR public.has_branch_access(s.branch_id))
    )
  )
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS stock_count_unmatched_all ON public.stock_count_unmatched_issues;
CREATE POLICY stock_count_unmatched_all ON public.stock_count_unmatched_issues
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.stock_count_sessions s
      WHERE s.id = session_id
        AND (public.is_owner_or_admin() OR public.has_branch_access(s.branch_id))
    )
  )
  WITH CHECK (company_id = public.get_user_company_id());

REVOKE ALL ON public.stock_count_sessions FROM PUBLIC;
REVOKE ALL ON public.stock_count_lines FROM PUBLIC;
REVOKE ALL ON public.stock_count_events FROM PUBLIC;
REVOKE ALL ON public.stock_count_unmatched_issues FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON public.stock_count_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stock_count_lines TO authenticated;
GRANT SELECT, INSERT ON public.stock_count_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stock_count_unmatched_issues TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_stock_count_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_stock_count_sessions(uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_count_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_count_add_line(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_count_apply_event(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_count_record_unmatched(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_stock_count_session(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_stock_count_session(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_count_session(uuid) TO authenticated;
