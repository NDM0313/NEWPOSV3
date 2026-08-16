-- ============================================================================
-- Rental booking_no: align duplicate-recovery sequence year/branch with
-- generate_document_number (year_reset=false → year=0; branch_based → branch row).
-- One-time heal: RENTAL last_number from max rentals.booking_no suffix.
-- Forward-only, additive. Pattern: 20260517120000_record_payment_seq_year_match...
-- ============================================================================

-- Resolve (seq_branch, seq_year) for a document type — mirrors generate_document_number.
CREATE OR REPLACE FUNCTION public.erp_numbering_resolve_counter(
  p_company_id UUID,
  p_document_type TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE(seq_branch UUID, seq_year INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $resolve$
DECLARE
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  v_current_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_doc_type TEXT := UPPER(TRIM(p_document_type));
  v_year_reset BOOLEAN := true;
  v_branch_based BOOLEAN := false;
BEGIN
  SELECT
    COALESCE(e.year_reset, true),
    COALESCE(e.branch_based, false)
  INTO v_year_reset, v_branch_based
  FROM public.erp_document_sequences e
  WHERE e.company_id = p_company_id
    AND e.branch_id = v_sentinel
    AND e.document_type = v_doc_type
    AND e.year = v_current_year
  LIMIT 1;

  seq_year := CASE WHEN v_year_reset THEN v_current_year ELSE 0 END;
  seq_branch := CASE
    WHEN v_branch_based AND p_branch_id IS NOT NULL THEN p_branch_id
    ELSE v_sentinel
  END;
  RETURN NEXT;
END;
$resolve$;

COMMENT ON FUNCTION public.erp_numbering_resolve_counter(UUID, TEXT, UUID) IS
  'Returns erp_document_sequences branch_id + year bucket used by generate_document_number for the given document type.';

-- ---------------------------------------------------------------------------
-- create_rental_booking — duplicate recovery uses same bucket as generator
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
  v_seq_branch UUID;
  v_seq_year INTEGER;
  it JSONB;
BEGIN
  IF p_company_id IS NULL OR p_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'company_id and branch_id required');
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_items must be a non-empty array');
  END IF;

  SELECT c.seq_branch, c.seq_year
  INTO v_seq_branch, v_seq_year
  FROM public.erp_numbering_resolve_counter(p_company_id, 'RENTAL', p_branch_id) c;

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
        PERFORM public._sync_erp_sequence_after_duplicate(p_company_id, 'RENTAL', v_seq_year);
        UPDATE public.erp_document_sequences
        SET last_number = last_number + 1, updated_at = now()
        WHERE company_id = p_company_id
          AND branch_id = v_seq_branch
          AND document_type = 'RENTAL'
          AND year = v_seq_year;
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
  'Creates rental + rental_items; booking_no via generate_document_number. Duplicate recovery uses erp_numbering_resolve_counter bucket.';

-- ---------------------------------------------------------------------------
-- One-time heal: align RENTAL counter rows with max booking_no per company
-- ---------------------------------------------------------------------------
DO $heal$
DECLARE
  co RECORD;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  v_current_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_max BIGINT;
  v_year_reset BOOLEAN;
  v_seq_year INTEGER;
  v_prefix TEXT;
  v_padding INTEGER;
BEGIN
  FOR co IN
    SELECT DISTINCT company_id FROM public.rentals WHERE booking_no IS NOT NULL AND TRIM(booking_no) <> ''
  LOOP
    SELECT COALESCE(MAX(CAST(SUBSTRING(booking_no FROM '([0-9]+)$') AS BIGINT)), 0)
    INTO v_max
    FROM public.rentals
    WHERE company_id = co.company_id
      AND booking_no ~ '([0-9]+)$'
      AND LENGTH(SUBSTRING(booking_no FROM '([0-9]+)$')) <= 9;

    IF v_max <= 0 THEN
      CONTINUE;
    END IF;

    SELECT
      COALESCE(e.year_reset, true),
      COALESCE(NULLIF(TRIM(e.prefix), ''), public.erp_document_default_prefix('rental')),
      LEAST(GREATEST(COALESCE(e.padding, 4), 4), 6)
    INTO v_year_reset, v_prefix, v_padding
    FROM public.erp_document_sequences e
    WHERE e.company_id = co.company_id
      AND e.branch_id = v_sentinel
      AND e.document_type = 'RENTAL'
      AND e.year = v_current_year
    LIMIT 1;

    IF v_prefix IS NULL THEN
      v_prefix := public.erp_document_default_prefix('rental');
      v_padding := 4;
      v_year_reset := true;
    END IF;

    v_seq_year := CASE WHEN v_year_reset THEN v_current_year ELSE 0 END;

    INSERT INTO public.erp_document_sequences (
      company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
    )
    VALUES (
      co.company_id, v_sentinel, 'RENTAL', v_prefix, v_seq_year, 0, v_padding, now()
    )
    ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;

    UPDATE public.erp_document_sequences e
    SET
      last_number = GREATEST(e.last_number, LEAST(v_max, 2147483647)::INTEGER),
      updated_at = now()
    WHERE e.company_id = co.company_id
      AND e.branch_id = v_sentinel
      AND e.document_type = 'RENTAL'
      AND e.year = v_seq_year;
  END LOOP;
END;
$heal$;

NOTIFY pgrst, 'reload schema';
