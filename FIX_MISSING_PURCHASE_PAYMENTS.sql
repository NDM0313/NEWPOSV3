-- ============================================
-- FIX MISSING PURCHASE PAYMENTS
-- ============================================
-- This script backfills missing payment records for purchases
-- that have paid_amount > 0 but no corresponding payment entries in payments table
--
-- Date: 2026-01-30
-- Issue: Purchase PUR0014 (and possibly others) have paid_amount > 0
--        but no payment records in payments table
-- ============================================

DO $$
DECLARE
  v_purchase RECORD;
  v_payment_count INTEGER;
  v_payment_ref TEXT;
  v_account_id UUID;
  v_company_id UUID;
  v_branch_id UUID;
  v_payment_method TEXT;
  v_next_payment_number INTEGER;
BEGIN
  -- Loop through all purchases with paid_amount > 0
  FOR v_purchase IN
    SELECT 
      p.id,
      p.po_no,
      p.company_id,
      p.branch_id,
      p.paid_amount,
      p.due_amount,
      p.total,
      p.payment_status,
      p.payment_method,
      p.po_date,
      p.created_at
    FROM purchases p
    WHERE p.paid_amount > 0
      AND NOT EXISTS (
        SELECT 1 
        FROM payments pay
        WHERE pay.reference_type = 'purchase'
          AND pay.reference_id = p.id
      )
    ORDER BY p.created_at ASC
  LOOP
    -- Check if payment already exists
    SELECT COUNT(*) INTO v_payment_count
    FROM payments
    WHERE reference_type = 'purchase'
      AND reference_id = v_purchase.id;
    
    -- Only create payment if none exists
    IF v_payment_count = 0 THEN
      -- Get company_id and branch_id
      v_company_id := v_purchase.company_id;
      v_branch_id := v_purchase.branch_id;
      
      -- Determine payment method (default to 'cash' if null)
      v_payment_method := COALESCE(
        NULLIF(v_purchase.payment_method, ''),
        'cash'
      );
      
      -- Normalize payment method to enum format
      v_payment_method := CASE 
        WHEN LOWER(v_payment_method) IN ('cash', 'Cash') THEN 'cash'
        WHEN LOWER(v_payment_method) IN ('bank', 'Bank') THEN 'bank'
        WHEN LOWER(v_payment_method) IN ('card', 'Card') THEN 'card'
        ELSE 'cash'  -- Default to cash
      END;
      
      -- Get default Cash account for this company
      SELECT id INTO v_account_id
      FROM accounts
      WHERE company_id = v_company_id
        AND (
          code = '1000' 
          OR LOWER(name) = 'cash'
        )
        AND is_active = true
      ORDER BY code = '1000' DESC, created_at ASC
      LIMIT 1;
      
      -- If no Cash account found, try Bank account
      IF v_account_id IS NULL THEN
        SELECT id INTO v_account_id
        FROM accounts
        WHERE company_id = v_company_id
          AND (
            code = '1010' 
            OR LOWER(name) = 'bank'
          )
          AND is_active = true
        ORDER BY code = '1010' DESC, created_at ASC
        LIMIT 1;
      END IF;
      
      -- If still no account found, get any active account
      IF v_account_id IS NULL THEN
        SELECT id INTO v_account_id
        FROM accounts
        WHERE company_id = v_company_id
          AND is_active = true
        ORDER BY created_at ASC
        LIMIT 1;
      END IF;
      
      -- Generate payment reference number
      -- Get next payment number from document_sequences (correct table name)
      SELECT COALESCE(current_number, 0) + 1 INTO v_next_payment_number
      FROM document_sequences
      WHERE company_id = v_company_id
        AND (branch_id IS NULL OR branch_id = v_branch_id)
        AND document_type = 'payment'
      LIMIT 1;
      
      -- If no numbering record exists, create one
      IF v_next_payment_number IS NULL THEN
        INSERT INTO document_sequences (company_id, branch_id, document_type, prefix, current_number, padding)
        VALUES (v_company_id, v_branch_id, 'payment', 'PAY-', 0, 4)
        ON CONFLICT DO NOTHING
        RETURNING current_number + 1 INTO v_next_payment_number;
        
        IF v_next_payment_number IS NULL THEN
          v_next_payment_number := 1;
        END IF;
      END IF;
      
      -- Format payment reference
      v_payment_ref := 'PAY-' || LPAD(v_next_payment_number::TEXT, 4, '0');
      
      -- Create payment record
      INSERT INTO payments (
        company_id,
        branch_id,
        payment_type,
        reference_type,
        reference_id,
        amount,
        payment_method,
        payment_account_id,
        payment_date,
        reference_number,
        notes,
        created_at
      )
      VALUES (
        v_company_id,
        v_branch_id,
        'paid',
        'purchase',
        v_purchase.id,
        v_purchase.paid_amount,
        v_payment_method,
        v_account_id,
        COALESCE(v_purchase.po_date, v_purchase.created_at::DATE, CURRENT_DATE),
        v_payment_ref,
        'Auto-created payment record for purchase ' || v_purchase.po_no,
        COALESCE(v_purchase.created_at, NOW())
      );
      
      -- Increment payment number in document_sequences
      UPDATE document_sequences
      SET current_number = v_next_payment_number,
          updated_at = NOW()
      WHERE company_id = v_company_id
        AND (branch_id IS NULL OR branch_id = v_branch_id)
        AND document_type = 'payment';
      
      -- If update didn't affect any rows, insert the record
      IF NOT FOUND THEN
        INSERT INTO document_sequences (company_id, branch_id, document_type, prefix, current_number, padding)
        VALUES (v_company_id, v_branch_id, 'payment', 'PAY-', v_next_payment_number, 4)
        ON CONFLICT DO NOTHING;
      END IF;
      
      RAISE NOTICE '✅ Created payment record for purchase % (ID: %): Amount = %, Method = %, Account = %, Ref = %',
        v_purchase.po_no,
        v_purchase.id,
        v_purchase.paid_amount,
        v_payment_method,
        v_account_id,
        v_payment_ref;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Payment backfill completed';
END $$;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify the fix:
-- 
-- SELECT 
--   p.po_no,
--   p.paid_amount,
--   COUNT(pay.id) as payment_count,
--   SUM(pay.amount) as total_payments
-- FROM purchases p
-- LEFT JOIN payments pay ON pay.reference_type = 'purchase' AND pay.reference_id = p.id
-- WHERE p.paid_amount > 0
-- GROUP BY p.id, p.po_no, p.paid_amount
-- HAVING COUNT(pay.id) = 0 OR ABS(SUM(COALESCE(pay.amount, 0)) - p.paid_amount) > 0.01
-- ORDER BY p.po_no;
-- 
-- This should return 0 rows if all payments are properly recorded.
