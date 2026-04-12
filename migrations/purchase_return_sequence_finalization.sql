-- ============================================================================
-- PURCHASE RETURN SEQUENCE FINALIZATION
-- Purpose : Finalize the purchase return numbering system.
--           1. Patch erp_document_default_prefix() to map PURCHASE_RETURN → PRET-
--           2. Seed purchase_return sequences for all existing companies/branches
-- Context : 39_PURCHASE_RETURN_NUMBERING_DECISION.md
--           43_PURCHASE_RETURN_NUMBERING_IMPLEMENTATION.md
-- Non-destructive: wraps in DO...EXCEPTION blocks.
-- ============================================================================

-- Step 1: Patch erp_document_default_prefix() to add PURCHASE_RETURN → PRET-
DO $$
BEGIN
  EXECUTE $exec$
CREATE OR REPLACE FUNCTION public.erp_document_default_prefix(p_document_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $body$
  SELECT CASE UPPER(TRIM(p_document_type))
    WHEN 'SALE'             THEN 'SL'
    WHEN 'PURCHASE'         THEN 'PUR'
    WHEN 'PURCHASE_RETURN'  THEN 'PRET-'
    WHEN 'PAYMENT'          THEN 'PAY'
    WHEN 'SUPPLIER_PAYMENT' THEN 'PAY'
    WHEN 'CUSTOMER_RECEIPT' THEN 'RCP'
    WHEN 'EXPENSE'          THEN 'EXP'
    WHEN 'RENTAL'           THEN 'REN'
    WHEN 'STOCK'            THEN 'STK'
    WHEN 'STOCK_ADJUSTMENT' THEN 'STK'
    WHEN 'JOURNAL'          THEN 'JE'
    WHEN 'PRODUCT'          THEN 'PRD'
    WHEN 'STUDIO'           THEN 'STD'
    WHEN 'JOB'              THEN 'JOB'
    WHEN 'POS'              THEN 'POS'
    ELSE UPPER(TRIM(p_document_type))
  END;
$body$;
$exec$;
  RAISE NOTICE 'purchase_return_sequence_finalization: erp_document_default_prefix() updated with PURCHASE_RETURN → PRET-';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'purchase_return_sequence_finalization: Could not update erp_document_default_prefix: %', SQLERRM;
END $$;


-- Step 2: Seed purchase_return sequences for all existing companies/branches
-- Uses each company's 'purchase' sequence entries as the template for which
-- (company_id, branch_id) combinations to seed. This ensures all companies that
-- can generate purchase orders also get a purchase return sequence.
-- Prefix 'PRET-', padding 4, last_number 0 (first number will be PRET-0001).
DO $$
DECLARE
  v_seeded INTEGER := 0;
BEGIN
  INSERT INTO public.erp_document_sequences (
    company_id,
    branch_id,
    document_type,
    prefix,
    year,
    last_number,
    padding,
    created_at,
    updated_at
  )
  SELECT
    eds.company_id,
    eds.branch_id,
    'purchase_return'            AS document_type,
    'PRET-'                      AS prefix,
    EXTRACT(YEAR FROM NOW())::INTEGER AS year,
    0                            AS last_number,
    4                            AS padding,
    NOW()                        AS created_at,
    NOW()                        AS updated_at
  FROM public.erp_document_sequences eds
  WHERE eds.document_type = 'purchase'
  ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;

  GET DIAGNOSTICS v_seeded = ROW_COUNT;
  RAISE NOTICE 'purchase_return_sequence_finalization: % purchase_return sequence(s) seeded', v_seeded;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'purchase_return_sequence_finalization: Seed failed: %', SQLERRM;
END $$;


-- Verification
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.erp_document_sequences
  WHERE document_type = 'purchase_return';
  RAISE NOTICE 'purchase_return_sequence_finalization: purchase_return sequences in DB: %', v_count;
END $$;
