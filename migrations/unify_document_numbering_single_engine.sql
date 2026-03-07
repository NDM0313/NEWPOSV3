-- ============================================================================
-- UNIFY DOCUMENT NUMBERING: Single ERP Engine
-- ============================================================================
-- Problem: Mobile and some code call get_next_document_number (document_sequences);
-- Web and Settings use generate_document_number (erp_document_sequences).
-- Goal: All modules use the same engine (Settings → erp_document_sequences).
--
-- This migration makes get_next_document_number a thin wrapper around
-- generate_document_number so that:
--   • Mobile (and any caller) gets numbers from the same sequence as Web.
--   • Settings → Numbering Rules (prefix, digits, year reset, branch based)
--     remain the single source of truth.
-- ============================================================================

-- Wrapper: get_next_document_number → generate_document_number (p_include_year = false)
-- Callers keep same signature; backend uses erp_document_sequences.
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  p_company_id UUID,
  p_branch_id UUID,
  p_document_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.generate_document_number(
    p_company_id,
    p_branch_id,
    COALESCE(NULLIF(TRIM(p_document_type), ''), 'sale'),
    false  -- p_include_year: format PREFIX-NNNN (e.g. SL-0001), not PREFIX-YY-NNNN
  );
END;
$$;

COMMENT ON FUNCTION public.get_next_document_number(UUID, UUID, TEXT) IS
  'Unified numbering: delegates to generate_document_number. Use same engine as Settings → Numbering Rules.';
