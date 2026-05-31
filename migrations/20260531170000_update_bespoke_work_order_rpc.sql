-- Update bespoke work order in place; patch linked journal entry when completed (no reversal JE)

SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_bespoke_work_order(
  p_work_order_id uuid,
  p_tailor_contact_id uuid,
  p_production_cost numeric,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
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
    RETURN jsonb_build_object('success', false, 'error', 'Cancelled work orders cannot be edited');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = p_tailor_contact_id AND c.company_id = v_wo.company_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid worker or supplier contact');
  END IF;

  UPDATE public.bespoke_work_orders
     SET tailor_contact_id = p_tailor_contact_id,
         production_cost = p_production_cost,
         notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
         updated_at = now()
   WHERE id = p_work_order_id;

  IF v_wo.journal_entry_id IS NOT NULL THEN
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
    WHERE jel.journal_entry_id = v_wo.journal_entry_id
      AND COALESCE(jel.debit, 0) > 0
    ORDER BY jel.debit DESC
    LIMIT 1;

    SELECT jel.id INTO v_credit_line_id
    FROM public.journal_entry_lines jel
    WHERE jel.journal_entry_id = v_wo.journal_entry_id
      AND COALESCE(jel.credit, 0) > 0
    ORDER BY jel.credit DESC
    LIMIT 1;

    IF v_debit_line_id IS NULL OR v_credit_line_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Journal entry lines not found for work order');
    END IF;

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
    WHERE id = v_wo.journal_entry_id;

    v_edit_note := ' [Edited ' || to_char(now(), 'YYYY-MM-DD HH24:MI')
                || ': cost ' || COALESCE(v_wo.production_cost, 0)::text
                || ' → ' || p_production_cost::text || ']';

    UPDATE public.journal_entries
       SET total_debit = p_production_cost,
           total_credit = p_production_cost,
           description = left(COALESCE(v_old_desc, '') || v_edit_note, 500),
           updated_at = now()
     WHERE id = v_wo.journal_entry_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', p_work_order_id,
    'journal_entry_id', v_wo.journal_entry_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_bespoke_work_order(uuid, uuid, numeric, text, uuid) TO authenticated, service_role;
