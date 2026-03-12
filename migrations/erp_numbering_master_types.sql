-- ============================================================================
-- ERP NUMBERING: Master record types (Product, Customer, Supplier, Worker, Job)
-- ============================================================================
-- Extends erp_document_default_prefix so Product/Customer/Supplier/Worker/Studio Job
-- use the same numbering engine as documents. Run after erp_numbering_engine.sql
-- and erp_numbering_next_step.sql.
-- ============================================================================

-- Extend default prefix function to include master types (CUS, SUP, WRK; PRD/JOB already exist)
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
    WHEN 'CUSTOMER' THEN 'CUS'
    WHEN 'SUPPLIER' THEN 'SUP'
    WHEN 'WORKER' THEN 'WRK'
    ELSE UPPER(TRIM(p_document_type))
  END;
$body$;
$exec$;
  EXECUTE 'COMMENT ON FUNCTION public.erp_document_default_prefix(TEXT) IS ''Default prefix per document/master type. Documents: SL, PUR, PAY, etc. Masters: PRD, CUS, SUP, WRK, JOB.''';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'erp_numbering_master_types: Could not replace erp_document_default_prefix: %', SQLERRM;
END $$;
