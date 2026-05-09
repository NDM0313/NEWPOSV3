-- ============================================================================
-- create_rental_booking: cast rentals.status to public.rental_status (enum).
-- Fixes: column "status" is of type rental_status but expression is of type text
-- Apply after 20260513120000_global_document_numbering_rpcs.sql if already run.
-- ============================================================================

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
      v_booking := public.generate_document_number(p_company_id, v_sentinel, 'rental', false);

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
'Creates rental + rental_items with bulletproof booking_no allocation (matches payment RPC retry pattern).';

NOTIFY pgrst, 'reload schema';
