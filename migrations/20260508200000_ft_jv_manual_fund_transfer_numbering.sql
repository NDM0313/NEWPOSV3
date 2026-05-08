-- ============================================================================
-- Fund transfer (FT-) and manual journal voucher (JV-) numbering
-- ----------------------------------------------------------------------------
-- • erp_document_default_prefix: FUND_TRANSFER → FT, MANUAL_JOURNAL → JV
--   (JOURNAL remains JE for system-generated postings).
-- • generate_document_number: 6-digit padding for FT/JV; self-heal from
--   journal_entries.entry_no / document_no patterns ^FT-[0-9]+$ / ^JV-[0-9]+$.
-- • journal_entries.document_no: mirrors entry_no for mirrored GL docs (FT/JV).
-- ============================================================================

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS document_no VARCHAR(100) NULL;

COMMENT ON COLUMN public.journal_entries.document_no IS
  'Mirrored operational reference (e.g. same as entry_no for JV-000001 / FT-000001).';

CREATE OR REPLACE FUNCTION public.erp_document_default_prefix(p_document_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $body$
  SELECT CASE UPPER(TRIM(p_document_type))
    WHEN 'SALE'              THEN 'SL'
    WHEN 'PURCHASE'          THEN 'PUR'
    WHEN 'PURCHASE_RETURN'   THEN 'PRET'
    WHEN 'PAYMENT'           THEN 'PAY'
    WHEN 'SUPPLIER_PAYMENT'  THEN 'PAY'
    WHEN 'CUSTOMER_RECEIPT'  THEN 'RCV'
    WHEN 'EXPENSE'           THEN 'EXP'
    WHEN 'RENTAL'            THEN 'REN'
    WHEN 'STOCK'             THEN 'STK'
    WHEN 'STOCK_ADJUSTMENT'  THEN 'STK'
    WHEN 'JOURNAL'           THEN 'JE'
    WHEN 'MANUAL_JOURNAL'    THEN 'JV'
    WHEN 'FUND_TRANSFER'     THEN 'FT'
    WHEN 'PRODUCT'           THEN 'PRD'
    WHEN 'STUDIO'            THEN 'STD'
    WHEN 'JOB'               THEN 'JOB'
    WHEN 'POS'               THEN 'POS'
    WHEN 'CUSTOMER'          THEN 'CUS'
    WHEN 'SUPPLIER'          THEN 'SUP'
    WHEN 'WORKER'            THEN 'WRK'
    ELSE UPPER(TRIM(p_document_type))
  END;
$body$;

COMMENT ON FUNCTION public.erp_document_default_prefix(TEXT) IS
  'Default prefix per document type. Manual journal vouchers: MANUAL_JOURNAL → JV; fund transfers: FUND_TRANSFER → FT; system journals: JOURNAL → JE.';

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
  v_branch   UUID;
  v_observed BIGINT := 0;
  v_pad_ins  INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::INTEGER;
  v_doc_type := UPPER(TRIM(p_document_type));
  v_branch := COALESCE(p_branch_id, public.erp_numbering_global_branch_sentinel());

  v_pad_ins := CASE
    WHEN v_doc_type IN ('MANUAL_JOURNAL', 'FUND_TRANSFER') THEN 6
    ELSE 4
  END;

  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
  )
  VALUES (
    p_company_id, v_branch, v_doc_type,
    public.erp_document_default_prefix(p_document_type),
    v_year, 0, v_pad_ins, now()
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
    ELSIF v_doc_type = 'SALE' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.sales
      WHERE company_id = p_company_id
        AND invoice_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(invoice_no FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'PURCHASE' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(po_no FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.purchases
      WHERE company_id = p_company_id
        AND po_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(po_no FROM '([0-9]+)$')) <= 9;
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
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(production_no FROM '([0-9]+)$') AS BIGINT)), 0)
          INTO v_observed
        FROM public.studio_productions
        WHERE company_id = p_company_id
          AND production_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(production_no FROM '([0-9]+)$')) <= 9;
      EXCEPTION WHEN undefined_column OR undefined_table THEN v_observed := 0;
      END;
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
    AND branch_id = v_branch
    AND document_type = v_doc_type
    AND year = v_year
  RETURNING prefix, last_number, padding
  INTO v_prefix, v_next, v_padding;

  IF v_prefix IS NULL OR v_next IS NULL THEN
    RAISE EXCEPTION 'erp_document_sequences: failed to get next number for company=%, type=%',
      p_company_id, v_doc_type;
  END IF;

  IF p_include_year THEN
    RETURN v_prefix || '-' || RIGHT(v_year::TEXT, 2) || '-' ||
           LPAD(v_next::TEXT, GREATEST(COALESCE(v_padding, v_pad_ins), 1), '0');
  ELSE
    RETURN v_prefix || '-' ||
           LPAD(v_next::TEXT, GREATEST(COALESCE(v_padding, v_pad_ins), 1), '0');
  END IF;
END;
$body$;

COMMENT ON FUNCTION public.generate_document_number(UUID, UUID, TEXT, BOOLEAN) IS
  'ERP numbering v3: self-healing; JV/FT use 6-digit suffix; JE/PAY/etc. use row padding (default 4).';
