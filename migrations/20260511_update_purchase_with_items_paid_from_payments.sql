-- Align update_purchase_with_items paid/due checks with payment rows (mobile + web list parity).
-- Uses SUM(payments.amount) for non-void payments instead of purchases.paid_amount only.

CREATE OR REPLACE FUNCTION public.update_purchase_with_items(
    p_purchase_id        UUID,
    p_items              JSONB,
    p_user_id            UUID DEFAULT NULL,
    p_discount_amount    NUMERIC DEFAULT 0,
    p_tax_amount         NUMERIC DEFAULT 0,
    p_shipping_cost      NUMERIC DEFAULT 0,
    p_notes              TEXT DEFAULT NULL,
    p_supplier_name      TEXT DEFAULT NULL,
    p_contact_number     TEXT DEFAULT NULL,
    p_po_date            DATE DEFAULT NULL,
    p_supplier_id        UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po             RECORD;
    v_line_sum       NUMERIC(15,2) := 0;
    v_total          NUMERIC(15,2);
    v_due            NUMERIC(15,2);
    v_paid_applied   NUMERIC(15,2) := 0;
    v_elem           JSONB;
    v_pid            UUID;
    v_vid            UUID;
    v_qty            NUMERIC;
    v_up             NUMERIC;
    v_ltot           NUMERIC;
    v_name           TEXT;
    v_sku            TEXT;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'p_items must be a non-empty JSON array');
    END IF;

    SELECT * INTO v_po FROM public.purchases WHERE id = p_purchase_id;
    IF v_po.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Purchase not found');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.company_id = v_po.company_id
           AND (u.id = auth.uid() OR u.auth_user_id = auth.uid())
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;

    IF v_po.status = 'cancelled'::public.purchase_status THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot edit cancelled purchase');
    END IF;

    SELECT COALESCE(SUM(p.amount), 0) INTO v_paid_applied
    FROM public.payments p
    WHERE p.company_id = v_po.company_id
      AND p.reference_type = 'purchase'
      AND p.reference_id = p_purchase_id
      AND p.voided_at IS NULL;

    DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_pid := NULLIF(trim(both '"' FROM v_elem->>'product_id'), '')::uuid;
        IF v_pid IS NULL THEN
            CONTINUE;
        END IF;
        v_vid := NULLIF(trim(both '"' FROM v_elem->>'variation_id'), '')::uuid;
        v_qty := COALESCE(NULLIF(v_elem->>'quantity', '')::numeric, 0);
        v_up := COALESCE(NULLIF(v_elem->>'unit_price', '')::numeric, 0);
        v_ltot := COALESCE(NULLIF(v_elem->>'total', '')::numeric, GREATEST(0, v_qty * v_up));
        v_name := COALESCE(NULLIF(v_elem->>'product_name', ''), 'Item');
        v_sku := COALESCE(NULLIF(v_elem->>'sku', ''), '—');
        IF v_qty <= 0 THEN
            CONTINUE;
        END IF;
        INSERT INTO public.purchase_items (
            purchase_id, product_id, variation_id, product_name, sku, quantity, unit_price, total
        ) VALUES (
            p_purchase_id, v_pid, v_vid, v_name, v_sku, v_qty, v_up, v_ltot
        );
        v_line_sum := v_line_sum + v_ltot;
    END LOOP;

    SELECT COALESCE(SUM(total), 0) INTO v_line_sum FROM public.purchase_items WHERE purchase_id = p_purchase_id;
    IF v_line_sum <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No valid line items after edit');
    END IF;

    v_total := v_line_sum - COALESCE(p_discount_amount, 0) + COALESCE(p_tax_amount, 0) + COALESCE(p_shipping_cost, 0);
    IF v_total < 0 THEN
        v_total := 0;
    END IF;
    IF v_total + 0.005 < v_paid_applied THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',
            'New PO total cannot be less than amount already paid to supplier.'
        );
    END IF;
    v_due := GREATEST(0, v_total - v_paid_applied);

    UPDATE public.purchases
       SET subtotal         = v_line_sum,
           discount_amount  = COALESCE(p_discount_amount, 0),
           tax_amount       = COALESCE(p_tax_amount, 0),
           shipping_cost    = COALESCE(p_shipping_cost, 0),
           total            = v_total,
           paid_amount      = v_paid_applied,
           due_amount       = v_due,
           payment_status   = CASE
             WHEN v_paid_applied <= 0 THEN 'unpaid'::public.payment_status
             WHEN v_paid_applied >= v_total - 0.005 THEN 'paid'::public.payment_status
             ELSE 'partial'::public.payment_status
           END,
           notes              = COALESCE(p_notes, notes),
           supplier_name      = COALESCE(NULLIF(trim(p_supplier_name), ''), supplier_name),
           supplier_id        = COALESCE(p_supplier_id, supplier_id),
           contact_number     = COALESCE(p_contact_number, contact_number),
           po_date            = CASE WHEN p_po_date IS NOT NULL THEN p_po_date ELSE po_date END
     WHERE id = p_purchase_id;

    DELETE FROM public.stock_movements
     WHERE reference_type = 'purchase'
       AND reference_id   = p_purchase_id
       AND COALESCE(movement_type, '') NOT ILIKE '%cancel%';

    INSERT INTO public.stock_movements (
        company_id, branch_id, product_id, variation_id,
        movement_type, quantity, unit_cost, total_cost,
        reference_type, reference_id, notes, created_by, created_at
    )
    SELECT
        v_po.company_id,
        v_po.branch_id,
        x.product_id,
        x.variation_id,
        'purchase',
        x.quantity,
        x.unit_price,
        x.unit_price * x.quantity,
        'purchase',
        p_purchase_id,
        'Purchase line update',
        p_user_id,
        NOW()
    FROM (
        SELECT
            (e->>'product_id')::uuid AS product_id,
            NULLIF(trim(both '"' FROM e->>'variation_id'), '')::uuid AS variation_id,
            COALESCE((e->>'quantity')::numeric, 0) AS quantity,
            COALESCE((e->>'unit_price')::numeric, 0) AS unit_price
        FROM jsonb_array_elements(p_items) e
        WHERE (e->>'product_id') IS NOT NULL
          AND COALESCE((e->>'quantity')::numeric, 0) > 0
    ) x;

    RETURN jsonb_build_object('success', true, 'purchase_id', p_purchase_id, 'subtotal', v_line_sum, 'total', v_total);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_purchase_with_items(
    UUID, JSONB, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, DATE, UUID
) TO authenticated, service_role;
