-- Complete bespoke work order: Dr 5000 Cost of Production, Cr tailor AP sub-account

SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_bespoke_work_order(
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
  v_cost_account_id uuid;
  v_ap_account_id uuid;
  v_journal_id uuid;
  v_entry_no text;
  v_desc text;
BEGIN
  IF p_work_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_id required');
  END IF;

  SELECT w.*, s.invoice_no AS sale_invoice_no
  INTO v_wo
  FROM public.bespoke_work_orders w
  JOIN public.sales s ON s.id = w.sale_id
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

  IF v_wo.journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'journal_entry_id', v_wo.journal_entry_id);
  END IF;

  IF v_wo.status = 'cancelled'::public.bespoke_work_order_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order is cancelled');
  END IF;

  IF v_wo.status = 'completed'::public.bespoke_work_order_status THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  IF COALESCE(v_wo.production_cost, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Production cost must be greater than 0');
  END IF;

  IF v_wo.tailor_contact_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tailor supplier is required');
  END IF;

  SELECT id INTO v_cost_account_id
  FROM public.accounts
  WHERE company_id = v_wo.company_id AND trim(code) = '5000' AND COALESCE(is_active, true)
  LIMIT 1;

  v_ap_account_id := public._ensure_ap_subaccount_for_contact(v_wo.company_id, v_wo.tailor_contact_id);

  IF v_cost_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account 5000 (Cost of Production) not found');
  END IF;

  IF v_ap_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not resolve tailor payable account');
  END IF;

  v_entry_no := 'JE-BWO-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
  v_desc := 'Bespoke WO ' || COALESCE(v_wo.work_order_no, p_work_order_id::text)
         || COALESCE(' — Sale ' || v_wo.sale_invoice_no, '');

  INSERT INTO public.journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, total_debit, total_credit,
    is_posted, posted_at, is_manual, created_by
  ) VALUES (
    v_wo.company_id, v_wo.branch_id, v_entry_no, CURRENT_DATE, v_desc,
    'bespoke_work_order', p_work_order_id, v_wo.production_cost, v_wo.production_cost,
    true, now(), false, p_user_id
  )
  RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_journal_id, v_cost_account_id, v_wo.production_cost, 0, 'Bespoke production cost — ' || v_wo.work_order_no),
    (v_journal_id, v_ap_account_id, 0, v_wo.production_cost, 'Tailor payable — ' || v_wo.work_order_no);

  UPDATE public.bespoke_work_orders
     SET status = 'completed'::public.bespoke_work_order_status,
         completed_at = now(),
         journal_entry_id = v_journal_id,
         updated_at = now()
   WHERE id = p_work_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', p_work_order_id,
    'journal_entry_id', v_journal_id,
    'entry_no', v_entry_no
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_bespoke_work_order(uuid, uuid) TO authenticated, service_role;
