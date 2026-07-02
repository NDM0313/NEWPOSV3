-- Self-healing global document numbers: sync counter from live sales before each increment.
-- Prevents SL/PS/STD drift when invoices were created outside document_sequences_global.

CREATE OR REPLACE FUNCTION public.get_next_document_number_global(
  p_company_id UUID,
  p_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_next BIGINT;
  v_prefix TEXT;
  v_type TEXT;
  v_max BIGINT := 0;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id required for get_next_document_number_global';
  END IF;

  v_type := UPPER(TRIM(p_type));

  v_prefix := CASE v_type
    WHEN 'SL' THEN 'SL-'
    WHEN 'PS' THEN 'PS-'
    WHEN 'DRAFT' THEN 'DRAFT-'
    WHEN 'QT' THEN 'QT-'
    WHEN 'SO' THEN 'SO-'
    WHEN 'SDR' THEN 'SDR-'
    WHEN 'SQT' THEN 'SQT-'
    WHEN 'SOR' THEN 'SOR-'
    WHEN 'CUS' THEN 'CUS-'
    WHEN 'PUR' THEN 'PUR-'
    WHEN 'PDR' THEN 'PDR-'
    WHEN 'POR' THEN 'POR-'
    WHEN 'PAY' THEN 'PAY-'
    WHEN 'RNT' THEN 'RNT-'
    WHEN 'STD' THEN 'STD-'
    ELSE v_type || '-'
  END;

  INSERT INTO public.document_sequences_global (company_id, document_type, current_number, updated_at)
  VALUES (p_company_id, v_type, 0, NOW())
  ON CONFLICT (company_id, document_type) DO NOTHING;

  IF v_type = 'SL' THEN
    SELECT COALESCE(MAX((REGEXP_REPLACE(invoice_no, '^SL-', ''))::INTEGER), 0)
    INTO v_max
    FROM public.sales
    WHERE company_id = p_company_id
      AND invoice_no ~ '^SL-[0-9]+$';

  ELSIF v_type = 'PS' THEN
    SELECT COALESCE(MAX((REGEXP_REPLACE(invoice_no, '^PS-', ''))::INTEGER), 0)
    INTO v_max
    FROM public.sales
    WHERE company_id = p_company_id
      AND invoice_no ~ '^PS-[0-9]+$';

  ELSIF v_type = 'STD' THEN
    SELECT COALESCE(MAX((REGEXP_REPLACE(order_no, '^STD-', ''))::INTEGER), 0)
    INTO v_max
    FROM public.sales
    WHERE company_id = p_company_id
      AND order_no ~ '^STD-[0-9]+$';
  END IF;

  IF v_max > 0 THEN
    UPDATE public.document_sequences_global
    SET current_number = GREATEST(current_number, v_max),
        updated_at = NOW()
    WHERE company_id = p_company_id
      AND document_type = v_type;
  END IF;

  UPDATE public.document_sequences_global
  SET current_number = current_number + 1,
      updated_at = NOW()
  WHERE company_id = p_company_id
    AND document_type = v_type
  RETURNING current_number INTO v_next;

  IF v_next IS NULL THEN
    INSERT INTO public.document_sequences_global (company_id, document_type, current_number, updated_at)
    VALUES (p_company_id, v_type, 1, NOW())
    RETURNING current_number INTO v_next;
  END IF;

  RETURN v_prefix || LPAD(v_next::TEXT, 4, '0');
END;
$body$;

COMMENT ON FUNCTION public.get_next_document_number_global(UUID, TEXT) IS
  'Global doc numbers per company. SL/PS/STD self-heal from sales before increment.';

NOTIFY pgrst, 'reload schema';
