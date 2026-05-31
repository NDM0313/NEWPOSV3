-- Bespoke work orders: allow sales_items replace (delete+re-insert) without FK 23503.
-- Anchor parent product on WO; relink parent_sales_item_id after line sync.

SET search_path = public;

ALTER TABLE public.bespoke_work_orders
  ADD COLUMN IF NOT EXISTS parent_product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_variation_id uuid NULL REFERENCES public.product_variations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bespoke_work_orders.parent_product_id IS
  'Stable anchor for relinking parent_sales_item_id after sale line replace';
COMMENT ON COLUMN public.bespoke_work_orders.parent_variation_id IS
  'Variation anchor when parent bespoke line has a variation';

-- Backfill anchors from current parent lines
UPDATE public.bespoke_work_orders wo
   SET parent_product_id = si.product_id,
       parent_variation_id = si.variation_id
  FROM public.sales_items si
 WHERE wo.parent_sales_item_id = si.id
   AND wo.parent_product_id IS NULL;

-- Relax FK: parent line may be replaced on sale edit
ALTER TABLE public.bespoke_work_orders
  DROP CONSTRAINT IF EXISTS bespoke_work_orders_parent_sales_item_id_fkey;

ALTER TABLE public.bespoke_work_orders
  ALTER COLUMN parent_sales_item_id DROP NOT NULL;

ALTER TABLE public.bespoke_work_orders
  ADD CONSTRAINT bespoke_work_orders_parent_sales_item_id_fkey
  FOREIGN KEY (parent_sales_item_id) REFERENCES public.sales_items(id) ON DELETE SET NULL;

-- Snapshot anchors from linked parent lines before item delete
CREATE OR REPLACE FUNCTION public.snapshot_bespoke_work_order_anchors(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_sale_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.bespoke_work_orders wo
     SET parent_product_id = si.product_id,
         parent_variation_id = si.variation_id
    FROM public.sales_items si
   WHERE wo.sale_id = p_sale_id
     AND wo.parent_sales_item_id = si.id;
END;
$$;

-- Relink WOs whose parent_sales_item_id was nulled by ON DELETE SET NULL
CREATE OR REPLACE FUNCTION public.relink_bespoke_work_orders_for_sale(p_sale_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wo RECORD;
  v_new_parent uuid;
  v_relinked int := 0;
  v_null_uuid uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF p_sale_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_wo IN
    SELECT id, parent_product_id, parent_variation_id
    FROM public.bespoke_work_orders
    WHERE sale_id = p_sale_id
      AND parent_sales_item_id IS NULL
      AND parent_product_id IS NOT NULL
    ORDER BY created_at ASC, id ASC
  LOOP
    SELECT si.id INTO v_new_parent
    FROM public.sales_items si
    WHERE si.sale_id = p_sale_id
      AND si.bespoke_parent_item_id IS NULL
      AND si.product_id = v_wo.parent_product_id
      AND COALESCE(si.variation_id, v_null_uuid) = COALESCE(v_wo.parent_variation_id, v_null_uuid)
      AND si.id NOT IN (
        SELECT parent_sales_item_id
        FROM public.bespoke_work_orders
        WHERE sale_id = p_sale_id
          AND parent_sales_item_id IS NOT NULL
          AND id <> v_wo.id
      )
    ORDER BY si.created_at ASC NULLS LAST, si.id ASC
    LIMIT 1;

    IF v_new_parent IS NOT NULL THEN
      UPDATE public.bespoke_work_orders
         SET parent_sales_item_id = v_new_parent,
             updated_at = now()
       WHERE id = v_wo.id;
      v_relinked := v_relinked + 1;
    END IF;
  END LOOP;

  RETURN v_relinked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_bespoke_work_order_anchors(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.relink_bespoke_work_orders_for_sale(uuid) TO authenticated, service_role;

-- update_sale_with_items: snapshot → delete lines → insert → relink
DROP FUNCTION IF EXISTS public.update_sale_with_items(UUID, UUID, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.update_sale_with_items(UUID, JSONB, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.update_sale_with_items(UUID, JSONB, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION public.update_sale_with_items(
    p_sale_id            UUID,
    p_items              JSONB,
    p_user_id            UUID DEFAULT NULL,
    p_discount_amount    NUMERIC DEFAULT 0,
    p_tax_amount         NUMERIC DEFAULT 0,
    p_shipment_charges   NUMERIC DEFAULT 0,
    p_extra_expenses     NUMERIC DEFAULT 0,
    p_notes              TEXT DEFAULT NULL,
    p_customer_name      TEXT DEFAULT NULL,
    p_contact_number     TEXT DEFAULT NULL,
    p_payment_method     TEXT DEFAULT NULL,
    p_invoice_date       DATE DEFAULT NULL,
    p_deadline           DATE DEFAULT NULL,
    p_customer_id        UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sale           RECORD;
    v_tbl            TEXT;
    v_line_sum       NUMERIC(15,2) := 0;
    v_total          NUMERIC(15,2);
    v_due            NUMERIC(15,2);
    v_elem           JSONB;
    v_pid            UUID;
    v_vid            UUID;
    v_qty            NUMERIC;
    v_up             NUMERIC;
    v_disc           NUMERIC;
    v_taxl           NUMERIC;
    v_ltot           NUMERIC;
    v_name           TEXT;
    v_sku            TEXT;
    v_custom         JSONB;
    v_sale_items_has_custom BOOLEAN := false;
    v_legacy_items_has_custom BOOLEAN := false;
    v_has_bespoke_parent BOOLEAN := false;
    v_inserted_ids   UUID[] := '{}';
    v_ord            INT;
    v_parent_idx     INT;
    v_bespoke_parent UUID;
    v_new_id         UUID;
    v_relinked       INT;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'p_items must be a non-empty JSON array');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'sales_items' AND column_name = 'customization_details'
    ) INTO v_sale_items_has_custom;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'customization_details'
    ) INTO v_legacy_items_has_custom;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'sales_items' AND column_name = 'bespoke_parent_item_id'
    ) INTO v_has_bespoke_parent;

    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
    IF v_sale.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.company_id = v_sale.company_id
           AND (u.id = auth.uid() OR u.auth_user_id = auth.uid())
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;

    IF v_sale.status = 'cancelled'::public.sale_status THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot edit cancelled sale');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.sale_returns r
         WHERE r.original_sale_id = p_sale_id AND COALESCE(r.status::text, '') = 'final'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot edit sale with a finalized return');
    END IF;

    IF to_regclass('public.sales_items') IS NOT NULL THEN
        v_tbl := 'sales_items';
    ELSIF to_regclass('public.sale_items') IS NOT NULL THEN
        v_tbl := 'sale_items';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'No sales_items / sale_items table');
    END IF;

    PERFORM public.snapshot_bespoke_work_order_anchors(p_sale_id);

    EXECUTE format('DELETE FROM %I WHERE sale_id = $1', v_tbl) USING p_sale_id;

    v_inserted_ids := ARRAY[]::UUID[];

    FOR v_elem, v_ord IN
        SELECT elem, ord::int
        FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(elem, ord)
    LOOP
        v_pid := NULLIF(trim(both '"' FROM v_elem->>'product_id'), '')::uuid;
        IF v_pid IS NULL THEN
            v_inserted_ids := array_append(v_inserted_ids, NULL::uuid);
            CONTINUE;
        END IF;
        v_vid := NULLIF(trim(both '"' FROM v_elem->>'variation_id'), '')::uuid;
        v_qty := COALESCE(NULLIF(v_elem->>'quantity', '')::numeric, 0);
        v_up := COALESCE(NULLIF(v_elem->>'unit_price', '')::numeric, 0);
        v_disc := COALESCE(NULLIF(v_elem->>'discount_amount', '')::numeric, 0);
        v_taxl := COALESCE(NULLIF(v_elem->>'tax_amount', '')::numeric, 0);
        v_ltot := COALESCE(NULLIF(v_elem->>'total', '')::numeric, GREATEST(0, v_qty * v_up - v_disc + v_taxl));
        v_name := COALESCE(NULLIF(v_elem->>'product_name', ''), 'Item');
        v_sku := COALESCE(NULLIF(v_elem->>'sku', ''), '—');
        v_custom := COALESCE(v_elem->'customization_details', v_elem->'customizationDetails');
        IF v_custom IS NOT NULL AND jsonb_typeof(v_custom) = 'null' THEN
            v_custom := NULL;
        END IF;

        v_bespoke_parent := NULLIF(trim(both '"' FROM COALESCE(v_elem->>'bespoke_parent_item_id', '')), '')::uuid;
        IF v_bespoke_parent IS NULL AND v_has_bespoke_parent THEN
            BEGIN
                v_parent_idx := (v_elem->>'parent_line_index')::int;
            EXCEPTION WHEN OTHERS THEN
                v_parent_idx := NULL;
            END;
            IF v_parent_idx IS NOT NULL AND v_parent_idx >= 0 AND v_parent_idx < cardinality(v_inserted_ids) THEN
                v_bespoke_parent := v_inserted_ids[v_parent_idx + 1];
            END IF;
        END IF;

        IF v_qty <= 0 THEN
            v_inserted_ids := array_append(v_inserted_ids, NULL::uuid);
            CONTINUE;
        END IF;

        v_new_id := NULL;

        IF v_tbl = 'sales_items' THEN
            IF v_sale_items_has_custom AND v_has_bespoke_parent THEN
                INSERT INTO public.sales_items (
                    sale_id, product_id, variation_id, product_name, sku, quantity, unit_price,
                    discount_amount, tax_amount, total, customization_details, bespoke_parent_item_id
                ) VALUES (
                    p_sale_id, v_pid, v_vid, v_name, v_sku, v_qty, v_up, v_disc, v_taxl, v_ltot, v_custom, v_bespoke_parent
                ) RETURNING id INTO v_new_id;
            ELSIF v_sale_items_has_custom THEN
                INSERT INTO public.sales_items (
                    sale_id, product_id, variation_id, product_name, sku, quantity, unit_price,
                    discount_amount, tax_amount, total, customization_details
                ) VALUES (
                    p_sale_id, v_pid, v_vid, v_name, v_sku, v_qty, v_up, v_disc, v_taxl, v_ltot, v_custom
                ) RETURNING id INTO v_new_id;
            ELSE
                INSERT INTO public.sales_items (
                    sale_id, product_id, variation_id, product_name, sku, quantity, unit_price,
                    discount_amount, tax_amount, total
                ) VALUES (
                    p_sale_id, v_pid, v_vid, v_name, v_sku, v_qty, v_up, v_disc, v_taxl, v_ltot
                ) RETURNING id INTO v_new_id;
            END IF;
        ELSE
            IF v_legacy_items_has_custom THEN
                INSERT INTO public.sale_items (
                    sale_id, product_id, variation_id, product_name, sku, quantity, unit_price, total, customization_details
                ) VALUES (
                    p_sale_id, v_pid, v_vid, v_name, v_sku, v_qty, v_up, v_ltot, v_custom
                ) RETURNING id INTO v_new_id;
            ELSE
                INSERT INTO public.sale_items (
                    sale_id, product_id, variation_id, product_name, sku, quantity, unit_price, total
                ) VALUES (
                    p_sale_id, v_pid, v_vid, v_name, v_sku, v_qty, v_up, v_ltot
                ) RETURNING id INTO v_new_id;
            END IF;
        END IF;

        v_inserted_ids := array_append(v_inserted_ids, v_new_id);
        v_line_sum := v_line_sum + v_ltot;
    END LOOP;

    IF v_line_sum <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No valid line items after edit');
    END IF;

    v_relinked := public.relink_bespoke_work_orders_for_sale(p_sale_id);

    EXECUTE format('SELECT COALESCE(SUM(total),0) FROM %I WHERE sale_id = $1', v_tbl) INTO v_line_sum USING p_sale_id;

    v_total := v_line_sum
             - COALESCE(p_discount_amount, 0)
             + COALESCE(p_tax_amount, 0)
             + COALESCE(p_shipment_charges, 0)
             + COALESCE(p_extra_expenses, 0)
             + COALESCE(v_sale.studio_charges, 0);
    IF v_total < 0 THEN
        v_total := 0;
    END IF;
    IF v_total + 0.005 < COALESCE(v_sale.paid_amount, 0) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',
            'New invoice total cannot be less than amount already received. Reduce line discounts or increase prices.'
        );
    END IF;
    v_due := GREATEST(0, v_total - COALESCE(v_sale.paid_amount, 0));

    UPDATE public.sales
       SET subtotal          = v_line_sum,
           discount_amount   = COALESCE(p_discount_amount, 0),
           tax_amount        = COALESCE(p_tax_amount, 0),
           shipment_charges  = COALESCE(p_shipment_charges, 0),
           extra_expenses    = COALESCE(p_extra_expenses, 0),
           total             = v_total,
           due_amount        = v_due,
           notes               = COALESCE(p_notes, notes),
           customer_name       = COALESCE(NULLIF(trim(p_customer_name), ''), customer_name),
           customer_id         = COALESCE(p_customer_id, customer_id),
           contact_number      = COALESCE(p_contact_number, contact_number),
           payment_method      = COALESCE(NULLIF(trim(p_payment_method), ''), payment_method),
           invoice_date        = CASE WHEN p_invoice_date IS NOT NULL THEN p_invoice_date::timestamptz ELSE invoice_date END,
           deadline            = CASE WHEN p_deadline IS NOT NULL THEN p_deadline ELSE deadline END,
           updated_at          = NOW()
     WHERE id = p_sale_id;

    DELETE FROM public.stock_movements
     WHERE reference_type = 'sale'
       AND reference_id   = p_sale_id
       AND COALESCE(movement_type, '') NOT ILIKE '%cancel%';

    INSERT INTO public.stock_movements (
        company_id, branch_id, product_id, variation_id,
        movement_type, quantity, unit_cost, total_cost,
        reference_type, reference_id, notes, created_by, created_at
    )
    SELECT
        v_sale.company_id,
        v_sale.branch_id,
        (e->>'product_id')::uuid,
        NULLIF(trim(both '"' FROM e->>'variation_id'), '')::uuid,
        'sale',
        -COALESCE((e->>'quantity')::numeric, 0),
        COALESCE((e->>'unit_price')::numeric, 0),
        -(COALESCE((e->>'unit_price')::numeric, 0) * COALESCE((e->>'quantity')::numeric, 0)),
        'sale',
        p_sale_id,
        'Sale line update',
        p_user_id,
        NOW()
    FROM jsonb_array_elements(p_items) e
    WHERE (e->>'product_id') IS NOT NULL
      AND COALESCE((e->>'quantity')::numeric, 0) > 0;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', p_sale_id,
        'subtotal', v_line_sum,
        'total', v_total,
        'bespoke_work_orders_relinked', v_relinked
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_sale_with_items(
    UUID, JSONB, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, DATE, DATE, UUID
) TO authenticated, service_role;
