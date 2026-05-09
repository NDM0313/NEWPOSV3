-- ============================================================================
-- record_payment_with_accounting: company-scoped PAY sequence (sentinel branch)
-- ============================================================================
-- payments_reference_number_unique is UNIQUE (company_id, reference_number).
-- generate_document_number keys erp_document_sequences by branch_id; multiple
-- branches could emit the same PAY-nnnn under concurrency. Allocate PAY refs using
-- erp_numbering_global_branch_sentinel() so one sequence row per company/year
-- matches company-wide uniqueness. Operational branch_id on payments rows is
-- unchanged (still v_branch_id from purchase/sale/etc.).
--
-- Ref allocation remains outside the INSERT exception block (see 20260509180000).

CREATE OR REPLACE FUNCTION public.record_payment_with_accounting(
  p_company_id UUID,
  p_branch_id UUID,
  p_payment_type payment_type,
  p_reference_type VARCHAR(50),
  p_reference_id UUID,
  p_amount DECIMAL(15,2),
  p_payment_method payment_method_enum,
  p_payment_date DATE,
  p_payment_account_id UUID,
  p_reference_number VARCHAR(100),
  p_notes TEXT,
  p_created_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
  v_journal_entry_id UUID;
  v_ar_account_id UUID;
  v_ap_account_id UUID;
  v_expense_account_id UUID;
  v_cash_account_id UUID;
  v_bank_account_id UUID;
  v_payment_account UUID;
  v_branch_id UUID;
  v_sale_record RECORD;
  v_purchase_record RECORD;
  v_expense_record RECORD;
  v_rental_record RECORD;
  v_rental_total NUMERIC := 0;
  v_ref_no VARCHAR(100);
  v_try INTEGER := 0;
  v_max_retries INTEGER := 15;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than 0');
  END IF;

  SELECT id INTO v_cash_account_id
  FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
  SELECT id INTO v_bank_account_id
  FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;

  IF p_payment_account_id IS NOT NULL THEN
    v_payment_account := p_payment_account_id;
  ELSIF p_payment_method = 'cash' THEN
    v_payment_account := v_cash_account_id;
  ELSE
    v_payment_account := v_bank_account_id;
  END IF;

  v_branch_id := p_branch_id;

  IF p_reference_type = 'sale' THEN
    SELECT * INTO v_sale_record FROM sales WHERE id = p_reference_id;
    IF v_sale_record.id IS NOT NULL THEN
      v_branch_id := COALESCE(v_branch_id, v_sale_record.branch_id);
      v_ar_account_id := public._ensure_ar_subaccount_for_contact(p_company_id, v_sale_record.customer_id);
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
    END IF;

  ELSIF p_reference_type = 'purchase' THEN
    SELECT * INTO v_purchase_record FROM purchases WHERE id = p_reference_id;
    IF v_purchase_record.id IS NOT NULL THEN
      v_branch_id := COALESCE(v_branch_id, v_purchase_record.branch_id);
      v_ap_account_id := public._ensure_ap_subaccount_for_contact(p_company_id, v_purchase_record.supplier_id);
      UPDATE purchases
      SET
        paid_amount = COALESCE(paid_amount, 0) + p_amount,
        due_amount = GREATEST(0, total - (COALESCE(paid_amount, 0) + p_amount)),
        payment_status = (CASE
          WHEN (COALESCE(paid_amount, 0) + p_amount) >= total THEN 'paid'
          WHEN (COALESCE(paid_amount, 0) + p_amount) > 0 THEN 'partial'
          ELSE 'unpaid'
        END)::payment_status
      WHERE id = p_reference_id;
    END IF;

  ELSIF p_reference_type = 'rental' THEN
    SELECT * INTO v_rental_record FROM rentals WHERE id = p_reference_id;
    IF v_rental_record.id IS NOT NULL THEN
      v_branch_id := COALESCE(v_branch_id, v_rental_record.branch_id);
      v_ar_account_id := public._ensure_ar_subaccount_for_contact(p_company_id, v_rental_record.customer_id);
      v_rental_total := CASE
        WHEN COALESCE(to_jsonb(v_rental_record)->>'total_amount', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          THEN (to_jsonb(v_rental_record)->>'total_amount')::numeric
        WHEN COALESCE(to_jsonb(v_rental_record)->>'total', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          THEN (to_jsonb(v_rental_record)->>'total')::numeric
        ELSE 0
      END;
      UPDATE rentals
      SET
        paid_amount = COALESCE(paid_amount, 0) + p_amount,
        due_amount = GREATEST(0, v_rental_total - (COALESCE(paid_amount, 0) + p_amount))
      WHERE id = p_reference_id;
    END IF;

  ELSIF p_reference_type = 'expense' THEN
    SELECT * INTO v_expense_record FROM expenses WHERE id = p_reference_id;
    IF v_expense_record.id IS NOT NULL THEN
      v_branch_id := COALESCE(v_branch_id, v_expense_record.branch_id);
      UPDATE expenses SET status = 'paid' WHERE id = p_reference_id;
    END IF;
  END IF;

  -- Company-wide PAY ref via sentinel branch; payments.branch_id stays operational (v_branch_id).
  LOOP
    v_try := v_try + 1;

    IF p_reference_number IS NOT NULL AND TRIM(p_reference_number) <> '' AND v_try = 1 THEN
      v_ref_no := TRIM(p_reference_number);
    ELSE
      BEGIN
        v_ref_no := public.generate_document_number(
          p_company_id,
          public.erp_numbering_global_branch_sentinel(),
          'payment',
          false
        );
      EXCEPTION WHEN OTHERS THEN
        v_ref_no := 'PAY-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random()*1000)::TEXT;
      END;
    END IF;

    BEGIN
      INSERT INTO payments (
        company_id, branch_id, payment_type, reference_type, reference_id,
        amount, payment_method, payment_date, payment_account_id,
        reference_number, notes, created_by
      )
      VALUES (
        p_company_id, v_branch_id, p_payment_type, p_reference_type, p_reference_id,
        p_amount, p_payment_method, p_payment_date, v_payment_account,
        v_ref_no, p_notes, p_created_by
      )
      RETURNING id INTO v_payment_id;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_try >= v_max_retries THEN
          RETURN json_build_object(
            'success', false,
            'error', 'Payment reference allocation failed after retries. Please retry.'
          );
        END IF;
    END;
  END LOOP;

  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by
  )
  VALUES (
    p_company_id, v_branch_id,
    'JE-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(
      (SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'
    ),
    p_payment_date,
    'Payment: ' || COALESCE(v_ref_no, p_reference_type || ' #' || p_reference_id::TEXT),
    'payment',
    v_payment_id,
    p_created_by
  )
  RETURNING id INTO v_journal_entry_id;

  IF p_payment_type = 'received' THEN
    IF v_ar_account_id IS NULL THEN
      SELECT id INTO v_ar_account_id
      FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    END IF;

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES
      (v_journal_entry_id, v_payment_account, p_amount, 0, 'Payment received'),
      (v_journal_entry_id, v_ar_account_id, 0, p_amount, 'Accounts Receivable decrease');

  ELSE
    IF p_reference_type = 'purchase' THEN
      IF v_ap_account_id IS NULL THEN
        SELECT id INTO v_ap_account_id
        FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
      END IF;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_journal_entry_id, v_ap_account_id, p_amount, 0, 'Accounts Payable decrease'),
        (v_journal_entry_id, v_payment_account, 0, p_amount, 'Payment made');

    ELSIF p_reference_type = 'expense' THEN
      SELECT id INTO v_expense_account_id
      FROM accounts WHERE company_id = p_company_id AND code = '6000' LIMIT 1;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_journal_entry_id, v_expense_account_id, p_amount, 0, 'Expense payment'),
        (v_journal_entry_id, v_payment_account, 0, p_amount, 'Payment made');
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'reference_number', v_ref_no,
    'journal_entry_id', v_journal_entry_id,
    'ar_account_id', v_ar_account_id,
    'ap_account_id', v_ap_account_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_payment_with_accounting(UUID, UUID, payment_type, VARCHAR, UUID, DECIMAL, payment_method_enum, DATE, UUID, VARCHAR, TEXT, UUID) IS
'Atomic payment posting: PAY-nnnn from company-scoped sequence (erp_numbering_global_branch_sentinel); payments.branch_id remains operational. Ref allocation outside INSERT savepoint for retry-safe bumps.';
