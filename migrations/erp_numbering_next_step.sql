-- ============================================================================
-- ERP NUMBERING – Next Step: Invoice series per branch, yearly reset, audit
-- ============================================================================
-- 1) generate_document_number respects year_reset & branch_based from rule row.
-- 2) Year reset: when year_reset=false use year=0 so sequence never resets.
-- 3) Branch based: when branch_based=true use p_branch_id for sequence key.
-- 4) Deleted number audit table + RPC for cancelled/deleted documents.
-- Run after erp_numbering_engine.sql and erp_numbering_rules_ui.sql.
-- ============================================================================

-- Ensure columns exist (idempotent)
ALTER TABLE public.erp_document_sequences
  ADD COLUMN IF NOT EXISTS year_reset boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS branch_based boolean DEFAULT false;

-- ----------------------------------------------------------------------------
-- Generate next document number (v2: respects rule row year_reset & branch_based)
-- ----------------------------------------------------------------------------
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
AS $$
DECLARE
  v_rule RECORD;
  v_prefix TEXT;
  v_next INTEGER;
  v_year INTEGER;
  v_seq_year INTEGER;
  v_seq_branch UUID;
  v_doc_type TEXT;
  v_padding INTEGER;
  v_current_year INTEGER;
BEGIN
  v_current_year := EXTRACT(YEAR FROM now())::INTEGER;
  v_doc_type := UPPER(TRIM(p_document_type));

  -- 1) Get or create RULE row (company, sentinel, document_type, current_year)
  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding,
    year_reset, branch_based, updated_at
  )
  VALUES (
    p_company_id,
    public.erp_numbering_global_branch_sentinel(),
    v_doc_type,
    public.erp_document_default_prefix(p_document_type),
    v_current_year,
    0,
    4,
    true,
    false,
    now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year)
  DO NOTHING;

  SELECT prefix, padding, COALESCE(year_reset, true) AS year_reset, COALESCE(branch_based, false) AS branch_based
  INTO v_rule
  FROM public.erp_document_sequences
  WHERE company_id = p_company_id
    AND branch_id = public.erp_numbering_global_branch_sentinel()
    AND document_type = v_doc_type
    AND year = v_current_year
  LIMIT 1;

  IF v_rule IS NULL THEN
    v_rule.prefix := public.erp_document_default_prefix(p_document_type);
    v_rule.padding := 4;
    v_rule.year_reset := true;
    v_rule.branch_based := false;
  END IF;

  -- 2) Sequence key: year = current year or 0 (no reset); branch = sentinel or p_branch_id
  v_seq_year := CASE WHEN v_rule.year_reset THEN v_current_year ELSE 0 END;
  v_seq_branch := CASE WHEN v_rule.branch_based AND p_branch_id IS NOT NULL
    THEN p_branch_id ELSE public.erp_numbering_global_branch_sentinel() END;

  -- 3) Increment sequence row (create if missing: first number = 1)
  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
  )
  VALUES (
    p_company_id,
    v_seq_branch,
    v_doc_type,
    v_rule.prefix,
    v_seq_year,
    1,
    GREATEST(COALESCE(v_rule.padding, 4), 1),
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

  v_year := v_seq_year;

  IF p_include_year AND v_year > 0 THEN
    RETURN v_prefix || '-' || RIGHT(v_year::TEXT, 2) || '-' || LPAD(v_next::TEXT, GREATEST(COALESCE(v_padding, 4), 1), '0');
  ELSE
    RETURN v_prefix || '-' || LPAD(v_next::TEXT, GREATEST(COALESCE(v_padding, 4), 1), '0');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.generate_document_number(UUID, UUID, TEXT, BOOLEAN) IS
  'ERP Numbering: next number. Respects year_reset (year=0 = no reset) and branch_based from rule row.';

-- ============================================================================
-- DELETED DOCUMENT NUMBER AUDIT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.erp_document_number_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  reason TEXT,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_doc_audit_company_type
  ON public.erp_document_number_audit(company_id, document_type);
CREATE INDEX IF NOT EXISTS idx_erp_doc_audit_deleted_at
  ON public.erp_document_number_audit(deleted_at);

COMMENT ON TABLE public.erp_document_number_audit IS 'Audit of cancelled/deleted document numbers (invoice_no, po_no, etc.) – numbers are never reused.';

-- RLS
DO $rls$
BEGIN
  ALTER TABLE public.erp_document_number_audit ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "erp_doc_audit_select" ON public.erp_document_number_audit;
  DROP POLICY IF EXISTS "erp_doc_audit_insert" ON public.erp_document_number_audit;
  CREATE POLICY "erp_doc_audit_select" ON public.erp_document_number_audit
    FOR SELECT TO authenticated USING (company_id = (SELECT get_user_company_id()));
  CREATE POLICY "erp_doc_audit_insert" ON public.erp_document_number_audit
    FOR INSERT TO authenticated WITH CHECK (company_id = (SELECT get_user_company_id()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'erp_document_number_audit RLS: %', SQLERRM;
END $rls$;

-- RPC: log a deleted/cancelled document number (call from app on cancel/delete)
CREATE OR REPLACE FUNCTION public.log_deleted_document_number(
  p_company_id UUID,
  p_document_type TEXT,
  p_document_number TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.erp_document_number_audit (
    company_id, document_type, document_number, reference_type, reference_id, reason, created_by
  )
  VALUES (
    p_company_id,
    UPPER(TRIM(p_document_type)),
    NULLIF(TRIM(p_document_number), ''),
    p_reference_type,
    p_reference_id,
    p_reason,
    p_created_by
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_deleted_document_number(UUID, TEXT, TEXT, TEXT, UUID, TEXT, UUID) IS
  'Log a cancelled/deleted document number for audit; numbers are never reused.';
