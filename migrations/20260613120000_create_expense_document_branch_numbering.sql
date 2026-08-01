-- create_expense_document: use p_branch_id for generate_document_number so web/mobile
-- share the same erp_document_sequences bucket (branch_based rules respected).

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
  v_seq_branch UUID;
  v_cat TEXT;
BEGIN
  IF p_company_id IS NULL OR p_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'company_id and branch_id required');
  END IF;

  BEGIN
    SELECT c.seq_branch INTO v_seq_branch
    FROM public.erp_numbering_resolve_counter(p_company_id, 'EXPENSE', p_branch_id) c;
  EXCEPTION WHEN undefined_function THEN
    v_seq_branch := v_sentinel;
  END;
  IF v_seq_branch IS NULL THEN
    v_seq_branch := v_sentinel;
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
          AND branch_id = v_seq_branch
          AND document_type = 'EXPENSE'
          AND year = v_year;
      WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END LOOP;
END;
$ex$;

COMMENT ON FUNCTION public.create_expense_document(UUID, UUID, JSONB, UUID) IS
  'Creates expense with server-allocated expense_no via generate_document_number(company, branch, expense).';
