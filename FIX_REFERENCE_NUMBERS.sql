-- Fix reference numbers to sequential format
-- Use a cursor-based approach instead of window functions

DO $$
DECLARE
  payment_record RECORD;
  company_record RECORD;
  v_sequence INTEGER;
  v_year VARCHAR := TO_CHAR(NOW(), 'YYYY');
  v_prefix VARCHAR := 'PAY';
BEGIN
  -- Process each company separately
  FOR company_record IN SELECT DISTINCT company_id FROM payments WHERE reference_type = 'sale'
  LOOP
    v_sequence := 0;
    
    -- Get max sequence for this company
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(reference_number FROM '[0-9]+$') AS INTEGER)
    ), 0)
    INTO v_sequence
    FROM payments
    WHERE company_id = company_record.company_id
      AND reference_number ~ '^PAY-[0-9]{4}-[0-9]+$';
    
    -- Update payments for this company with sequential numbers
    FOR payment_record IN 
      SELECT id, created_at
      FROM payments
      WHERE company_id = company_record.company_id
        AND reference_type = 'sale'
        AND (reference_number LIKE 'PAY-%' AND reference_number !~ '^PAY-[0-9]{4}-[0-9]+$')
      ORDER BY created_at
    LOOP
      v_sequence := v_sequence + 1;
      UPDATE payments
      SET reference_number = v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0')
      WHERE id = payment_record.id;
    END LOOP;
  END LOOP;
END $$;

-- Verify
SELECT reference_number, amount, payment_date 
FROM payments 
WHERE reference_type = 'sale'
ORDER BY created_at
LIMIT 10;
