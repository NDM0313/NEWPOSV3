-- ============================================================================
-- Sequence continuity: prefix/branch-code is display-only; numeric suffix is
-- company + document_type + year. Never reset on prefix change.
-- ============================================================================

-- Parse final numeric suffix from any voucher ref (RCV-0008, HQ-RCV-0009, etc.)
CREATE OR REPLACE FUNCTION public.erp_parse_voucher_numeric_suffix(p_ref TEXT)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
AS $parse$
  SELECT CASE
    WHEN p_ref IS NULL OR btrim(p_ref) = '' THEN 0::BIGINT
    WHEN SUBSTRING(btrim(p_ref) FROM '([0-9]+)$') IS NULL THEN 0::BIGINT
    WHEN LENGTH(SUBSTRING(btrim(p_ref) FROM '([0-9]+)$')) > 9 THEN 0::BIGINT
    ELSE CAST(SUBSTRING(btrim(p_ref) FROM '([0-9]+)$') AS BIGINT)
  END;
$parse$;

COMMENT ON FUNCTION public.erp_parse_voucher_numeric_suffix(TEXT) IS
  'Extract trailing numeric suffix from voucher refs; prefix-agnostic (HQ-RCV-0009 → 9).';

-- Observed max numeric suffix from live voucher tables for a document type/year.
CREATE OR REPLACE FUNCTION public.erp_observed_max_document_suffix(
  p_company_id UUID,
  p_document_type TEXT,
  p_year INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $obs$
DECLARE
  v_doc_type TEXT := UPPER(TRIM(p_document_type));
  v_observed BIGINT := 0;
  v_studio_sale BIGINT := 0;
  v_exp_pay BIGINT := 0;
BEGIN
  IF p_company_id IS NULL OR v_doc_type = '' THEN
    RETURN 0;
  END IF;

  IF v_doc_type = 'CUSTOMER_RECEIPT' THEN
    SELECT COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(p.reference_number)), 0)
      INTO v_observed
    FROM public.payments p
    WHERE p.company_id = p_company_id
      AND p.payment_type = 'received'
      AND p.reference_number IS NOT NULL
      AND btrim(p.reference_number) <> ''
      AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%';

    SELECT GREATEST(
      v_observed,
      COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(rp.reference)), 0)
    )
    INTO v_observed
    FROM public.rental_payments rp
    JOIN public.rentals r ON r.id = rp.rental_id
    WHERE r.company_id = p_company_id
      AND rp.voided_at IS NULL
      AND rp.reference IS NOT NULL
      AND btrim(rp.reference) <> '';

  ELSIF v_doc_type = 'PAYMENT' THEN
    SELECT COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(p.reference_number)), 0)
      INTO v_observed
    FROM public.payments p
    WHERE p.company_id = p_company_id
      AND p.payment_type = 'paid'
      AND p.reference_number IS NOT NULL
      AND btrim(p.reference_number) <> ''
      AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%';

  ELSIF v_doc_type = 'WORKER_PAYMENT' THEN
    SELECT COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(p.reference_number)), 0)
      INTO v_observed
    FROM public.payments p
    WHERE p.company_id = p_company_id
      AND p.reference_type = 'worker_payment'
      AND p.reference_number IS NOT NULL
      AND btrim(p.reference_number) <> '';

  ELSIF v_doc_type = 'EXPENSE' THEN
    SELECT COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(e.expense_no)), 0)
      INTO v_observed
    FROM public.expenses e
    WHERE e.company_id = p_company_id
      AND e.expense_no IS NOT NULL
      AND btrim(e.expense_no) <> '';

    SELECT GREATEST(
      v_observed,
      COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(p.reference_number)), 0)
    )
    INTO v_observed
    FROM public.payments p
    WHERE p.company_id = p_company_id
      AND p.reference_number IS NOT NULL
      AND btrim(p.reference_number) <> ''
      AND p.reference_number ~* '(^|-)EXP-[0-9]+$';

  ELSIF v_doc_type = 'SALE' THEN
    SELECT COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(s.invoice_no)), 0)
      INTO v_observed
    FROM public.sales s
    WHERE s.company_id = p_company_id
      AND s.invoice_no IS NOT NULL
      AND btrim(s.invoice_no) <> '';

  ELSIF v_doc_type = 'PURCHASE' THEN
    SELECT COALESCE(GREATEST(
      COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(pu.po_no))
        FILTER (WHERE pu.po_no IS NOT NULL AND btrim(pu.po_no) <> ''), 0),
      COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(pu.order_no))
        FILTER (WHERE pu.order_no IS NOT NULL AND btrim(pu.order_no) <> ''), 0),
      COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(pu.draft_no))
        FILTER (WHERE pu.draft_no IS NOT NULL AND btrim(pu.draft_no) <> ''), 0)
    ), 0)
    INTO v_observed
    FROM public.purchases pu
    WHERE pu.company_id = p_company_id;

  ELSIF v_doc_type = 'RENTAL' THEN
    BEGIN
      SELECT COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(r.booking_no)), 0)
        INTO v_observed
      FROM public.rentals r
      WHERE r.company_id = p_company_id
        AND r.booking_no IS NOT NULL
        AND btrim(r.booking_no) <> '';
    EXCEPTION WHEN undefined_column THEN
      v_observed := 0;
    END;

  ELSIF v_doc_type = 'STUDIO' THEN
    v_observed := 0;
    BEGIN
      SELECT COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(sp.production_no)), 0)
        INTO v_observed
      FROM public.studio_productions sp
      WHERE sp.company_id = p_company_id
        AND sp.production_no IS NOT NULL
        AND btrim(sp.production_no) <> '';
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      v_observed := 0;
    END;
    BEGIN
      SELECT COALESCE(MAX(public.erp_parse_voucher_numeric_suffix(s.order_no)), 0)
        INTO v_studio_sale
      FROM public.sales s
      WHERE s.company_id = p_company_id
        AND COALESCE(s.is_studio, false) = true
        AND s.order_no IS NOT NULL
        AND btrim(s.order_no) <> '';
    EXCEPTION WHEN undefined_column THEN
      v_studio_sale := 0;
    END;
    v_observed := GREATEST(COALESCE(v_observed, 0), COALESCE(v_studio_sale, 0));

  ELSIF v_doc_type = 'MANUAL_JOURNAL' THEN
    SELECT COALESCE(MAX(s.n), 0)
      INTO v_observed
    FROM (
      SELECT public.erp_parse_voucher_numeric_suffix(je.entry_no) AS n
      FROM public.journal_entries je
      WHERE je.company_id = p_company_id
        AND je.entry_no IS NOT NULL
        AND btrim(je.entry_no) <> ''
      UNION ALL
      SELECT public.erp_parse_voucher_numeric_suffix(je.document_no) AS n
      FROM public.journal_entries je
      WHERE je.company_id = p_company_id
        AND je.document_no IS NOT NULL
        AND btrim(je.document_no) <> ''
    ) s
    WHERE s.n > 0;

  ELSIF v_doc_type = 'FUND_TRANSFER' THEN
    SELECT COALESCE(MAX(s.n), 0)
      INTO v_observed
    FROM (
      SELECT public.erp_parse_voucher_numeric_suffix(je.entry_no) AS n
      FROM public.journal_entries je
      WHERE je.company_id = p_company_id
        AND je.entry_no IS NOT NULL
        AND btrim(je.entry_no) <> ''
      UNION ALL
      SELECT public.erp_parse_voucher_numeric_suffix(je.document_no) AS n
      FROM public.journal_entries je
      WHERE je.company_id = p_company_id
        AND je.document_no IS NOT NULL
        AND btrim(je.document_no) <> ''
    ) s
    WHERE s.n > 0;

  ELSE
    v_observed := 0;
  END IF;

  RETURN LEAST(COALESCE(v_observed, 0), 2147483647)::INTEGER;
END;
$obs$;

COMMENT ON FUNCTION public.erp_observed_max_document_suffix(UUID, TEXT, INTEGER) IS
  'Max trailing numeric suffix from live vouchers; prefix-agnostic. Includes rental_payments for CUSTOMER_RECEIPT.';

-- Effective max = GREATEST(all sequence rows for company/type/year, observed max).
CREATE OR REPLACE FUNCTION public.erp_effective_sequence_max(
  p_company_id UUID,
  p_document_type TEXT,
  p_year INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $eff$
DECLARE
  v_doc_type TEXT := UPPER(TRIM(p_document_type));
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  v_current_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_seq_year INTEGER;
  v_rule_year_reset BOOLEAN := true;
  v_seq_max INTEGER := 0;
  v_observed INTEGER := 0;
BEGIN
  IF p_company_id IS NULL OR v_doc_type = '' THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(year_reset, true)
    INTO v_rule_year_reset
  FROM public.erp_document_sequences
  WHERE company_id = p_company_id
    AND branch_id = v_sentinel
    AND document_type = v_doc_type
    AND year = v_current_year
  LIMIT 1;

  v_seq_year := CASE
    WHEN COALESCE(v_rule_year_reset, true) THEN COALESCE(p_year, v_current_year)
    ELSE 0
  END;

  SELECT COALESCE(MAX(last_number), 0)
    INTO v_seq_max
  FROM public.erp_document_sequences
  WHERE company_id = p_company_id
    AND document_type = v_doc_type
    AND year = v_seq_year;

  v_observed := public.erp_observed_max_document_suffix(p_company_id, v_doc_type, v_seq_year);

  RETURN GREATEST(COALESCE(v_seq_max, 0), COALESCE(v_observed, 0));
END;
$eff$;

COMMENT ON FUNCTION public.erp_effective_sequence_max(UUID, TEXT, INTEGER) IS
  'True max numeric suffix: max(last_number) across all counter rows + observed vouchers. Never decreases.';

-- Sync all sequence rows for company/document_type/year to at least effective max.
CREATE OR REPLACE FUNCTION public.sync_erp_document_sequences_to_effective_max(
  p_company_id UUID,
  p_document_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sync$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_role TEXT := lower(trim(COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(auth.jwt()->>'role', ''),
    ''
  )));
  v_user_role TEXT := '';
  v_doc_type TEXT := UPPER(TRIM(p_document_type));
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  v_current_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_seq_year INTEGER;
  v_rule_year_reset BOOLEAN := true;
  v_effective INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  IF p_company_id IS NULL OR v_doc_type = '' THEN
    RETURN json_build_object('success', false, 'error', 'company_id and document_type required');
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
      RETURN json_build_object('success', false, 'error', 'Only owner/admin can sync sequence counters');
    END IF;
  END IF;

  SELECT COALESCE(year_reset, true)
    INTO v_rule_year_reset
  FROM public.erp_document_sequences
  WHERE company_id = p_company_id
    AND branch_id = v_sentinel
    AND document_type = v_doc_type
    AND year = v_current_year
  LIMIT 1;

  v_seq_year := CASE WHEN COALESCE(v_rule_year_reset, true) THEN v_current_year ELSE 0 END;
  v_effective := public.erp_effective_sequence_max(p_company_id, v_doc_type, v_seq_year);

  UPDATE public.erp_document_sequences e
  SET
    last_number = GREATEST(e.last_number, v_effective),
    updated_at = now()
  WHERE e.company_id = p_company_id
    AND e.document_type = v_doc_type
    AND e.year = v_seq_year
    AND e.last_number < v_effective;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'updated', v_updated > 0,
    'effective_max', v_effective,
    'rows_updated', v_updated,
    'document_type', v_doc_type,
    'year', v_seq_year
  );
END;
$sync$;

COMMENT ON FUNCTION public.sync_erp_document_sequences_to_effective_max(UUID, TEXT) IS
  'Advance all sequence rows to effective max; never decrease. Owner/admin only.';

GRANT EXECUTE ON FUNCTION public.sync_erp_document_sequences_to_effective_max(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_erp_document_sequences_to_effective_max(UUID, TEXT) TO service_role;

-- Voucher types use company-wide numeric counter (sentinel); branch_id is display-only.
CREATE OR REPLACE FUNCTION public.erp_numbering_uses_unified_voucher_counter(p_document_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $unified$
  SELECT UPPER(TRIM(COALESCE(p_document_type, ''))) IN (
    'CUSTOMER_RECEIPT', 'PAYMENT', 'EXPENSE', 'MANUAL_JOURNAL', 'FUND_TRANSFER'
  );
$unified$;

-- Refactored allocator: effective max + sync all rows + format with current rules.
CREATE OR REPLACE FUNCTION public.generate_document_number(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_document_type TEXT DEFAULT 'payment',
  p_include_year BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_prefix   TEXT;
  v_next     INTEGER;
  v_year     INTEGER;
  v_doc_type TEXT;
  v_padding  INTEGER;
  v_pad_ins  INTEGER;
  v_eff_pad  INTEGER;
  v_sentinel UUID;
  v_current_year INTEGER;
  v_seq_year INTEGER;
  v_seq_branch UUID;
  v_rule_year_reset BOOLEAN := true;
  v_rule_branch_based BOOLEAN := false;
  v_rule_include_branch_code BOOLEAN := false;
  v_branch_code TEXT;
  v_formatted TEXT;
  v_effective_max INTEGER := 0;
  v_unified_voucher BOOLEAN := false;
BEGIN
  v_current_year := EXTRACT(YEAR FROM now())::INTEGER;
  v_doc_type := UPPER(TRIM(p_document_type));
  v_sentinel := public.erp_numbering_global_branch_sentinel();
  v_unified_voucher := public.erp_numbering_uses_unified_voucher_counter(v_doc_type);

  v_pad_ins := CASE
    WHEN v_doc_type IN ('MANUAL_JOURNAL', 'FUND_TRANSFER') THEN 6
    ELSE 4
  END;

  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding,
    year_reset, branch_based, include_branch_code, updated_at
  )
  VALUES (
    p_company_id,
    v_sentinel,
    v_doc_type,
    public.erp_document_default_prefix(p_document_type),
    v_current_year,
    0,
    v_pad_ins,
    true,
    false,
    false,
    now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;

  SELECT
    prefix,
    padding,
    COALESCE(year_reset, true),
    COALESCE(branch_based, false),
    COALESCE(include_branch_code, false)
  INTO
    v_prefix,
    v_padding,
    v_rule_year_reset,
    v_rule_branch_based,
    v_rule_include_branch_code
  FROM public.erp_document_sequences
  WHERE company_id = p_company_id
    AND branch_id = v_sentinel
    AND document_type = v_doc_type
    AND year = v_current_year
  LIMIT 1;

  IF v_prefix IS NULL OR TRIM(v_prefix) = '' THEN
    v_prefix := public.erp_document_default_prefix(p_document_type);
  END IF;

  v_seq_year := CASE WHEN v_rule_year_reset THEN v_current_year ELSE 0 END;
  v_year := v_seq_year;

  -- Voucher types: always sentinel counter (branch_id display-only).
  -- Other types: respect branch_based for counter row key.
  IF v_unified_voucher THEN
    v_seq_branch := v_sentinel;
  ELSE
    v_seq_branch := CASE
      WHEN v_rule_branch_based AND p_branch_id IS NOT NULL THEN p_branch_id
      ELSE v_sentinel
    END;
  END IF;

  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
  )
  VALUES (
    p_company_id,
    v_seq_branch,
    v_doc_type,
    v_prefix,
    v_seq_year,
    0,
    LEAST(GREATEST(COALESCE(v_padding, v_pad_ins), 4), 6),
    now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;

  v_effective_max := public.erp_effective_sequence_max(p_company_id, v_doc_type, v_seq_year);
  v_next := v_effective_max + 1;

  -- Sync ALL counter rows for this company/type/year (never decrease).
  UPDATE public.erp_document_sequences e
  SET
    last_number = GREATEST(e.last_number, v_next),
    prefix = CASE WHEN e.branch_id = v_sentinel THEN v_prefix ELSE e.prefix END,
    updated_at = now()
  WHERE e.company_id = p_company_id
    AND e.document_type = v_doc_type
    AND e.year = v_seq_year;

  v_eff_pad := LEAST(GREATEST(COALESCE(v_padding, v_pad_ins), 4), 6);

  IF p_include_year AND v_seq_year > 0 THEN
    v_formatted := v_prefix || '-' || RIGHT(v_seq_year::TEXT, 2) || '-' ||
           LPAD(v_next::TEXT, v_eff_pad, '0');
  ELSE
    v_formatted := v_prefix || '-' ||
           LPAD(v_next::TEXT, v_eff_pad, '0');
  END IF;

  IF v_rule_include_branch_code AND v_rule_branch_based AND p_branch_id IS NOT NULL THEN
    SELECT NULLIF(
      REGEXP_REPLACE(UPPER(TRIM(COALESCE(code, ''))), '[^A-Z0-9]', '', 'g'),
      ''
    )
    INTO v_branch_code
    FROM public.branches
    WHERE id = p_branch_id
      AND company_id = p_company_id
    LIMIT 1;

    IF v_branch_code IS NOT NULL AND v_branch_code <> '' THEN
      RETURN v_branch_code || '-' || v_formatted;
    END IF;
  END IF;

  RETURN v_formatted;
END;
$body$;

COMMENT ON FUNCTION public.generate_document_number(UUID, UUID, TEXT, BOOLEAN) IS
  'ERP numbering: effective-max continuity; prefix/branch-code display-only; voucher types use unified company counter.';

NOTIFY pgrst, 'reload schema';
