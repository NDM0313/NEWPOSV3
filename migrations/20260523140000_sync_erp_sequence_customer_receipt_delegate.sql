-- After RCV numbering: _sync_erp_sequence_after_duplicate must delegate CUSTOMER_RECEIPT
-- to _sync_customer_receipt_sequence_after_duplicate (same pattern as PAYMENT → _sync_payment).

CREATE OR REPLACE FUNCTION public._sync_erp_sequence_after_duplicate(
  p_company_id UUID,
  p_document_type TEXT,
  p_year INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sync2$
DECLARE
  v_max BIGINT := 0;
  v_a BIGINT;
  v_b BIGINT;
  v_c BIGINT;
  v_std_sale BIGINT := 0;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  v_doc_type TEXT := UPPER(TRIM(p_document_type));
BEGIN
  IF v_doc_type = 'PAYMENT' THEN
    PERFORM public._sync_payment_sequence_after_duplicate(p_company_id, p_year);
    RETURN;
  END IF;

  IF v_doc_type = 'CUSTOMER_RECEIPT' THEN
    PERFORM public._sync_customer_receipt_sequence_after_duplicate(p_company_id, p_year);
    RETURN;
  END IF;

  IF v_doc_type = 'SALE' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM '([0-9]+)$') AS BIGINT)), 0)
    INTO v_max
    FROM public.sales
    WHERE company_id = p_company_id
      AND invoice_no ~ '([0-9]+)$'
      AND LENGTH(SUBSTRING(invoice_no FROM '([0-9]+)$')) <= 9;

  ELSIF v_doc_type = 'PURCHASE' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(po_no FROM '([0-9]+)$') AS BIGINT)), 0) INTO v_a
    FROM public.purchases
    WHERE company_id = p_company_id AND po_no ~ '([0-9]+)$';
    BEGIN
      SELECT COALESCE(MAX(CAST(SUBSTRING(order_no FROM '([0-9]+)$') AS BIGINT)), 0) INTO v_b
      FROM public.purchases
      WHERE company_id = p_company_id AND order_no ~ '([0-9]+)$';
    EXCEPTION WHEN undefined_column THEN v_b := 0;
    END;
    BEGIN
      SELECT COALESCE(MAX(CAST(SUBSTRING(draft_no FROM '([0-9]+)$') AS BIGINT)), 0) INTO v_c
      FROM public.purchases
      WHERE company_id = p_company_id AND draft_no ~ '([0-9]+)$';
    EXCEPTION WHEN undefined_column THEN v_c := 0;
    END;
    v_max := GREATEST(COALESCE(v_a, 0), COALESCE(v_b, 0), COALESCE(v_c, 0));

  ELSIF v_doc_type = 'EXPENSE' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(expense_no FROM '([0-9]+)$') AS BIGINT)), 0)
    INTO v_max
    FROM public.expenses
    WHERE company_id = p_company_id
      AND expense_no ~ '([0-9]+)$'
      AND LENGTH(SUBSTRING(expense_no FROM '([0-9]+)$')) <= 9;

  ELSIF v_doc_type = 'RENTAL' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(booking_no FROM '([0-9]+)$') AS BIGINT)), 0)
    INTO v_max
    FROM public.rentals
    WHERE company_id = p_company_id
      AND booking_no ~ '([0-9]+)$'
      AND LENGTH(SUBSTRING(booking_no FROM '([0-9]+)$')) <= 9;

  ELSIF v_doc_type = 'STUDIO' THEN
    BEGIN
      SELECT COALESCE(MAX(CAST(SUBSTRING(production_no FROM '([0-9]+)$') AS BIGINT)), 0)
      INTO v_max
      FROM public.studio_productions
      WHERE company_id = p_company_id
        AND production_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(production_no FROM '([0-9]+)$')) <= 9;
    EXCEPTION WHEN undefined_table THEN
      v_max := 0;
    END;
    BEGIN
      SELECT COALESCE(MAX(CAST(SUBSTRING(order_no FROM '([0-9]+)$') AS BIGINT)), 0)
      INTO v_std_sale
      FROM public.sales
      WHERE company_id = p_company_id
        AND COALESCE(is_studio, false) = true
        AND order_no IS NOT NULL
        AND order_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(order_no FROM '([0-9]+)$')) <= 9;
    EXCEPTION WHEN undefined_column THEN
      v_std_sale := 0;
    END;
    v_max := GREATEST(COALESCE(v_max, 0), COALESCE(v_std_sale, 0));
  ELSE
    v_max := 0;
  END IF;

  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
  )
  VALUES (
    p_company_id,
    v_sentinel,
    v_doc_type,
    public.erp_document_default_prefix(LOWER(v_doc_type)),
    p_year,
    0,
    4,
    now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;

  UPDATE public.erp_document_sequences e
  SET
    last_number = GREATEST(
      e.last_number,
      LEAST(v_max, 2147483647)::INTEGER
    ),
    updated_at = now()
  WHERE e.company_id = p_company_id
    AND e.branch_id = v_sentinel
    AND e.document_type = v_doc_type
    AND e.year = p_year;
END;
$sync2$;

COMMENT ON FUNCTION public._sync_erp_sequence_after_duplicate(UUID, TEXT, INTEGER) IS
  'After unique_violation on document numbers: align erp_document_sequences. PAYMENT → paid PAY-*; CUSTOMER_RECEIPT → received RCV/PAY-*; other types use table max.';

NOTIFY pgrst, 'reload schema';
