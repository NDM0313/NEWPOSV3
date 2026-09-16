-- Phase B Settings: company-scoped PAY sequence merge (admin/owner only).
-- Does NOT touch payments.reference_number or audit history.
-- bulk merge_supplier_payment_sequence_forward() remains for migrations; not granted to authenticated.

CREATE OR REPLACE FUNCTION public.merge_supplier_payment_sequence_for_company(p_company_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_role TEXT := lower(trim(COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(auth.jwt()->>'role', ''),
    ''
  )));
  v_user_role TEXT := '';
  v_user_company UUID;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  v_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_pay_last INTEGER := 0;
  v_sup_last INTEGER := 0;
  v_observed BIGINT := 0;
  v_merged INTEGER := 0;
  v_had_supplier_row BOOLEAN := FALSE;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'company_id is required');
  END IF;

  IF v_request_role <> 'service_role' THEN
    IF v_user_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT lower(COALESCE(u.role::text, ''))
    INTO v_user_role
    FROM public.users u
    WHERE (u.id = v_user_id OR u.auth_user_id = v_user_id)
      AND u.company_id = p_company_id
    LIMIT 1;

    IF v_user_role IS NULL OR v_user_role = '' THEN
      RETURN json_build_object('success', false, 'error', 'User is not a member of this company');
    END IF;

    IF v_user_role NOT IN ('owner', 'admin', 'super admin', 'superadmin', 'super_admin') THEN
      RETURN json_build_object('success', false, 'error', 'Only owner/admin can merge PAY sequence counters');
    END IF;

    v_user_company := public.get_user_company_id();
    IF v_user_company IS DISTINCT FROM p_company_id THEN
      RETURN json_build_object('success', false, 'error', 'Company scope mismatch');
    END IF;
  END IF;

  SELECT COALESCE(MAX(last_number), 0) INTO v_pay_last
  FROM public.erp_document_sequences
  WHERE company_id = p_company_id
    AND branch_id = v_sentinel
    AND document_type = 'PAYMENT'
    AND year = v_year;

  SELECT COALESCE(MAX(last_number), 0) INTO v_sup_last
  FROM public.erp_document_sequences
  WHERE company_id = p_company_id
    AND branch_id = v_sentinel
    AND document_type = 'SUPPLIER_PAYMENT'
    AND year = v_year;

  SELECT EXISTS (
    SELECT 1 FROM public.erp_document_sequences
    WHERE company_id = p_company_id
      AND branch_id = v_sentinel
      AND document_type = 'SUPPLIER_PAYMENT'
      AND year = v_year
  ) INTO v_had_supplier_row;

  SELECT COALESCE(MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
  INTO v_observed
  FROM public.payments p
  WHERE p.company_id = p_company_id
    AND p.payment_type = 'paid'
    AND p.reference_number ~ '^PAY-'
    AND p.reference_number ~ '([0-9]+)$'
    AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9;

  v_merged := GREATEST(v_pay_last, v_sup_last, LEAST(v_observed, 2147483647)::INTEGER);

  IF v_merged <= v_pay_last AND NOT v_had_supplier_row AND v_sup_last = 0 THEN
    RETURN json_build_object(
      'success', true,
      'updated', false,
      'merged_last_number', v_pay_last,
      'message', 'PAYMENT sequence already aligned; no merge needed'
    );
  END IF;

  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
  )
  VALUES (
    p_company_id,
    v_sentinel,
    'PAYMENT',
    public.erp_document_default_prefix('payment'),
    v_year,
    v_merged,
    4,
    now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year)
  DO UPDATE SET
    last_number = GREATEST(public.erp_document_sequences.last_number, EXCLUDED.last_number),
    updated_at = now();

  RETURN json_build_object(
    'success', true,
    'updated', true,
    'merged_last_number', v_merged,
    'previous_payment_last', v_pay_last,
    'previous_supplier_payment_last', v_sup_last,
    'database_pay_max', LEAST(v_observed, 2147483647)::INTEGER
  );
END;
$fn$;

COMMENT ON FUNCTION public.merge_supplier_payment_sequence_for_company(UUID) IS
  'Phase B Settings: merge SUPPLIER_PAYMENT counter into PAYMENT for one company (owner/admin only). Does not rewrite voucher strings.';

REVOKE ALL ON FUNCTION public.merge_supplier_payment_sequence_forward() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_supplier_payment_sequence_forward() FROM authenticated;
REVOKE ALL ON FUNCTION public.merge_supplier_payment_sequence_forward() FROM anon;

GRANT EXECUTE ON FUNCTION public.merge_supplier_payment_sequence_for_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_supplier_payment_sequence_for_company(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
