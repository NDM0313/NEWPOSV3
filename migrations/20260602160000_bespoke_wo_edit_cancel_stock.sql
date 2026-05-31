-- Bespoke WO edit: cancel stock post (offsetting movements), reopen (void JE + stock), status/dates on update.

SET search_path = public;

DROP FUNCTION IF EXISTS public.update_bespoke_work_order(uuid, uuid, numeric, text, uuid);

CREATE OR REPLACE FUNCTION public.cancel_bespoke_work_order_stock(
  p_work_order_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wo RECORD;
  v_mov RECORD;
  v_reversed int := 0;
  v_reversal_note text;
BEGIN
  IF p_work_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_id required');
  END IF;

  SELECT w.*
  INTO v_wo
  FROM public.bespoke_work_orders w
  WHERE w.id = p_work_order_id;

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
    RETURN jsonb_build_object('success', false, 'error', 'Work order is cancelled');
  END IF;

  FOR v_mov IN
    SELECT sm.*
    FROM public.stock_movements sm
    WHERE sm.reference_type = 'bespoke_work_order'
      AND sm.reference_id = p_work_order_id
      AND COALESCE(sm.notes, '') NOT LIKE 'Bespoke stock reversal%'
  LOOP
    v_reversal_note :=
      'Bespoke stock reversal — '
      || COALESCE(v_wo.work_order_no, p_work_order_id::text)
      || ' — '
      || COALESCE(v_mov.notes, '');

    IF EXISTS (
      SELECT 1 FROM public.stock_movements r
      WHERE r.reference_type = 'bespoke_work_order'
        AND r.reference_id = p_work_order_id
        AND r.notes = v_reversal_note
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.stock_movements (
      company_id, branch_id, product_id, variation_id,
      quantity, unit_cost, total_cost,
      movement_type, reference_type, reference_id,
      notes, created_by, created_at
    ) VALUES (
      v_mov.company_id,
      v_mov.branch_id,
      v_mov.product_id,
      v_mov.variation_id,
      -COALESCE(v_mov.quantity, 0),
      v_mov.unit_cost,
      -COALESCE(v_mov.total_cost, 0),
      COALESCE(v_mov.movement_type, 'sale'),
      'bespoke_work_order',
      p_work_order_id,
      v_reversal_note,
      p_user_id,
      now()
    );
    v_reversed := v_reversed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', p_work_order_id,
    'stock_movements_reversed', v_reversed
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.cancel_bespoke_work_order_stock(uuid, uuid) IS
  'Offset bespoke WO stock_movements (fabric + parent). Does not change WO status or journal.';

CREATE OR REPLACE FUNCTION public.reopen_bespoke_work_order(
  p_work_order_id uuid,
  p_new_status public.bespoke_work_order_status,
  p_user_id uuid DEFAULT NULL
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
BEGIN
  IF p_work_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_id required');
  END IF;

  IF p_new_status = 'completed'::public.bespoke_work_order_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use complete_bespoke_work_order to mark completed');
  END IF;

  IF p_new_status = 'cancelled'::public.bespoke_work_order_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use cancel flow for cancelled status');
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

  v_cancel := public.cancel_bespoke_work_order_stock(p_work_order_id, p_user_id);
  IF COALESCE((v_cancel->>'success')::boolean, false) = false THEN
    RETURN v_cancel;
  END IF;
  v_reversed := COALESCE((v_cancel->>'stock_movements_reversed')::int, 0);

  IF v_wo.journal_entry_id IS NOT NULL THEN
    UPDATE public.journal_entries
       SET is_void = true,
           void_reason = 'Bespoke WO reopened',
           voided_at = now(),
           voided_by = p_user_id
     WHERE id = v_wo.journal_entry_id
       AND COALESCE(is_void, false) = false;
  END IF;

  UPDATE public.bespoke_work_orders
     SET status = p_new_status,
         completed_at = NULL,
         journal_entry_id = NULL,
         updated_at = now()
   WHERE id = p_work_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', p_work_order_id,
    'stock_movements_reversed', v_reversed,
    'reopened', true
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.reopen_bespoke_work_order(uuid, public.bespoke_work_order_status, uuid) IS
  'Reopen completed WO: reverse stock + void production JE + set draft/in_progress.';

CREATE OR REPLACE FUNCTION public.update_bespoke_work_order(
  p_work_order_id uuid,
  p_tailor_contact_id uuid,
  p_production_cost numeric,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_created_at timestamptz DEFAULT NULL,
  p_completed_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wo RECORD;
  v_cost_account_id uuid;
  v_ap_account_id uuid;
  v_old_desc text;
  v_edit_note text;
  v_debit_line_id uuid;
  v_credit_line_id uuid;
  v_new_status public.bespoke_work_order_status;
  v_complete jsonb;
  v_reopen jsonb := NULL;
  v_journal_id uuid;
  v_transition_to_complete boolean := false;
BEGIN
  IF p_work_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_id required');
  END IF;

  IF p_tailor_contact_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tailor supplier is required');
  END IF;

  IF COALESCE(p_production_cost, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Production cost must be greater than 0');
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
    RETURN jsonb_build_object('success', false, 'error', 'Cancelled work orders cannot be edited');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = p_tailor_contact_id AND c.company_id = v_wo.company_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid worker or supplier contact');
  END IF;

  v_new_status := v_wo.status;
  IF p_status IS NOT NULL AND trim(p_status) <> '' THEN
    BEGIN
      v_new_status := trim(p_status)::public.bespoke_work_order_status;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
    END;
  END IF;

  IF v_new_status = 'cancelled'::public.bespoke_work_order_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot set status to cancelled via edit');
  END IF;

  v_transition_to_complete :=
    v_new_status = 'completed'::public.bespoke_work_order_status
    AND v_wo.status <> 'completed'::public.bespoke_work_order_status;

  -- Reopen: completed -> draft / in_progress
  IF v_wo.status = 'completed'::public.bespoke_work_order_status
     AND v_new_status <> 'completed'::public.bespoke_work_order_status THEN
    v_reopen := public.reopen_bespoke_work_order(p_work_order_id, v_new_status, p_user_id);
    IF COALESCE((v_reopen->>'success')::boolean, false) = false THEN
      RETURN v_reopen;
    END IF;
    SELECT w.* INTO v_wo FROM public.bespoke_work_orders w WHERE w.id = p_work_order_id;
    v_journal_id := NULL;
  ELSE
    v_journal_id := v_wo.journal_entry_id;
  END IF;

  UPDATE public.bespoke_work_orders
     SET tailor_contact_id = p_tailor_contact_id,
         production_cost = p_production_cost,
         notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
         status = CASE
           WHEN v_transition_to_complete THEN v_wo.status
           ELSE v_new_status
         END,
         created_at = COALESCE(p_created_at, created_at),
         completed_at = CASE
           WHEN v_new_status = 'completed'::public.bespoke_work_order_status
                AND NOT v_transition_to_complete
             THEN COALESCE(p_completed_at, completed_at)
           WHEN v_transition_to_complete THEN NULL
           ELSE NULL
         END,
         updated_at = now()
   WHERE id = p_work_order_id;

  -- Complete: not completed -> completed (RPC sets status + GL + stock)
  IF v_transition_to_complete THEN
    v_complete := public.complete_bespoke_work_order(p_work_order_id, p_user_id);
    IF COALESCE((v_complete->>'success')::boolean, false) = false THEN
      RETURN v_complete;
    END IF;
    v_journal_id := (v_complete->>'journal_entry_id')::uuid;
    IF p_completed_at IS NOT NULL THEN
      UPDATE public.bespoke_work_orders
         SET completed_at = p_completed_at
       WHERE id = p_work_order_id;
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'work_order_id', p_work_order_id,
      'journal_entry_id', v_journal_id,
      'stock_movements_posted', COALESCE((v_complete->>'stock_movements_posted')::int, 0),
      'completed', true
    );
  END IF;

  -- Patch linked JE when still completed with active journal
  IF v_journal_id IS NOT NULL THEN
    SELECT id INTO v_cost_account_id
    FROM public.accounts
    WHERE company_id = v_wo.company_id AND trim(code) = '5000' AND COALESCE(is_active, true)
    LIMIT 1;

    v_ap_account_id := public._ensure_ap_subaccount_for_contact(v_wo.company_id, p_tailor_contact_id);

    IF v_cost_account_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Account 5000 (Cost of Production) not found');
    END IF;

    IF v_ap_account_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Could not resolve tailor payable account');
    END IF;

    SELECT jel.id INTO v_debit_line_id
    FROM public.journal_entry_lines jel
    WHERE jel.journal_entry_id = v_journal_id
      AND COALESCE(jel.debit, 0) > 0
    ORDER BY jel.debit DESC
    LIMIT 1;

    SELECT jel.id INTO v_credit_line_id
    FROM public.journal_entry_lines jel
    WHERE jel.journal_entry_id = v_journal_id
      AND COALESCE(jel.credit, 0) > 0
    ORDER BY jel.credit DESC
    LIMIT 1;

    IF v_debit_line_id IS NOT NULL AND v_credit_line_id IS NOT NULL THEN
      UPDATE public.journal_entry_lines
         SET account_id = v_cost_account_id,
             debit = p_production_cost,
             credit = 0,
             description = 'Bespoke production cost — ' || v_wo.work_order_no
       WHERE id = v_debit_line_id;

      UPDATE public.journal_entry_lines
         SET account_id = v_ap_account_id,
             debit = 0,
             credit = p_production_cost,
             description = 'Tailor payable — ' || v_wo.work_order_no
       WHERE id = v_credit_line_id;

      SELECT description INTO v_old_desc
      FROM public.journal_entries
      WHERE id = v_journal_id;

      v_edit_note := ' [Edited ' || to_char(now(), 'YYYY-MM-DD HH24:MI')
                  || ': cost ' || COALESCE(v_wo.production_cost, 0)::text
                  || ' → ' || p_production_cost::text || ']';

      UPDATE public.journal_entries
         SET total_debit = p_production_cost,
             total_credit = p_production_cost,
             description = left(COALESCE(v_old_desc, '') || v_edit_note, 500),
             updated_at = now()
       WHERE id = v_journal_id
         AND COALESCE(is_void, false) = false;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', p_work_order_id,
    'journal_entry_id', v_journal_id,
    'reopened', COALESCE((v_reopen->>'reopened')::boolean, false)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.update_bespoke_work_order(uuid, uuid, numeric, text, uuid, text, timestamptz, timestamptz) IS
  'Update bespoke WO: tailor/cost/notes/status/dates; complete or reopen with stock+JE void.';

GRANT EXECUTE ON FUNCTION public.cancel_bespoke_work_order_stock(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_bespoke_work_order(uuid, public.bespoke_work_order_status, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_bespoke_work_order(uuid, uuid, numeric, text, uuid, text, timestamptz, timestamptz) TO authenticated, service_role;
