-- Reverse approved stock counts (CoA-safe opposite adjustments). Soft-cancel stays for non-posted.
-- Additive on 2026101419/200000_*. Do not apply to production without explicit approval.

-- ---------------------------------------------------------------------------
-- A) Status + reverse audit columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES auth.users(id);

ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS reverse_reason text;

ALTER TABLE public.stock_count_sessions
  ADD COLUMN IF NOT EXISTS reverse_client_operation_id uuid;

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
    'cancelled',
    'reversed'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS stock_count_sessions_company_reverse_op_uidx
  ON public.stock_count_sessions (company_id, reverse_client_operation_id)
  WHERE reverse_client_operation_id IS NOT NULL;

-- One reversal movement per count line (parallel to original stock_count unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_stock_count_reversal_once
  ON public.stock_movements (reference_id)
  WHERE reference_type = 'stock_count_reversal' AND reference_id IS NOT NULL;

COMMENT ON COLUMN public.stock_count_sessions.reversed_at IS
  'When a posted count was reversed (opposite stock adjustments + GL).';

-- ---------------------------------------------------------------------------
-- B) cancel — block posted + reversed
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
  IF v_session.status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'STOCK_COUNT_LOCKED: use reverse for posted counts (status=%)', v_session.status;
  END IF;
  IF v_session.status = 'cancelled' THEN
    RETURN to_jsonb(v_session);
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

COMMENT ON FUNCTION public.cancel_stock_count_session(uuid) IS
  'Soft-cancel draft/in_progress/pending_review/awaiting_approval. Posted/reversed must use reverse_stock_count_session.';

-- ---------------------------------------------------------------------------
-- C) reverse posted — opposite adjustments, keep STK document_no
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_stock_count_session(
  p_session_id uuid,
  p_reason text DEFAULT NULL,
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
  v_orig public.stock_movements%ROWTYPE;
  v_rev_id uuid;
  v_reversed int := 0;
  v_skipped int := 0;
  v_op uuid;
  v_notes text;
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

  IF v_session.status = 'reversed' THEN
    RETURN jsonb_build_object(
      'session', to_jsonb(v_session),
      'reversed_movements', 0,
      'skipped', 0,
      'document_no', v_session.document_no,
      'idempotent', true
    );
  END IF;
  IF v_session.status IS DISTINCT FROM 'posted' THEN
    RAISE EXCEPTION 'STOCK_COUNT_REVERSE_INVALID: status is % (posted only)', v_session.status;
  END IF;

  v_op := COALESCE(p_client_operation_id, gen_random_uuid());
  IF EXISTS (
    SELECT 1 FROM public.stock_count_sessions
    WHERE company_id = v_company
      AND reverse_client_operation_id = v_op
      AND id IS DISTINCT FROM p_session_id
  ) THEN
    RAISE EXCEPTION 'STOCK_COUNT_DUPLICATE_OPERATION';
  END IF;

  v_notes := 'Reverse stock count '
    || COALESCE(v_session.document_no, p_session_id::text)
    || ' (as of ' || COALESCE(v_session.as_of_date::text, '—') || ')'
    || CASE WHEN NULLIF(trim(p_reason), '') IS NULL THEN '' ELSE ': ' || trim(p_reason) END;

  FOR v_line IN
    SELECT * FROM public.stock_count_lines
    WHERE session_id = p_session_id
      AND stock_movement_id IS NOT NULL
    FOR UPDATE
  LOOP
    SELECT id INTO v_rev_id
    FROM public.stock_movements
    WHERE reference_type = 'stock_count_reversal'
      AND reference_id = v_line.id
    LIMIT 1;

    IF v_rev_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT * INTO v_orig
    FROM public.stock_movements
    WHERE id = v_line.stock_movement_id
    LIMIT 1;
    IF NOT FOUND THEN
      SELECT * INTO v_orig
      FROM public.stock_movements
      WHERE reference_type = 'stock_count' AND reference_id = v_line.id
      LIMIT 1;
    END IF;
    IF NOT FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.stock_movements (
      company_id, branch_id, product_id, variation_id,
      movement_type, quantity, unit_cost, total_cost,
      reference_type, reference_id, notes, created_by, created_at
    ) VALUES (
      v_company,
      v_orig.branch_id,
      v_orig.product_id,
      v_orig.variation_id,
      'adjustment',
      -v_orig.quantity,
      v_orig.unit_cost,
      ROUND(ABS(v_orig.quantity) * COALESCE(v_orig.unit_cost, 0), 2),
      'stock_count_reversal',
      v_line.id,
      v_notes,
      auth.uid(),
      now()
    );

    v_reversed := v_reversed + 1;
  END LOOP;

  UPDATE public.stock_count_sessions
  SET status = 'reversed',
      reversed_at = now(),
      reversed_by = auth.uid(),
      reverse_reason = NULLIF(trim(p_reason), ''),
      reverse_client_operation_id = v_op,
      notes = CASE
        WHEN NULLIF(trim(p_reason), '') IS NULL THEN notes
        ELSE COALESCE(notes || E'\n', '') || 'Reversed: ' || trim(p_reason)
      END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'session', to_jsonb(v_session),
    'reversed_movements', v_reversed,
    'skipped', v_skipped,
    'document_no', v_session.document_no,
    'idempotent', false
  );
END;
$$;

COMMENT ON FUNCTION public.reverse_stock_count_session(uuid, text, uuid) IS
  'Posted-only reverse: opposite stock_movements (stock_count_reversal) + GL via adj trigger. Keeps STK document_no.';

GRANT EXECUTE ON FUNCTION public.cancel_stock_count_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_stock_count_session(uuid, text, uuid) TO authenticated;
