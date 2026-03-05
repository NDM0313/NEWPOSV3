-- Fix duplicate invoice number: get_next_document_number MUST increment in DB.
-- Run this ENTIRE script in Supabase SQL Editor. Do NOT remove sales_company_branch_invoice_unique.
-- Table: document_sequences (company_id, branch_id, document_type).

CREATE OR REPLACE FUNCTION get_next_document_number(
  p_company_id UUID,
  p_branch_id UUID,
  p_document_type VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_current_number INTEGER;
  v_padding INTEGER;
  v_new_number VARCHAR;
BEGIN
  -- Single atomic step: insert or lock row, then increment and return. No separate SELECT.
  INSERT INTO document_sequences (company_id, branch_id, document_type, prefix, current_number, padding)
  VALUES (
    p_company_id,
    p_branch_id,
    p_document_type,
    CASE p_document_type
      WHEN 'sale' THEN 'SL-'
      WHEN 'purchase' THEN 'PO-'
      WHEN 'expense' THEN 'EXP-'
      WHEN 'rental' THEN 'RNT-'
      WHEN 'studio' THEN 'STD-'
      WHEN 'journal' THEN 'JE-'
      WHEN 'payment' THEN 'PMT-'
      WHEN 'receipt' THEN 'RCP-'
      WHEN 'product' THEN 'PRD-'
      ELSE 'DOC-'
    END,
    0,
    4
  )
  ON CONFLICT (company_id, branch_id, document_type)
  DO UPDATE SET
    current_number = document_sequences.current_number + 1,
    updated_at = NOW()
  RETURNING prefix, current_number, padding
  INTO v_prefix, v_current_number, v_padding;

  IF v_prefix IS NULL OR v_current_number IS NULL THEN
    RAISE EXCEPTION 'document_sequences row missing for company_id=%, branch_id=%, document_type=%', p_company_id, p_branch_id, p_document_type;
  END IF;

  v_new_number := v_prefix || LPAD(v_current_number::TEXT, COALESCE(v_padding, 4), '0');
  RETURN v_new_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_document_number(UUID, UUID, VARCHAR) IS 'Returns next document number. ON CONFLICT DO UPDATE increments current_number atomically to prevent duplicate invoice/PO.';

-- Optional one-time fix: set sequence to max existing invoice number so next number is never already used.
-- Run once if you had duplicates (replace your company_id/branch_id or run for all rows).
/*
UPDATE document_sequences ds
SET current_number = COALESCE(
  (SELECT MAX(
    CAST(REGEXP_REPLACE(s.invoice_no, '^[^0-9]+', '') AS INTEGER)
  ) FROM sales s
   WHERE s.company_id = ds.company_id AND s.branch_id = ds.branch_id),
  0
)
WHERE ds.document_type = 'sale';
*/
