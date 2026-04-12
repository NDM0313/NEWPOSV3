-- Customer receipts: RCV- sequence (document_type customer_receipt).
-- Supplier/worker/courier outgoing payments keep PAY- (document_type payment).
-- Run as DB owner if replace fails.

CREATE OR REPLACE FUNCTION public.erp_document_default_prefix(p_document_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $body$
  SELECT CASE UPPER(TRIM(p_document_type))
    WHEN 'SALE' THEN 'SL'
    WHEN 'PURCHASE' THEN 'PUR'
    WHEN 'PAYMENT' THEN 'PAY'
    WHEN 'SUPPLIER_PAYMENT' THEN 'PAY'
    WHEN 'CUSTOMER_RECEIPT' THEN 'RCV'
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

COMMENT ON FUNCTION public.erp_document_default_prefix(TEXT) IS
  'Default prefix per document type. Customer receipts: CUSTOMER_RECEIPT → RCV; outgoing payments: PAYMENT/SUPPLIER_PAYMENT → PAY.';
