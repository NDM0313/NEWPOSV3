-- ============================================================================
-- Numbering Phase B: include_branch_code on erp_document_sequences
-- When branch_based + include_branch_code: prepend branches.code (CR-SL-0001).
-- Extends generate_document_number (20260516120000) with rule-row keys + branch prefix.
-- Forward-only, additive. Run on dev/staging before Settings UI toggle test.
-- ============================================================================

ALTER TABLE public.erp_document_sequences
  ADD COLUMN IF NOT EXISTS include_branch_code boolean DEFAULT false;

COMMENT ON COLUMN public.erp_document_sequences.include_branch_code IS
  'When true with branch_based: prepend branches.code to formatted number (e.g. CR-SL-0001).';

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
  v_observed BIGINT := 0;
  v_pad_ins  INTEGER;
  v_studio_sale BIGINT := 0;
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
BEGIN
  v_current_year := EXTRACT(YEAR FROM now())::INTEGER;
  v_doc_type := UPPER(TRIM(p_document_type));
  v_sentinel := public.erp_numbering_global_branch_sentinel();

  v_pad_ins := CASE
    WHEN v_doc_type IN ('MANUAL_JOURNAL', 'FUND_TRANSFER') THEN 6
    ELSE 4
  END;

  -- Sentinel rule row (Settings → Numbering Rules)
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
  v_seq_branch := CASE
    WHEN v_rule_branch_based AND p_branch_id IS NOT NULL THEN p_branch_id
    ELSE v_sentinel
  END;
  v_year := v_seq_year;

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

  BEGIN
    IF v_doc_type = 'PAYMENT' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.payments
      WHERE company_id = p_company_id
        AND reference_number ~ '([0-9]+)$'
        AND reference_number NOT ILIKE 'PAY-BACKFILL-%'
        AND LENGTH(SUBSTRING(reference_number FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'WORKER_PAYMENT' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.payments
      WHERE company_id = p_company_id
        AND reference_type = 'worker_payment'
        AND reference_number ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(reference_number FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'SALE' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.sales
      WHERE company_id = p_company_id
        AND invoice_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(invoice_no FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'PURCHASE' THEN
      SELECT COALESCE(GREATEST(
        COALESCE(MAX(CAST(SUBSTRING(po_no FROM '([0-9]+)$') AS BIGINT))
          FILTER (WHERE po_no IS NOT NULL AND po_no ~ '([0-9]+)$'
            AND LENGTH(SUBSTRING(po_no FROM '([0-9]+)$')) <= 9), 0),
        COALESCE(MAX(CAST(SUBSTRING(order_no FROM '([0-9]+)$') AS BIGINT))
          FILTER (WHERE order_no IS NOT NULL AND order_no ~ '([0-9]+)$'
            AND LENGTH(SUBSTRING(order_no FROM '([0-9]+)$')) <= 9), 0),
        COALESCE(MAX(CAST(SUBSTRING(draft_no FROM '([0-9]+)$') AS BIGINT))
          FILTER (WHERE draft_no IS NOT NULL AND draft_no ~ '([0-9]+)$'
            AND LENGTH(SUBSTRING(draft_no FROM '([0-9]+)$')) <= 9), 0)
      ), 0)
      INTO v_observed
      FROM public.purchases
      WHERE company_id = p_company_id;
    ELSIF v_doc_type = 'EXPENSE' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(expense_no FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.expenses
      WHERE company_id = p_company_id
        AND expense_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(expense_no FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'RENTAL' THEN
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(booking_no FROM '([0-9]+)$') AS BIGINT)), 0)
          INTO v_observed
        FROM public.rentals
        WHERE company_id = p_company_id
          AND booking_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(booking_no FROM '([0-9]+)$')) <= 9;
      EXCEPTION WHEN undefined_column THEN v_observed := 0;
      END;
    ELSIF v_doc_type = 'STUDIO' THEN
      v_observed := 0;
      v_studio_sale := 0;
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(production_no FROM '([0-9]+)$') AS BIGINT)), 0)
          INTO v_observed
        FROM public.studio_productions
        WHERE company_id = p_company_id
          AND production_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(production_no FROM '([0-9]+)$')) <= 9;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        v_observed := 0;
      END;
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(order_no FROM '([0-9]+)$') AS BIGINT)), 0)
          INTO v_studio_sale
        FROM public.sales
        WHERE company_id = p_company_id
          AND COALESCE(is_studio, false) = true
          AND order_no IS NOT NULL
          AND order_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(order_no FROM '([0-9]+)$')) <= 9;
      EXCEPTION WHEN undefined_column THEN
        v_studio_sale := 0;
      END;
      v_observed := GREATEST(COALESCE(v_observed, 0), COALESCE(v_studio_sale, 0));
    ELSIF v_doc_type = 'MANUAL_JOURNAL' THEN
      SELECT COALESCE(MAX(s.n), 0)
        INTO v_observed
      FROM (
        SELECT CAST(SUBSTRING(je.entry_no FROM '([0-9]+)$') AS BIGINT) AS n
        FROM public.journal_entries je
        WHERE je.company_id = p_company_id
          AND je.entry_no ~ '^JV-[0-9]+$'
        UNION ALL
        SELECT CAST(SUBSTRING(je.document_no FROM '([0-9]+)$') AS BIGINT) AS n
        FROM public.journal_entries je
        WHERE je.company_id = p_company_id
          AND je.document_no IS NOT NULL
          AND je.document_no ~ '^JV-[0-9]+$'
      ) s;
    ELSIF v_doc_type = 'FUND_TRANSFER' THEN
      SELECT COALESCE(MAX(s.n), 0)
        INTO v_observed
      FROM (
        SELECT CAST(SUBSTRING(je.entry_no FROM '([0-9]+)$') AS BIGINT) AS n
        FROM public.journal_entries je
        WHERE je.company_id = p_company_id
          AND je.entry_no ~ '^FT-[0-9]+$'
        UNION ALL
        SELECT CAST(SUBSTRING(je.document_no FROM '([0-9]+)$') AS BIGINT) AS n
        FROM public.journal_entries je
        WHERE je.company_id = p_company_id
          AND je.document_no IS NOT NULL
          AND je.document_no ~ '^FT-[0-9]+$'
      ) s;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_observed := 0;
  END;

  UPDATE public.erp_document_sequences
  SET
    last_number = GREATEST(last_number + 1, v_observed::INTEGER + 1),
    updated_at = now()
  WHERE company_id = p_company_id
    AND branch_id = v_seq_branch
    AND document_type = v_doc_type
    AND year = v_seq_year
  RETURNING prefix, last_number, padding
  INTO v_prefix, v_next, v_padding;

  IF v_prefix IS NULL OR v_next IS NULL THEN
    RAISE EXCEPTION 'erp_document_sequences: failed to get next number for company=%, type=%',
      p_company_id, v_doc_type;
  END IF;

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
  'ERP numbering: self-heal; respects year_reset, branch_based, include_branch_code from sentinel rule row; optional CR-SL-0001 branch prefix.';
