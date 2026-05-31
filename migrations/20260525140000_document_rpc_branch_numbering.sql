-- ============================================================================
-- Mobile / Web Settings parity: document-creation RPCs pass real p_branch_id
-- to generate_document_number so branch_based + include_branch_code rules apply.
-- Forward-only. Does not rewrite existing issued numbers.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) create_sale_document_header
-- ---------------------------------------------------------------------------
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
      v_doc := public.generate_document_number(p_company_id, p_branch_id, dt, false);

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

-- ---------------------------------------------------------------------------
-- 2) create_expense_document
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_expense_document(
  p_company_id UUID,
  p_branch_id UUID,
  p_expense JSONB,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ex$
DECLARE
  e JSONB := COALESCE(p_expense, '{}'::JSONB);
  v_id UUID;
  v_no TEXT;
  v_try INTEGER := 0;
  v_year INTEGER := EXTRACT(YEAR FROM COALESCE((e->>'expense_date')::DATE, CURRENT_DATE))::INTEGER;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  v_cat TEXT;
BEGIN
  IF p_company_id IS NULL OR p_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'company_id and branch_id required');
  END IF;

  LOOP
    v_try := v_try + 1;
    IF v_try > 500 THEN
      RETURN jsonb_build_object('success', false, 'error', 'expense_no allocation exhausted retries');
    END IF;

    BEGIN
      v_no := public.generate_document_number(p_company_id, p_branch_id, 'expense', false);

      v_cat := CASE
        WHEN COALESCE(NULLIF(TRIM(e->>'category'), ''), '') = ''
          OR LOWER(TRIM(e->>'category')) IN ('other', 'misc')
        THEN 'miscellaneous'
        ELSE LEFT(TRIM(COALESCE(e->>'category', '')), 100)
      END;

      INSERT INTO public.expenses (
        company_id,
        branch_id,
        expense_no,
        expense_date,
        category,
        description,
        amount,
        payment_method,
        payment_account_id,
        receipt_url,
        status,
        created_by
      )
      VALUES (
        p_company_id,
        p_branch_id,
        v_no,
        COALESCE((e->>'expense_date')::DATE, CURRENT_DATE),
        v_cat,
        COALESCE(NULLIF(TRIM(e->>'description'), ''), 'Expense'),
        COALESCE((e->>'amount')::NUMERIC, 0),
        COALESCE(NULLIF(LOWER(TRIM(e->>'payment_method')), ''), 'cash'),
        CASE WHEN e ? 'payment_account_id' AND NULLIF(TRIM(e->>'payment_account_id'), '') IS NOT NULL
          THEN (e->>'payment_account_id')::UUID ELSE NULL END,
        NULLIF(TRIM(e->>'receipt_url'), ''),
        (COALESCE(NULLIF(TRIM(e->>'status'), ''), 'paid'))::public.expense_status,
        p_created_by
      )
      RETURNING id INTO v_id;

      RETURN jsonb_build_object('success', true, 'expense_id', v_id, 'expense_no', v_no);

    EXCEPTION
      WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
      WHEN unique_violation THEN
        PERFORM public._sync_erp_sequence_after_duplicate(p_company_id, 'EXPENSE', v_year);
        UPDATE public.erp_document_sequences
        SET last_number = last_number + 1, updated_at = now()
        WHERE company_id = p_company_id
          AND branch_id = v_sentinel
          AND document_type = 'EXPENSE'
          AND year = v_year;
      WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END LOOP;
END;
$ex$;

-- ---------------------------------------------------------------------------
-- 3) create_purchase_document_header
-- ---------------------------------------------------------------------------
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
      v_no := public.generate_document_number(p_company_id, p_branch_id, 'purchase', false);

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

-- ---------------------------------------------------------------------------
-- 4) create_rental_booking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_rental_booking(
  p_company_id UUID,
  p_branch_id UUID,
  p_rental JSONB,
  p_items JSONB,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $rb$
DECLARE
  r JSONB := COALESCE(p_rental, '{}'::JSONB);
  v_id UUID;
  v_booking TEXT;
  v_try INTEGER := 0;
  v_year INTEGER := EXTRACT(YEAR FROM COALESCE((r->>'booking_date')::DATE, CURRENT_DATE))::INTEGER;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  it JSONB;
BEGIN
  IF p_company_id IS NULL OR p_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'company_id and branch_id required');
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_items must be a non-empty array');
  END IF;

  <<booking_alloc>>
  LOOP
    v_try := v_try + 1;
    IF v_try > 500 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Rental booking_no allocation exhausted retries');
    END IF;

    BEGIN
      v_booking := public.generate_document_number(p_company_id, p_branch_id, 'rental', false);

      INSERT INTO public.rentals (
        company_id,
        branch_id,
        booking_no,
        booking_date,
        customer_id,
        customer_name,
        status,
        pickup_date,
        return_date,
        duration_days,
        rental_charges,
        security_deposit,
        total_amount,
        paid_amount,
        due_amount,
        notes,
        created_by,
        salesman_id,
        commission_percent,
        commission_amount,
        commission_eligible_amount,
        commission_status,
        rental_expenses,
        security_document_type,
        security_document_number,
        security_document_image_url,
        security_status
      )
      VALUES (
        p_company_id,
        p_branch_id,
        v_booking,
        COALESCE((r->>'booking_date')::DATE, CURRENT_DATE),
        (r->>'customer_id')::UUID,
        COALESCE(NULLIF(TRIM(r->>'customer_name'), ''), 'Customer'),
        COALESCE(NULLIF(TRIM(r->>'status'), ''), 'booked')::public.rental_status,
        (r->>'pickup_date')::DATE,
        (r->>'return_date')::DATE,
        COALESCE((r->>'duration_days')::INTEGER, 1),
        COALESCE((r->>'rental_charges')::NUMERIC, 0),
        COALESCE((r->>'security_deposit')::NUMERIC, 0),
        COALESCE((r->>'total_amount')::NUMERIC, 0),
        COALESCE((r->>'paid_amount')::NUMERIC, 0),
        COALESCE((r->>'due_amount')::NUMERIC, 0),
        NULLIF(TRIM(r->>'notes'), ''),
        p_created_by,
        CASE WHEN r ? 'salesman_id' AND NULLIF(TRIM(r->>'salesman_id'), '') IS NOT NULL
          THEN (r->>'salesman_id')::UUID ELSE NULL END,
        CASE WHEN r ? 'commission_percent' THEN (r->>'commission_percent')::NUMERIC ELSE NULL END,
        CASE WHEN r ? 'commission_amount' THEN (r->>'commission_amount')::NUMERIC ELSE NULL END,
        CASE WHEN r ? 'commission_eligible_amount' THEN (r->>'commission_eligible_amount')::NUMERIC ELSE NULL END,
        NULLIF(TRIM(r->>'commission_status'), ''),
        CASE WHEN r ? 'rental_expenses' THEN r->'rental_expenses' ELSE NULL END,
        NULLIF(TRIM(r->>'security_document_type'), ''),
        NULLIF(TRIM(r->>'security_document_number'), ''),
        NULLIF(TRIM(r->>'security_document_image_url'), ''),
        NULLIF(TRIM(r->>'security_status'), '')
      )
      RETURNING id INTO v_id;

      EXIT booking_alloc;
    EXCEPTION
      WHEN unique_violation THEN
        PERFORM public._sync_erp_sequence_after_duplicate(p_company_id, 'RENTAL', v_year);
        UPDATE public.erp_document_sequences
        SET last_number = last_number + 1, updated_at = now()
        WHERE company_id = p_company_id
          AND branch_id = v_sentinel
          AND document_type = 'RENTAL'
          AND year = v_year;
      WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END LOOP;

  BEGIN
    FOR it IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.rental_items (
        rental_id,
        product_id,
        product_name,
        quantity,
        rate_per_day,
        duration_days,
        total,
        variation_id
      )
      VALUES (
        v_id,
        (it->>'product_id')::UUID,
        COALESCE(NULLIF(TRIM(it->>'product_name'), ''), 'Item'),
        COALESCE((it->>'quantity')::NUMERIC, 1),
        COALESCE((it->>'rate_per_day')::NUMERIC, 0),
        COALESCE((it->>'duration_days')::INTEGER, 1),
        COALESCE((it->>'total')::NUMERIC, 0),
        CASE WHEN it ? 'variation_id' AND NULLIF(TRIM(it->>'variation_id'), '') IS NOT NULL
          THEN (it->>'variation_id')::UUID ELSE NULL END
      );
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      DELETE FROM public.rentals WHERE id = v_id;
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'success', true,
    'rental_id', v_id,
    'booking_no', v_booking
  );
END;
$rb$;

COMMENT ON FUNCTION public.create_rental_booking(UUID, UUID, JSONB, JSONB, UUID) IS
'Creates rental + rental_items; booking_no respects Settings numbering (branch_based / include_branch_code).';

NOTIFY pgrst, 'reload schema';
