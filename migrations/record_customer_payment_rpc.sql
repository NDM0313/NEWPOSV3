-- ============================================================================
-- record_customer_payment: Atomic RPC for mobile "Receive Payment from Customer"
-- Double-entry: Dr Cash/Bank, Cr Accounts Receivable. Updates sale paid/due.
--
-- HOW TO FIX "Could not find the function ... in the schema cache":
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Paste and run this ENTIRE file (Run)
-- 3. If you use self-hosted Supabase/PostgREST, reload schema:
--    NOTIFY pgrst, 'reload schema';
-- ============================================================================

-- Ensure enums exist (skip if already present)
DO $$
BEGIN
  CREATE TYPE payment_method_enum AS ENUM ('cash', 'bank', 'card', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  CREATE TYPE payment_type AS ENUM ('received', 'paid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'unpaid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION record_customer_payment(
  p_company_id UUID,
  p_customer_id UUID,
  p_reference_id UUID,  -- sale id (invoice)
  p_amount NUMERIC(15,2),
  p_account_id UUID,
  p_payment_method TEXT,
  p_payment_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_branch_id UUID;
  v_ar_account_id UUID;
  v_payment_id UUID;
  v_journal_entry_id UUID;
  v_ref_no VARCHAR(100);
  v_method payment_method_enum;
BEGIN
  -- Validate amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than 0');
  END IF;

  -- Validate account belongs to company
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_account_id AND company_id = p_company_id AND is_active = true) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive payment account');
  END IF;

  -- Get sale and validate
  SELECT id, company_id, branch_id, customer_id, total, paid_amount, due_amount, invoice_no, status
    INTO v_sale
  FROM sales
  WHERE id = p_reference_id;

  IF v_sale.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sale not found');
  END IF;

  IF v_sale.company_id != p_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Sale does not belong to company');
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot receive payment for cancelled sale');
  END IF;

  IF p_customer_id IS NOT NULL AND v_sale.customer_id IS NOT NULL AND v_sale.customer_id != p_customer_id THEN
    RETURN json_build_object('success', false, 'error', 'Sale does not belong to this customer');
  END IF;

  v_branch_id := v_sale.branch_id;

  -- Normalize payment method to enum
  v_method := CASE LOWER(TRIM(COALESCE(p_payment_method, 'cash')))
    WHEN 'bank' THEN 'bank'::payment_method_enum
    WHEN 'card' THEN 'card'::payment_method_enum
    WHEN 'wallet' THEN 'other'::payment_method_enum
    WHEN 'mobile_wallet' THEN 'other'::payment_method_enum
    ELSE 'cash'::payment_method_enum
  END;

  -- Get A/R account (company-scoped)
  SELECT id INTO v_ar_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND (code = '1100' OR LOWER(name) LIKE '%receivable%')
  LIMIT 1;

  IF v_ar_account_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Accounts Receivable account not found. Configure chart of accounts.');
  END IF;

  -- Generate reference number (reuse document_sequences if 'payment' exists, else simple)
  BEGIN
    v_ref_no := get_next_document_number(p_company_id, v_branch_id, 'payment');
  EXCEPTION
    WHEN OTHERS THEN
      v_ref_no := 'PMT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END;

  -- ========== ATOMIC TRANSACTION ==========
  -- 1. Insert payment
  INSERT INTO payments (
    company_id, branch_id, payment_type, reference_type, reference_id,
    amount, payment_method, payment_date, payment_account_id,
    reference_number, notes, created_by
  )
  VALUES (
    p_company_id, v_branch_id, 'received'::payment_type, 'sale', p_reference_id,
    p_amount, v_method, p_payment_date, p_account_id,
    v_ref_no, p_notes, p_created_by
  )
  RETURNING id INTO v_payment_id;

  -- 2. Journal entry header
  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by
  )
  VALUES (
    p_company_id, v_branch_id,
    'JE-' || TO_CHAR(p_payment_date, 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'),
    p_payment_date,
    'Payment received: ' || COALESCE(v_sale.invoice_no, p_reference_id::TEXT),
    'payment',
    v_payment_id,
    p_created_by
  )
  RETURNING id INTO v_journal_entry_id;

  -- 3. Debit: Cash/Bank (selected account)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, p_account_id, p_amount, 0, 'Payment received');

  -- 4. Credit: Accounts Receivable
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_ar_account_id, 0, p_amount, 'Accounts Receivable decrease');

  -- 5. Update sale paid/due/status
  UPDATE sales
  SET
    paid_amount = COALESCE(paid_amount, 0) + p_amount,
    due_amount = GREATEST(0, total - (COALESCE(paid_amount, 0) + p_amount)),
    payment_status = (CASE
      WHEN (COALESCE(paid_amount, 0) + p_amount) >= total THEN 'paid'
      WHEN (COALESCE(paid_amount, 0) + p_amount) > 0 THEN 'partial'
      ELSE 'unpaid'
    END)::payment_status
  WHERE id = p_reference_id;

  RETURN json_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'journal_entry_id', v_journal_entry_id,
    'reference_number', v_ref_no
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION record_customer_payment(UUID, UUID, UUID, NUMERIC, UUID, TEXT, DATE, TEXT, UUID) IS
  'Atomic: insert payment, create journal (Dr Cash/Bank, Cr A/R), update sale. Used by mobile Receive Payment.';

-- Reload PostgREST schema cache (self-hosted Supabase).
NOTIFY pgrst, 'reload schema';
