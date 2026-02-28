-- ============================================================================
-- GLOBAL DOCUMENT SEQUENCES (COMPANY-LEVEL ONLY)
-- Serial numbers per company; no user/branch-based numbering.
-- Types: SL (sale), PUR (purchase), PAY (payment), RNT (rental).
-- ============================================================================

-- Table: one row per (company_id, document_type); current_number is the last assigned.
CREATE TABLE IF NOT EXISTS public.document_sequences_global (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  current_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, document_type)
);

COMMENT ON TABLE public.document_sequences_global IS 'Global document numbering per company. Used by get_next_document_number_global().';

-- RLS
ALTER TABLE public.document_sequences_global ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_sequences_global_select" ON public.document_sequences_global;
DROP POLICY IF EXISTS "document_sequences_global_insert" ON public.document_sequences_global;
DROP POLICY IF EXISTS "document_sequences_global_update" ON public.document_sequences_global;

CREATE POLICY "document_sequences_global_select"
  ON public.document_sequences_global FOR SELECT TO authenticated
  USING (company_id = (SELECT get_user_company_id()));

CREATE POLICY "document_sequences_global_insert"
  ON public.document_sequences_global FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_user_company_id()));

CREATE POLICY "document_sequences_global_update"
  ON public.document_sequences_global FOR UPDATE TO authenticated
  USING (company_id = (SELECT get_user_company_id()))
  WITH CHECK (company_id = (SELECT get_user_company_id()));

-- Atomic next number; returns e.g. 'SL-0001', 'PAY-0001'
CREATE OR REPLACE FUNCTION public.get_next_document_number_global(
  p_company_id UUID,
  p_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next BIGINT;
  v_prefix TEXT;
BEGIN
  v_prefix := CASE UPPER(TRIM(p_type))
    WHEN 'SL' THEN 'SL-'
    WHEN 'DRAFT' THEN 'DRAFT-'
    WHEN 'QT' THEN 'QT-'
    WHEN 'SO' THEN 'SO-'
    WHEN 'PUR' THEN 'PUR-'
    WHEN 'PAY' THEN 'PAY-'
    WHEN 'RNT' THEN 'RNT-'
    WHEN 'STD' THEN 'STD-'
    ELSE UPPER(TRIM(p_type)) || '-'
  END;

  UPDATE public.document_sequences_global
  SET current_number = current_number + 1,
      updated_at = NOW()
  WHERE company_id = p_company_id
    AND document_type = UPPER(TRIM(p_type))
  RETURNING current_number INTO v_next;

  IF v_next IS NULL THEN
    INSERT INTO public.document_sequences_global (company_id, document_type, current_number)
    VALUES (p_company_id, UPPER(TRIM(p_type)), 1)
    RETURNING current_number INTO v_next;
  END IF;

  RETURN v_prefix || LPAD(v_next::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.get_next_document_number_global(UUID, TEXT) IS 'Returns next global document number for company (e.g. SL-0001). Call from app before insert; do not generate numbers in frontend.';
