-- Sale stock posting: SECURITY DEFINER RPC + RLS for salesman sale OUT movements.
-- Fixes mobile 403 on direct stock_movements INSERT (salesman lacks inventory.adjust).

-- ----------------------------------------------------------------------------
-- has_branch_access: support auth.users.id OR legacy public.users.id in user_branches
-- (skip if not function owner — existing definition may already work)
-- ----------------------------------------------------------------------------
DO $outer$
BEGIN
  CREATE OR REPLACE FUNCTION public.has_branch_access(branch_uuid uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
  AS $fn$
    SELECT EXISTS (
      SELECT 1
      FROM public.user_branches ub
      WHERE ub.branch_id = branch_uuid
        AND (
          ub.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = ub.user_id
              AND u.auth_user_id = auth.uid()
          )
        )
    );
  $fn$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping has_branch_access replace: %', SQLERRM;
END $outer$;

-- ----------------------------------------------------------------------------
-- ensure_sale_stock_movements: idempotent OUT rows after sales_items exist
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_sale_stock_movements(p_sale_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale           public.sales%ROWTYPE;
  v_item           RECORD;
  v_count          int;
  v_qty            numeric;
  v_unit_price     numeric;
  v_box_out        numeric;
  v_piece_out      numeric;
  v_inserted       int := 0;
  v_has_packing    boolean;
  v_has_box_col    boolean;
  v_has_piece_col  boolean;
  v_has_created_by boolean;
  v_notes          text;
  v_company        uuid;
BEGIN
  IF p_sale_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sale id required.', 'movements_inserted', 0);
  END IF;

  v_company := get_user_company_id();
  IF v_company IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated or no company.', 'movements_inserted', 0);
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sale not found.', 'movements_inserted', 0);
  END IF;

  IF v_sale.company_id IS DISTINCT FROM v_company THEN
    RETURN json_build_object('success', false, 'error', 'Sale belongs to another company.', 'movements_inserted', 0);
  END IF;

  IF lower(trim(coalesce(v_sale.status::text, ''))) IS DISTINCT FROM 'final' THEN
    RETURN json_build_object('success', false, 'error', 'Sale is not final; stock not posted.', 'movements_inserted', 0);
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.stock_movements
  WHERE reference_type = 'sale'
    AND reference_id = p_sale_id
    AND lower(trim(movement_type)) = 'sale';
  IF v_count > 0 THEN
    RETURN json_build_object('success', true, 'error', null, 'movements_inserted', 0, 'skipped', true);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_items' AND column_name = 'packing_details'
  ) INTO v_has_packing;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'box_change'
  ) INTO v_has_box_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'piece_change'
  ) INTO v_has_piece_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'created_by'
  ) INTO v_has_created_by;

  v_notes := 'Sale ' || coalesce(v_sale.invoice_no, p_sale_id::text);

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_items'
  ) THEN
    FOR v_item IN
      SELECT
        si.product_id,
        si.variation_id,
        si.quantity,
        si.unit_price,
        si.product_name,
        CASE WHEN v_has_packing THEN si.packing_details ELSE NULL END AS packing_details
      FROM public.sales_items si
      WHERE si.sale_id = p_sale_id
        AND si.product_id IS NOT NULL
        AND coalesce(si.quantity, 0) > 0
    LOOP
      v_qty := coalesce(v_item.quantity, 1)::numeric;
      v_unit_price := coalesce(v_item.unit_price, 0)::numeric;
      v_box_out := 0;
      v_piece_out := 0;
      IF v_item.packing_details IS NOT NULL AND jsonb_typeof(v_item.packing_details) = 'object' THEN
        IF v_item.packing_details ? 'total_boxes' AND v_item.packing_details->>'total_boxes' IS NOT NULL THEN
          v_box_out := round(coalesce((v_item.packing_details->>'total_boxes')::numeric, 0));
        END IF;
        IF v_item.packing_details ? 'total_pieces' AND v_item.packing_details->>'total_pieces' IS NOT NULL THEN
          v_piece_out := round(coalesce((v_item.packing_details->>'total_pieces')::numeric, 0));
        END IF;
      END IF;

      IF v_has_box_col AND v_has_piece_col AND v_has_created_by THEN
        INSERT INTO public.stock_movements (
          company_id, branch_id, product_id, variation_id,
          quantity, unit_cost, total_cost,
          movement_type, reference_type, reference_id,
          notes, created_by, box_change, piece_change, created_at
        ) VALUES (
          v_sale.company_id, v_sale.branch_id, v_item.product_id, v_item.variation_id,
          -v_qty, v_unit_price, -(v_unit_price * v_qty),
          'sale', 'sale', p_sale_id,
          v_notes || coalesce(' - ' || v_item.product_name, ''),
          auth.uid(), CASE WHEN v_box_out <> 0 THEN -v_box_out ELSE NULL END,
          CASE WHEN v_piece_out <> 0 THEN -v_piece_out ELSE NULL END, now()
        );
      ELSIF v_has_box_col AND v_has_piece_col THEN
        INSERT INTO public.stock_movements (
          company_id, branch_id, product_id, variation_id,
          quantity, unit_cost, total_cost,
          movement_type, reference_type, reference_id,
          notes, box_change, piece_change, created_at
        ) VALUES (
          v_sale.company_id, v_sale.branch_id, v_item.product_id, v_item.variation_id,
          -v_qty, v_unit_price, -(v_unit_price * v_qty),
          'sale', 'sale', p_sale_id,
          v_notes || coalesce(' - ' || v_item.product_name, ''),
          CASE WHEN v_box_out <> 0 THEN -v_box_out ELSE NULL END,
          CASE WHEN v_piece_out <> 0 THEN -v_piece_out ELSE NULL END, now()
        );
      ELSIF v_has_created_by THEN
        INSERT INTO public.stock_movements (
          company_id, branch_id, product_id, variation_id,
          quantity, unit_cost, total_cost,
          movement_type, reference_type, reference_id,
          notes, created_by, created_at
        ) VALUES (
          v_sale.company_id, v_sale.branch_id, v_item.product_id, v_item.variation_id,
          -v_qty, v_unit_price, -(v_unit_price * v_qty),
          'sale', 'sale', p_sale_id,
          v_notes || coalesce(' - ' || v_item.product_name, ''),
          auth.uid(), now()
        );
      ELSE
        INSERT INTO public.stock_movements (
          company_id, branch_id, product_id, variation_id,
          quantity, unit_cost, total_cost,
          movement_type, reference_type, reference_id,
          notes, created_at
        ) VALUES (
          v_sale.company_id, v_sale.branch_id, v_item.product_id, v_item.variation_id,
          -v_qty, v_unit_price, -(v_unit_price * v_qty),
          'sale', 'sale', p_sale_id,
          v_notes || coalesce(' - ' || v_item.product_name, ''), now()
        );
      END IF;
      v_inserted := v_inserted + 1;
    END LOOP;

    IF v_inserted > 0 OR NOT EXISTS (
      SELECT 1 FROM public.sales_items
      WHERE sale_id = p_sale_id AND product_id IS NOT NULL AND coalesce(quantity, 0) > 0
    ) THEN
      RETURN json_build_object('success', true, 'error', null, 'movements_inserted', v_inserted);
    END IF;
  END IF;

  -- Fallback: legacy sale_items
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sale_items'
  ) THEN
    FOR v_item IN
      SELECT product_id, variation_id, quantity, price AS unit_price
      FROM public.sale_items
      WHERE sale_id = p_sale_id
        AND product_id IS NOT NULL
        AND coalesce(quantity, 0) > 0
    LOOP
      v_qty := coalesce(v_item.quantity, 1)::numeric;
      v_unit_price := coalesce(v_item.unit_price, 0)::numeric;
      INSERT INTO public.stock_movements (
        company_id, branch_id, product_id, variation_id,
        quantity, unit_cost, total_cost,
        movement_type, reference_type, reference_id,
        notes, created_at
      ) VALUES (
        v_sale.company_id, v_sale.branch_id, v_item.product_id, v_item.variation_id,
        -v_qty, v_unit_price, -(v_unit_price * v_qty),
        'sale', 'sale', p_sale_id,
        v_notes, now()
      );
      v_inserted := v_inserted + 1;
    END LOOP;
  END IF;

  RETURN json_build_object('success', true, 'error', null, 'movements_inserted', v_inserted);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'movements_inserted', v_inserted
  );
END;
$$;

COMMENT ON FUNCTION public.ensure_sale_stock_movements(uuid) IS
  'Idempotent: insert stock OUT movements for a final sale from sales_items. SECURITY DEFINER; company-scoped.';

GRANT EXECUTE ON FUNCTION public.ensure_sale_stock_movements(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- RLS: allow sales staff to INSERT sale-type movements on assigned branches
-- ----------------------------------------------------------------------------
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_insert_sale_posting" ON public.stock_movements;

CREATE POLICY "stock_movements_insert_sale_posting"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (branch_id IS NULL OR has_branch_access(branch_id))
    AND lower(trim(coalesce(reference_type, ''))) = 'sale'
    AND lower(trim(coalesce(movement_type, ''))) IN ('sale', 'sale_cancelled')
    AND (
      is_owner_or_admin()
      OR has_permission('sales', 'create')
      OR has_permission('sales', 'edit')
    )
  );

COMMENT ON POLICY "stock_movements_insert_sale_posting" ON public.stock_movements IS
  'Sales staff with branch access can post sale OUT / sale_cancelled movements (web sync path).';
