-- Soft-cancel bespoke work order: reverse stock + void production JE + status cancelled.
-- Additive only. Does not DROP/ALTER existing tables.

SET search_path = public;

CREATE OR REPLACE FUNCTION public.cancel_bespoke_work_order(
  p_work_order_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wo RECORD;
  v_cancel jsonb;
  v_reversed int := 0;
  v_note text;
BEGIN
  IF p_work_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_id required');
  END IF;

  SELECT w.* INTO v_wo FROM public.bespoke_work_orders w WHERE w.id = p_work_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.company_id = v_wo.company_id
      AND (u.id = auth.uid() OR u.auth_user_id = auth.uid())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  IF v_wo.status = 'cancelled'::public.bespoke_work_order_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order is already cancelled');
  END IF;

  -- Reverse fabric / parent stock movements (idempotent).
  v_cancel := public.cancel_bespoke_work_order_stock(p_work_order_id, p_user_id);
  IF COALESCE((v_cancel->>'success')::boolean, false) = false THEN
    RETURN v_cancel;
  END IF;
  v_reversed := COALESCE((v_cancel->>'stock_movements_reversed')::int, 0);

  -- Void production JE if present (same pattern as reopen).
  IF v_wo.journal_entry_id IS NOT NULL THEN
    UPDATE public.journal_entries
       SET is_void = true,
           void_reason = 'Bespoke WO cancelled',
           voided_at = now(),
           voided_by = p_user_id
     WHERE id = v_wo.journal_entry_id
       AND COALESCE(is_void, false) = false;
  END IF;

  v_note := COALESCE(NULLIF(trim(v_wo.notes), ''), '');
  IF p_reason IS NOT NULL AND length(trim(p_reason)) > 0 THEN
    IF length(v_note) > 0 THEN
      v_note := v_note || E'\n';
    END IF;
    v_note := v_note || 'Cancelled: ' || trim(p_reason);
  END IF;

  UPDATE public.bespoke_work_orders
     SET status = 'cancelled'::public.bespoke_work_order_status,
         completed_at = NULL,
         journal_entry_id = NULL,
         notes = NULLIF(v_note, ''),
         updated_at = now()
   WHERE id = p_work_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', p_work_order_id,
    'stock_movements_reversed', v_reversed,
    'cancelled', true
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.cancel_bespoke_work_order(uuid, uuid, text) IS
  'Soft-cancel WO: reverse stock, void production JE, set status=cancelled. Unique active WO per sale line excludes cancelled.';

GRANT EXECUTE ON FUNCTION public.cancel_bespoke_work_order(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_bespoke_work_order(uuid, uuid, text) TO service_role;
