-- Fix payment_method enum casting in trigger
CREATE OR REPLACE FUNCTION record_initial_sale_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_payment_method payment_method_enum;
  v_reference_number VARCHAR(100);
BEGIN
  -- Only process if sale has initial payment
  IF NEW.paid_amount > 0 AND NEW.payment_method IS NOT NULL THEN
    -- Get default account based on payment method
    SELECT id INTO v_account_id
    FROM accounts
    WHERE company_id = NEW.company_id
      AND (
        (LOWER(NEW.payment_method::TEXT) = 'cash' AND code = '1000') OR
        (LOWER(NEW.payment_method::TEXT) IN ('bank', 'card') AND code = '1010')
      )
    LIMIT 1;
    
    -- If no account found, use Cash as default
    IF v_account_id IS NULL THEN
      SELECT id INTO v_account_id
      FROM accounts
      WHERE company_id = NEW.company_id AND code = '1000'
      LIMIT 1;
    END IF;
    
    -- Only record if account found and payment doesn't already exist
    IF v_account_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM payments 
      WHERE reference_type = 'sale' 
        AND reference_id = NEW.id
        AND ABS(amount - NEW.paid_amount) < 0.01
    ) THEN
      -- Generate reference number
      v_reference_number := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);
      
      -- Normalize payment method to enum (CRITICAL FIX)
      v_payment_method := CASE 
        WHEN LOWER(NEW.payment_method::TEXT) IN ('cash') THEN 'cash'::payment_method_enum
        WHEN LOWER(NEW.payment_method::TEXT) IN ('bank', 'card', 'cheque') THEN 'bank'::payment_method_enum
        ELSE 'cash'::payment_method_enum
      END;
      
      -- Insert payment record
      INSERT INTO payments (
        company_id,
        branch_id,
        payment_type,
        reference_type,
        reference_id,
        amount,
        payment_method,
        payment_date,
        payment_account_id,
        reference_number,
        created_by
      ) VALUES (
        NEW.company_id,
        NEW.branch_id,
        'received',
        'sale',
        NEW.id,
        NEW.paid_amount,
        v_payment_method, -- Use enum value
        NEW.invoice_date,
        v_account_id,
        v_reference_number,
        NEW.created_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
