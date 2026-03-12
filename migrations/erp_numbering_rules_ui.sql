-- ============================================================================
-- ERP NUMBERING RULES UI – year_reset & branch_based columns
-- ============================================================================
-- Adds columns for Settings → Numbering Rules: Year Reset, Branch Based.
-- Table remains erp_document_sequences; generate_document_number() unchanged.
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE public.erp_document_sequences
    ADD COLUMN IF NOT EXISTS year_reset boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS branch_based boolean DEFAULT false;
  COMMENT ON COLUMN public.erp_document_sequences.year_reset IS 'When true, sequence resets per year (default). UI: Year Reset toggle.';
  COMMENT ON COLUMN public.erp_document_sequences.branch_based IS 'When true, use branch_id for sequence; when false, use company-level (sentinel). UI: Branch Based toggle.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'erp_numbering_rules_ui: %', SQLERRM;
END $$;
