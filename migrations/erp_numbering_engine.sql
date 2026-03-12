-- ============================================================================
-- ERP NUMBERING ENGINE (Production-grade)
-- ============================================================================
-- Single engine for all modules: Sales, Purchase, Payment, Expense, Rental, Stock.
-- • No duplicates (atomic INSERT ON CONFLICT DO UPDATE)
-- • Multi-user safe (row lock)
-- • Optional branch support (branch_id or sentinel for company-level)
-- • Yearly reset (year column; format PREFIX-YY-NNNN when p_include_year=true)
-- • Manual-book friendly: PREFIX-0001 or PREFIX-YY-0001
--
-- Numbering Rules UI: prefix/padding/year reset can be stored in this table;
-- ensure a row exists per (company, branch, document_type, year) and update
-- prefix/padding as needed. generate_document_number uses existing row or
-- creates with erp_document_default_prefix().
-- ============================================================================

-- Sentinel UUID for company-level sequence (when branch_id is null from caller)
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION public.erp_numbering_global_branch_sentinel()
  RETURNS UUID LANGUAGE sql IMMUTABLE AS $fn$ SELECT '00000000-0000-0000-0000-000000000000'::UUID; $fn$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'erp_numbering_engine: Could not replace erp_numbering_global_branch_sentinel: %', SQLERRM;
END $$;

-- Table: one row per (company, branch, document_type, year). branch_id uses sentinel for company-level.
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.erp_document_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL DEFAULT public.erp_numbering_global_branch_sentinel(),
    document_type TEXT NOT NULL,
    prefix TEXT NOT NULL,
    year INTEGER NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0,
    padding INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, branch_id, document_type, year)
  );
  COMMENT ON TABLE public.erp_document_sequences IS 'ERP Numbering Engine: atomic sequences per company/branch/type/year. Used by generate_document_number().';
  ALTER TABLE public.erp_document_sequences ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "erp_document_sequences_select" ON public.erp_document_sequences;
  DROP POLICY IF EXISTS "erp_document_sequences_insert" ON public.erp_document_sequences;
  DROP POLICY IF EXISTS "erp_document_sequences_update" ON public.erp_document_sequences;
  CREATE POLICY "erp_document_sequences_select" ON public.erp_document_sequences
    FOR SELECT TO authenticated USING (company_id = (SELECT get_user_company_id()));
  CREATE POLICY "erp_document_sequences_insert" ON public.erp_document_sequences
    FOR INSERT TO authenticated WITH CHECK (company_id = (SELECT get_user_company_id()));
  CREATE POLICY "erp_document_sequences_update" ON public.erp_document_sequences
    FOR UPDATE TO authenticated USING (company_id = (SELECT get_user_company_id()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'erp_numbering_engine: table/RLS erp_document_sequences: %', SQLERRM;
END $$;

-- Default prefixes per document type (used when row is created)
DO $$
BEGIN
  EXECUTE $exec$
CREATE OR REPLACE FUNCTION public.erp_document_default_prefix(p_document_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $body$
  SELECT CASE UPPER(TRIM(p_document_type))
    WHEN 'SALE' THEN 'SL'
    WHEN 'PURCHASE' THEN 'PUR'
    WHEN 'PAYMENT' THEN 'PAY'
    WHEN 'EXPENSE' THEN 'EXP'
    WHEN 'RENTAL' THEN 'REN'
    WHEN 'STOCK' THEN 'STK'
    WHEN 'STOCK_ADJUSTMENT' THEN 'STK'
    WHEN 'JOURNAL' THEN 'JE'
    WHEN 'PRODUCT' THEN 'PRD'
    WHEN 'STUDIO' THEN 'STD'
    WHEN 'JOB' THEN 'JOB'
    WHEN 'POS' THEN 'POS'
    ELSE UPPER(TRIM(p_document_type))
  END;
$body$;
$exec$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'erp_numbering_engine: Could not replace erp_document_default_prefix: %', SQLERRM;
END $$;

-- Generate next document number (atomic, multi-user safe).
DO $$
BEGIN
  EXECUTE $exec$
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
  v_prefix TEXT;
  v_next INTEGER;
  v_year INTEGER;
  v_doc_type TEXT;
  v_padding INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::INTEGER;
  v_doc_type := UPPER(TRIM(p_document_type));
  INSERT INTO public.erp_document_sequences (company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at)
  VALUES (
    p_company_id,
    COALESCE(p_branch_id, public.erp_numbering_global_branch_sentinel()),
    v_doc_type,
    public.erp_document_default_prefix(p_document_type),
    v_year,
    0,
    4,
    now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year)
  DO UPDATE SET
    last_number = public.erp_document_sequences.last_number + 1,
    updated_at = now()
  RETURNING prefix, last_number, padding
  INTO v_prefix, v_next, v_padding;
  IF v_prefix IS NULL OR v_next IS NULL THEN
    RAISE EXCEPTION 'erp_document_sequences: failed to get next number for company=%, type=%', p_company_id, v_doc_type;
  END IF;
  IF p_include_year THEN
    RETURN v_prefix || '-' || RIGHT(v_year::TEXT, 2) || '-' || LPAD(v_next::TEXT, GREATEST(COALESCE(v_padding, 4), 1), '0');
  ELSE
    RETURN v_prefix || '-' || LPAD(v_next::TEXT, GREATEST(COALESCE(v_padding, 4), 1), '0');
  END IF;
END;
$body$;
$exec$;
  EXECUTE 'COMMENT ON FUNCTION public.generate_document_number(UUID, UUID, TEXT, BOOLEAN) IS ''ERP Numbering Engine: returns next number (e.g. PAY-0001 or SL-26-0001). Atomic, duplicate-free, multi-user safe.''';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'erp_numbering_engine: Could not replace generate_document_number: %', SQLERRM;
END $$;