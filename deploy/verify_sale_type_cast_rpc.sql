-- Dry-run RPC: partial payment payload like mobile createSale (rolled back)
DO $$
DECLARE
  v_company UUID;
  v_branch UUID;
  v_result JSONB;
BEGIN
  SELECT b.company_id, b.id INTO v_company, v_branch
  FROM public.branches b
  LIMIT 1;

  IF v_company IS NULL OR v_branch IS NULL THEN
    RAISE NOTICE 'SKIP: no branch row for RPC test';
    RETURN;
  END IF;

  v_result := public.create_sale_document_header(
    v_company,
    v_branch,
    false,
    jsonb_build_object(
      'invoice_date', CURRENT_DATE,
      'customer_name', 'Cast verify walk-in',
      'type', 'invoice',
      'status', 'final',
      'payment_status', 'partial',
      'payment_method', 'Cash',
      'subtotal', 6640,
      'total', 6640,
      'paid_amount', 500,
      'due_amount', 6140
    ),
    NULL
  );

  IF COALESCE(v_result->>'success', 'false') <> 'true' THEN
    RAISE EXCEPTION 'RPC failed: %', v_result->>'error';
  END IF;

  DELETE FROM public.sales WHERE id = (v_result->>'sale_id')::UUID;
  RAISE NOTICE 'OK: create_sale_document_header partial payment cast test passed';
END $$;
