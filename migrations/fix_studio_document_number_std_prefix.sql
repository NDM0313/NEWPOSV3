-- Fix Studio Sale document number: use STD- prefix (not STU-) so Studio Sales list shows correctly.
-- Studio Sales list filters by invoice_no ILIKE 'STD-%'. Without this, Studio Sale from mobile/tablet would get STU-xxx and not appear.
-- Run in Supabase SQL Editor.

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
  DO UPDATE SET current_number = document_sequences.current_number + 1
  RETURNING prefix, current_number, padding INTO v_prefix, v_current_number, v_padding;

  v_new_number := v_prefix || LPAD(v_current_number::TEXT, v_padding, '0');
  RETURN v_new_number;
END;
$$ LANGUAGE plpgsql;

-- Ensure existing studio sequences use STD- (in case they were created with STU-)
UPDATE document_sequences
SET prefix = 'STD-'
WHERE document_type = 'studio' AND (prefix IS NULL OR prefix != 'STD-');
