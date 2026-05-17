-- Idempotent: fix purchase_status / payment_status enum casts in create_purchase_document_header
-- (same body as migrations/20260513120000_global_document_numbering_rpcs.sql after enum fix)
CREATE OR REPLACE FUNCTION public.create_purchase_document_header(
  p_company_id UUID,
  p_branch_id UUID,
  p_purchase JSONB,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $pur$
DECLARE
  p JSONB := COALESCE(p_purchase, '{}'::JSONB);
  v_id UUID;
  v_no TEXT;
  st TEXT := LOWER(COALESCE(NULLIF(TRIM(p->>'status'), ''), 'ordered'));
  v_try INTEGER := 0;
  v_year INTEGER := EXTRACT(YEAR FROM COALESCE((p->>'po_date')::TIMESTAMPTZ::DATE, CURRENT_DATE))::INTEGER;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  v_po TEXT;
  v_order TEXT;
  v_draft TEXT;
BEGIN
  IF p_company_id IS NULL OR p_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'company_id and branch_id required');
  END IF;

  LOOP
    v_try := v_try + 1;
    IF v_try > 500 THEN
      RETURN jsonb_build_object('success', false, 'error', 'purchase document number allocation exhausted retries');
    END IF;

    BEGIN
      v_no := public.generate_document_number(p_company_id, v_sentinel, 'purchase', false);

      IF st = 'ordered' THEN
        v_po := NULL;
        v_order := v_no;
        v_draft := NULL;
      ELSIF st = 'draft' THEN
        v_po := NULL;
        v_order := NULL;
        v_draft := v_no;
      ELSE
        v_po := v_no;
        v_order := NULL;
        v_draft := NULL;
      END IF;

      INSERT INTO public.purchases (
        company_id,
        branch_id,
        po_no,
        order_no,
        draft_no,
        po_date,
        supplier_id,
        supplier_name,
        contact_number,
        status,
        payment_status,
        subtotal,
        discount_amount,
        tax_amount,
        shipping_cost,
        total,
        paid_amount,
        due_amount,
        notes,
        attachments,
        created_by
      )
      VALUES (
        p_company_id,
        p_branch_id,
        v_po,
        v_order,
        v_draft,
        COALESCE((p->>'po_date')::DATE, CURRENT_DATE),
        CASE WHEN p ? 'supplier_id' AND NULLIF(TRIM(p->>'supplier_id'), '') IS NOT NULL
          THEN (p->>'supplier_id')::UUID ELSE NULL END,
        COALESCE(NULLIF(TRIM(p->>'supplier_name'), ''), 'Unknown'),
        NULLIF(TRIM(p->>'contact_number'), ''),
        (st::public.purchase_status),
        (COALESCE(NULLIF(TRIM(p->>'payment_status'), ''), 'unpaid'))::public.payment_status,
        COALESCE((p->>'subtotal')::NUMERIC, 0),
        COALESCE((p->>'discount_amount')::NUMERIC, 0),
        COALESCE((p->>'tax_amount')::NUMERIC, 0),
        COALESCE((p->>'shipping_cost')::NUMERIC, 0),
        COALESCE((p->>'total')::NUMERIC, 0),
        COALESCE((p->>'paid_amount')::NUMERIC, 0),
        COALESCE((p->>'due_amount')::NUMERIC, 0),
        NULLIF(TRIM(p->>'notes'), ''),
        CASE WHEN p ? 'attachments' THEN p->'attachments' ELSE NULL END,
        p_created_by
      )
      RETURNING id INTO v_id;

      RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_id,
        'allocated_no', v_no,
        'po_no', v_po,
        'order_no', v_order,
        'draft_no', v_draft
      );

    EXCEPTION
      WHEN unique_violation THEN
        PERFORM public._sync_erp_sequence_after_duplicate(p_company_id, 'PURCHASE', v_year);
        UPDATE public.erp_document_sequences
        SET last_number = last_number + 1, updated_at = now()
        WHERE company_id = p_company_id
          AND branch_id = v_sentinel
          AND document_type = 'PURCHASE'
          AND year = v_year;
      WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END LOOP;
END;
$pur$;
