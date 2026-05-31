-- Bespoke WO complete: also post stock_movements on CUSTOM parent line (order qty OUT for ledger).
-- Fabric OUT unchanged. Parent products keep track_stock=false; movement is ledger visibility.

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
  v_fabric RECORD;
  v_elem jsonb;
  v_parent_custom jsonb;
  v_has_child_fabric boolean := false;
  v_pid uuid;
  v_vid uuid;
  v_qty numeric;
  v_name text;
  v_sku text;
  v_unit_cost numeric;
  v_stock_posted int := 0;
  v_null_uuid uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF p_work_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_id required');
  END IF;

  SELECT w.*, s.invoice_no AS sale_invoice_no, s.branch_id AS sale_branch_id
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

  IF v_wo.status = 'cancelled'::public.bespoke_work_order_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order is cancelled');
  END IF;

  IF v_wo.journal_entry_id IS NULL AND v_wo.status <> 'completed'::public.bespoke_work_order_status THEN
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
  ELSE
    v_journal_id := v_wo.journal_entry_id;
  END IF;

  FOR v_fabric IN
    SELECT
      si.product_id,
      si.variation_id,
      si.quantity,
      si.product_name,
      si.sku,
      si.unit_price
    FROM public.sales_items si
    WHERE si.sale_id = v_wo.sale_id
      AND si.bespoke_parent_item_id = v_wo.parent_sales_item_id
      AND COALESCE(si.quantity, 0) > 0
  LOOP
    v_has_child_fabric := true;
    v_pid := v_fabric.product_id;
    v_vid := v_fabric.variation_id;
    v_qty := COALESCE(v_fabric.quantity, 0)::numeric;
    v_name := COALESCE(v_fabric.product_name, v_fabric.sku, v_pid::text);
    v_unit_cost := COALESCE(v_fabric.unit_price, 0)::numeric;

    IF v_unit_cost <= 0 THEN
      SELECT COALESCE(p.cost_price, 0) INTO v_unit_cost FROM public.products p WHERE p.id = v_pid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.stock_movements sm
      WHERE sm.reference_type = 'bespoke_work_order'
        AND sm.reference_id = p_work_order_id
        AND sm.product_id = v_pid
        AND COALESCE(sm.variation_id, v_null_uuid) = COALESCE(v_vid, v_null_uuid)
    ) THEN
      INSERT INTO public.stock_movements (
        company_id, branch_id, product_id, variation_id,
        quantity, unit_cost, total_cost,
        movement_type, reference_type, reference_id,
        notes, created_by, created_at
      ) VALUES (
        v_wo.company_id,
        COALESCE(v_wo.branch_id, v_wo.sale_branch_id),
        v_pid, v_vid,
        -v_qty, v_unit_cost, -v_qty * v_unit_cost,
        'sale', 'bespoke_work_order', p_work_order_id,
        'Bespoke fabric OUT — ' || COALESCE(v_wo.work_order_no, p_work_order_id::text) || ' — ' || v_name,
        p_user_id, now()
      );
      v_stock_posted := v_stock_posted + 1;
    END IF;
  END LOOP;

  IF NOT v_has_child_fabric THEN
    SELECT si.customization_details INTO v_parent_custom
    FROM public.sales_items si
    WHERE si.id = v_wo.parent_sales_item_id;

    IF v_parent_custom IS NOT NULL
       AND v_parent_custom ? 'fabric_materials'
       AND jsonb_typeof(v_parent_custom->'fabric_materials') = 'array' THEN
      FOR v_elem IN SELECT * FROM jsonb_array_elements(v_parent_custom->'fabric_materials')
      LOOP
        v_pid := NULLIF(trim(both '"' FROM COALESCE(v_elem->>'product_id', '')), '')::uuid;
        v_qty := COALESCE((v_elem->>'quantity')::numeric, 0);
        IF v_pid IS NULL OR v_qty <= 0 THEN
          CONTINUE;
        END IF;
        v_vid := NULLIF(trim(both '"' FROM COALESCE(v_elem->>'variation_id', '')), '')::uuid;
        v_name := COALESCE(NULLIF(v_elem->>'product_name', ''), NULLIF(v_elem->>'sku', ''), v_pid::text);

        SELECT COALESCE(p.cost_price, 0) INTO v_unit_cost FROM public.products p WHERE p.id = v_pid;

        IF NOT EXISTS (
          SELECT 1 FROM public.stock_movements sm
          WHERE sm.reference_type = 'bespoke_work_order'
            AND sm.reference_id = p_work_order_id
            AND sm.product_id = v_pid
            AND COALESCE(sm.variation_id, v_null_uuid) = COALESCE(v_vid, v_null_uuid)
        ) THEN
          INSERT INTO public.stock_movements (
            company_id, branch_id, product_id, variation_id,
            quantity, unit_cost, total_cost,
            movement_type, reference_type, reference_id,
            notes, created_by, created_at
          ) VALUES (
            v_wo.company_id,
            COALESCE(v_wo.branch_id, v_wo.sale_branch_id),
            v_pid, v_vid,
            -v_qty, v_unit_cost, -v_qty * v_unit_cost,
            'sale', 'bespoke_work_order', p_work_order_id,
            'Bespoke fabric OUT — ' || COALESCE(v_wo.work_order_no, p_work_order_id::text) || ' — ' || v_name,
            p_user_id, now()
          );
          v_stock_posted := v_stock_posted + 1;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Parent custom-order line OUT (order qty on CUSTOM/generic SKU — ledger visibility)
  SELECT
    si.product_id,
    si.variation_id,
    si.quantity,
    si.product_name,
    si.sku,
    si.unit_price
  INTO v_pid, v_vid, v_qty, v_name, v_sku, v_unit_cost
  FROM public.sales_items si
  WHERE si.id = v_wo.parent_sales_item_id;

  IF v_pid IS NOT NULL AND COALESCE(v_qty, 0) > 0 THEN
    v_qty := COALESCE(v_qty, 0)::numeric;
    v_name := COALESCE(v_name, v_sku, v_pid::text);
    v_unit_cost := COALESCE(v_unit_cost, 0)::numeric;
    IF v_unit_cost <= 0 THEN
      SELECT COALESCE(p.cost_price, 0) INTO v_unit_cost FROM public.products p WHERE p.id = v_pid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.stock_movements sm
      WHERE sm.reference_type = 'bespoke_work_order'
        AND sm.reference_id = p_work_order_id
        AND sm.product_id = v_pid
        AND COALESCE(sm.variation_id, v_null_uuid) = COALESCE(v_vid, v_null_uuid)
        AND sm.notes LIKE 'Bespoke custom order OUT%'
    ) THEN
      INSERT INTO public.stock_movements (
        company_id, branch_id, product_id, variation_id,
        quantity, unit_cost, total_cost,
        movement_type, reference_type, reference_id,
        notes, created_by, created_at
      ) VALUES (
        v_wo.company_id,
        COALESCE(v_wo.branch_id, v_wo.sale_branch_id),
        v_pid, v_vid,
        -v_qty, v_unit_cost, -v_qty * v_unit_cost,
        'sale', 'bespoke_work_order', p_work_order_id,
        'Bespoke custom order OUT — ' || COALESCE(v_wo.work_order_no, p_work_order_id::text) || ' — ' || v_name,
        p_user_id, now()
      );
      v_stock_posted := v_stock_posted + 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', p_work_order_id,
    'journal_entry_id', v_journal_id,
    'entry_no', v_entry_no,
    'stock_movements_posted', v_stock_posted,
    'already_completed', (v_wo.journal_entry_id IS NOT NULL)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.complete_bespoke_work_order(uuid, uuid) IS
  'Complete bespoke WO: Dr 5000 / Cr tailor AP + idempotent fabric + parent custom-order stock OUT.';

GRANT EXECUTE ON FUNCTION public.complete_bespoke_work_order(uuid, uuid) TO authenticated, service_role;
