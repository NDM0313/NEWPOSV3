-- Fix: create_sale_document_header inserted JSONB text into sale_type / sale_status / payment_status enums.
-- Mobile createSale (partial/full payment Post) failed with:
--   column "type" is of type sale_type but expression is of type text

CREATE OR REPLACE FUNCTION public.create_sale_document_header(
  p_company_id UUID,
  p_branch_id UUID,
  p_is_studio BOOLEAN,
  p_sale JSONB,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sl$
DECLARE
  s JSONB := COALESCE(p_sale, '{}'::JSONB);
  v_id UUID;
  v_doc TEXT;
  v_try INTEGER := 0;
  v_year INTEGER;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  dt TEXT;
BEGIN
  IF p_company_id IS NULL OR p_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'company_id and branch_id required');
  END IF;

  v_year := EXTRACT(YEAR FROM COALESCE((s->>'invoice_date')::DATE, CURRENT_DATE))::INTEGER;

  dt := CASE WHEN COALESCE(p_is_studio, false) THEN 'studio' ELSE 'sale' END;

  LOOP
    v_try := v_try + 1;
    IF v_try > 500 THEN
      RETURN jsonb_build_object('success', false, 'error', 'sale document number allocation exhausted retries');
    END IF;

    BEGIN
      v_doc := public.generate_document_number(p_company_id, v_sentinel, dt, false);

      IF COALESCE(p_is_studio, false) THEN
        INSERT INTO public.sales (
          company_id,
          branch_id,
          invoice_no,
          order_no,
          invoice_date,
          customer_id,
          customer_name,
          contact_number,
          type,
          status,
          payment_status,
          payment_method,
          subtotal,
          discount_amount,
          tax_amount,
          expenses,
          total,
          paid_amount,
          due_amount,
          notes,
          deadline,
          is_studio,
          created_by
        )
        VALUES (
          p_company_id,
          p_branch_id,
          NULL,
          v_doc,
          COALESCE((s->>'invoice_date')::DATE, CURRENT_DATE),
          CASE WHEN s ? 'customer_id' AND NULLIF(TRIM(s->>'customer_id'), '') IS NOT NULL
            THEN (s->>'customer_id')::UUID ELSE NULL END,
          COALESCE(NULLIF(TRIM(s->>'customer_name'), ''), 'Walk-in'),
          NULLIF(TRIM(s->>'contact_number'), ''),
          (COALESCE(NULLIF(TRIM(s->>'type'), ''), 'quotation'))::public.sale_type,
          (COALESCE(NULLIF(TRIM(s->>'status'), ''), 'order'))::public.sale_status,
          (COALESCE(NULLIF(TRIM(s->>'payment_status'), ''), 'unpaid'))::public.payment_status,
          COALESCE(NULLIF(TRIM(s->>'payment_method'), ''), 'Credit'),
          COALESCE((s->>'subtotal')::NUMERIC, 0),
          COALESCE((s->>'discount_amount')::NUMERIC, 0),
          COALESCE((s->>'tax_amount')::NUMERIC, 0),
          COALESCE((s->>'expenses')::NUMERIC, 0),
          COALESCE((s->>'total')::NUMERIC, 0),
          COALESCE((s->>'paid_amount')::NUMERIC, 0),
          COALESCE((s->>'due_amount')::NUMERIC, 0),
          NULLIF(TRIM(s->>'notes'), ''),
          CASE WHEN s ? 'deadline' AND NULLIF(TRIM(s->>'deadline'), '') IS NOT NULL
            THEN (s->>'deadline')::DATE ELSE NULL END,
          true,
          p_created_by
        )
        RETURNING id INTO v_id;
      ELSE
        INSERT INTO public.sales (
          company_id,
          branch_id,
          invoice_no,
          invoice_date,
          customer_id,
          customer_name,
          contact_number,
          type,
          status,
          payment_status,
          payment_method,
          subtotal,
          discount_amount,
          tax_amount,
          expenses,
          total,
          paid_amount,
          due_amount,
          notes,
          is_studio,
          created_by
        )
        VALUES (
          p_company_id,
          p_branch_id,
          v_doc,
          COALESCE((s->>'invoice_date')::DATE, CURRENT_DATE),
          CASE WHEN s ? 'customer_id' AND NULLIF(TRIM(s->>'customer_id'), '') IS NOT NULL
            THEN (s->>'customer_id')::UUID ELSE NULL END,
          COALESCE(NULLIF(TRIM(s->>'customer_name'), ''), 'Walk-in'),
          NULLIF(TRIM(s->>'contact_number'), ''),
          (COALESCE(NULLIF(TRIM(s->>'type'), ''), 'invoice'))::public.sale_type,
          (COALESCE(NULLIF(TRIM(s->>'status'), ''), 'final'))::public.sale_status,
          (COALESCE(NULLIF(TRIM(s->>'payment_status'), ''), 'unpaid'))::public.payment_status,
          COALESCE(NULLIF(TRIM(s->>'payment_method'), ''), 'Cash'),
          COALESCE((s->>'subtotal')::NUMERIC, 0),
          COALESCE((s->>'discount_amount')::NUMERIC, 0),
          COALESCE((s->>'tax_amount')::NUMERIC, 0),
          COALESCE((s->>'expenses')::NUMERIC, 0),
          COALESCE((s->>'total')::NUMERIC, 0),
          COALESCE((s->>'paid_amount')::NUMERIC, 0),
          COALESCE((s->>'due_amount')::NUMERIC, 0),
          NULLIF(TRIM(s->>'notes'), ''),
          false,
          p_created_by
        )
        RETURNING id INTO v_id;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_id,
        'document_no', v_doc,
        'is_studio', COALESCE(p_is_studio, false)
      );

    EXCEPTION
      WHEN unique_violation THEN
        PERFORM public._sync_erp_sequence_after_duplicate(
          p_company_id,
          CASE WHEN COALESCE(p_is_studio, false) THEN 'STUDIO' ELSE 'SALE' END,
          v_year
        );
        UPDATE public.erp_document_sequences
        SET last_number = last_number + 1, updated_at = now()
        WHERE company_id = p_company_id
          AND branch_id = v_sentinel
          AND document_type = CASE WHEN COALESCE(p_is_studio, false) THEN 'STUDIO' ELSE 'SALE' END
          AND year = v_year;
      WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END LOOP;
END;
$sl$;

NOTIFY pgrst, 'reload schema';
