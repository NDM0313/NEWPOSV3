-- All-Branches physical stock count (additive on 20261014140000_*).
-- Session may be single_branch (branch_id set) or all_branches (branch_id NULL).
-- Count lines always carry branch_id; posting creates per-branch movements only.
-- Do not apply to production without explicit approval.

-- ---------------------------------------------------------------------------
-- A) Session scope
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'single_branch';

DO $$
BEGIN
  ALTER TABLE public.stock_count_sessions
    DROP CONSTRAINT IF EXISTS stock_count_sessions_scope_type_check;
  ALTER TABLE public.stock_count_sessions
    ADD CONSTRAINT stock_count_sessions_scope_type_check
    CHECK (scope_type IN ('single_branch', 'all_branches'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Allow NULL branch_id for all_branches sessions
ALTER TABLE public.stock_count_sessions
  ALTER COLUMN branch_id DROP NOT NULL;

ALTER TABLE public.stock_count_sessions
  DROP CONSTRAINT IF EXISTS stock_count_sessions_scope_branch_chk;

ALTER TABLE public.stock_count_sessions
  ADD CONSTRAINT stock_count_sessions_scope_branch_chk
  CHECK (
    (scope_type = 'single_branch' AND branch_id IS NOT NULL)
    OR (scope_type = 'all_branches' AND branch_id IS NULL)
  );

COMMENT ON COLUMN public.stock_count_sessions.scope_type IS
  'single_branch: one physical shop; all_branches: every accessible company branch.';

-- ---------------------------------------------------------------------------
-- B) Line-level branch (required for multi-branch posting)
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_count_lines
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT;

-- Backfill from session for any existing single-branch rows
UPDATE public.stock_count_lines l
SET branch_id = s.branch_id
FROM public.stock_count_sessions s
WHERE l.session_id = s.id
  AND l.branch_id IS NULL
  AND s.branch_id IS NOT NULL;

-- Drop old uniqueness; replace with branch-aware unique
ALTER TABLE public.stock_count_lines
  DROP CONSTRAINT IF EXISTS stock_count_lines_session_product_variation_unique;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_count_lines' AND column_name = 'branch_id'
  ) THEN
    -- Fail closed: refuse NULL branch_id once backfill done for single-branch data
    ALTER TABLE public.stock_count_lines
      ALTER COLUMN branch_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN not_null_violation THEN
    RAISE NOTICE 'stock_count_lines.branch_id still null for some rows; leaving nullable until cleaned';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS stock_count_lines_session_product_var_branch_uidx
  ON public.stock_count_lines (session_id, product_id, variation_key, branch_id);

CREATE INDEX IF NOT EXISTS idx_stock_count_lines_session_branch
  ON public.stock_count_lines (session_id, branch_id);

-- ---------------------------------------------------------------------------
-- C) Access helper: nullable branch = all-branches session (company check only)
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
    -- all_branches session: company membership is enough; per-line branch checked on write
    RETURN;
  END IF;
  IF NOT (
    public.is_owner_or_admin()
    OR public.has_branch_access(p_branch_id)
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_FORBIDDEN: branch access denied';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._stock_count_accessible_branch_ids(p_company_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(b.id ORDER BY b.name), ARRAY[]::uuid[])
  FROM public.branches b
  WHERE b.company_id = p_company_id
    AND COALESCE(b.is_active, true) = true
    AND (
      public.is_owner_or_admin()
      OR public.has_branch_access(b.id)
    );
$$;

-- ---------------------------------------------------------------------------
-- D) create_stock_count_session — optional all branches
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stock_count_session(
  p_branch_id uuid,
  p_notes text DEFAULT NULL,
  p_all_branches boolean DEFAULT false
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

  IF COALESCE(p_all_branches, false) THEN
    v_branches := public._stock_count_accessible_branch_ids(v_company);
    IF coalesce(array_length(v_branches, 1), 0) < 1 THEN
      RAISE EXCEPTION 'STOCK_COUNT_BRANCH_REQUIRED: no accessible branches';
    END IF;
    INSERT INTO public.stock_count_sessions (
      company_id, branch_id, scope_type, status, notes, created_by, updated_by
    ) VALUES (
      v_company, NULL, 'all_branches', 'draft', NULLIF(trim(p_notes), ''), auth.uid(), auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    IF p_branch_id IS NULL THEN
      RAISE EXCEPTION 'STOCK_COUNT_BRANCH_REQUIRED: physical count requires a branch';
    END IF;
    PERFORM public._stock_count_assert_access(v_company, p_branch_id);
    INSERT INTO public.stock_count_sessions (
      company_id, branch_id, scope_type, status, notes, created_by, updated_by
    ) VALUES (
      v_company, p_branch_id, 'single_branch', 'draft', NULLIF(trim(p_notes), ''), auth.uid(), auth.uid()
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

-- ---------------------------------------------------------------------------
-- E) list / get — all_branches readable with company access
-- ---------------------------------------------------------------------------
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
        AND (
          p_branch_id IS NULL
          OR s.branch_id = p_branch_id
          OR (s.scope_type = 'all_branches' AND p_branch_id IS NULL)
        )
        AND (p_status IS NULL OR s.status = p_status)
        AND (
          public.is_owner_or_admin()
          OR s.scope_type = 'all_branches'
          OR (s.branch_id IS NOT NULL AND public.has_branch_access(s.branch_id))
        )
      ORDER BY s.updated_at DESC
      LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    ) s
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- F) add_line — fan-out for all_branches
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

  IF v_session.scope_type = 'all_branches' THEN
    v_branches := public._stock_count_accessible_branch_ids(v_company);
  ELSE
    v_branches := ARRAY[v_session.branch_id];
  END IF;

  FOREACH v_bid IN ARRAY v_branches
  LOOP
    PERFORM public._stock_count_assert_access(v_company, v_bid);
    v_baseline := public._stock_count_system_qty(
      v_company, v_bid, p_product_id, p_variation_id
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
        v_baseline, now(), NULL, 'uncounted', NULLIF(trim(p_notes), '')
      )
      RETURNING * INTO v_line;
    END IF;

    v_lines := v_lines || jsonb_build_array(to_jsonb(v_line));
  END LOOP;

  UPDATE public.stock_count_sessions
  SET status = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id;

  -- Single-branch: return the one line object (compat). All-branches: array.
  IF v_session.scope_type = 'all_branches' THEN
    RETURN jsonb_build_object('lines', v_lines, 'scope_type', 'all_branches');
  END IF;
  RETURN v_lines->0;
END;
$$;

-- Posting already loops lines; ensure movement uses line.branch_id
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
  v_branch uuid;
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
        reference_type, reference_id, notes, created_by
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

GRANT EXECUTE ON FUNCTION public.create_stock_count_session(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public._stock_count_accessible_branch_ids(uuid) TO authenticated;
