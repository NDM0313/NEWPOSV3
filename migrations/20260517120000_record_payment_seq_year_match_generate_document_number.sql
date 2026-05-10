-- ============================================================================
-- PAY/WPY retry loop: align duplicate-recovery sequence year with generate_document_number
-- ============================================================================
-- generate_document_number uses v_year := EXTRACT(YEAR FROM now()) for
-- erp_document_sequences. record_payment_with_accounting previously used
-- EXTRACT(YEAR FROM p_payment_date) when syncing/bumping after unique_violation,
-- so the wrong year's row was updated and the same PAY-/WPY- ref repeated until
-- retries exhausted.

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
  p_created_by UUID,
  p_worker_stage_id UUID DEFAULT NULL
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
  -- Must match generate_document_number() which keys erp_document_sequences by EXTRACT(YEAR FROM now()).
  v_year_seq INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_worker_wp_control UUID;
  v_worker_wp_party UUID;
  v_worker_wa UUID;
  v_debit_worker UUID;
  v_pay_to_payable BOOLEAN;
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

  ELSIF lower(trim(COALESCE(p_reference_type, ''))) = 'on_account' THEN
    IF p_reference_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'On-account payment requires contact id');
    END IF;
    IF p_payment_type = 'received'::payment_type THEN
      v_ar_account_id := public._ensure_ar_subaccount_for_contact(p_company_id, p_reference_id);
    ELSE
      v_ap_account_id := public._ensure_ap_subaccount_for_contact(p_company_id, p_reference_id);
    END IF;
  END IF;

  LOOP
    v_try := v_try + 1;
    IF v_try > 500 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Payment reference allocation exhausted inner retries. Contact support.'
      );
    END IF;

    IF p_reference_number IS NOT NULL AND TRIM(p_reference_number) <> '' AND v_try = 1 THEN
      v_ref_no := TRIM(p_reference_number);
    ELSE
      BEGIN
        IF lower(trim(COALESCE(p_reference_type, ''))) = 'worker_payment' THEN
          v_ref_no := public.generate_document_number(
            p_company_id,
            public.erp_numbering_global_branch_sentinel(),
            'worker_payment',
            false
          );
        ELSE
          v_ref_no := public.generate_document_number(
            p_company_id,
            public.erp_numbering_global_branch_sentinel(),
            'payment',
            false
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        IF lower(trim(COALESCE(p_reference_type, ''))) = 'worker_payment' THEN
          v_ref_no := 'WPY-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random() * 1000)::TEXT;
        ELSE
          v_ref_no := 'PAY-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random() * 1000)::TEXT;
        END IF;
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
        IF lower(trim(COALESCE(p_reference_type, ''))) = 'worker_payment' THEN
          PERFORM public._sync_worker_payment_sequence_after_duplicate(p_company_id, v_year_seq);
          UPDATE public.erp_document_sequences
          SET last_number = last_number + 1, updated_at = now()
          WHERE company_id = p_company_id
            AND branch_id = public.erp_numbering_global_branch_sentinel()
            AND document_type = 'WORKER_PAYMENT'
            AND year = v_year_seq;
        ELSE
          PERFORM public._sync_payment_sequence_after_duplicate(p_company_id, v_year_seq);
          UPDATE public.erp_document_sequences
          SET last_number = last_number + 1, updated_at = now()
          WHERE company_id = p_company_id
            AND branch_id = public.erp_numbering_global_branch_sentinel()
            AND document_type = 'PAYMENT'
            AND year = v_year_seq;
        END IF;
    END;
  END LOOP;

  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, payment_id, created_by, document_no
  )
  VALUES (
    p_company_id,
    v_branch_id,
    v_ref_no,
    p_payment_date,
    'Payment: ' || COALESCE(v_ref_no, p_reference_type || ' #' || p_reference_id::TEXT),
    CASE WHEN lower(trim(COALESCE(p_reference_type, ''))) = 'worker_payment' THEN 'worker_payment' ELSE 'payment' END,
    CASE WHEN lower(trim(COALESCE(p_reference_type, ''))) = 'worker_payment' THEN p_reference_id ELSE v_payment_id END,
    v_payment_id,
    p_created_by,
    v_ref_no
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

    ELSIF lower(trim(COALESCE(p_reference_type, ''))) = 'on_account' THEN
      IF v_ap_account_id IS NULL THEN
        SELECT id INTO v_ap_account_id
        FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
      END IF;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_journal_entry_id, v_ap_account_id, p_amount, 0, 'Accounts Payable decrease'),
        (v_journal_entry_id, v_payment_account, 0, p_amount, 'Payment made');

    ELSIF lower(trim(COALESCE(p_reference_type, ''))) = 'worker_payment' THEN
      SELECT id INTO v_worker_wp_control
      FROM accounts
      WHERE company_id = p_company_id AND TRIM(COALESCE(code, '')) = '2010' AND COALESCE(is_active, TRUE)
      LIMIT 1;
      SELECT id INTO v_worker_wa
      FROM accounts
      WHERE company_id = p_company_id AND TRIM(COALESCE(code, '')) = '1180' AND COALESCE(is_active, TRUE)
      LIMIT 1;
      v_worker_wp_party := NULL;
      IF v_worker_wp_control IS NOT NULL THEN
        SELECT a.id INTO v_worker_wp_party
        FROM accounts a
        WHERE a.company_id = p_company_id
          AND a.linked_contact_id = p_reference_id
          AND a.parent_id = v_worker_wp_control
          AND COALESCE(a.is_active, TRUE)
        LIMIT 1;
      END IF;

      IF p_worker_stage_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM worker_ledger_entries wle
          WHERE wle.company_id = p_company_id
            AND wle.worker_id = p_reference_id
            AND wle.reference_type = 'studio_production_stage'
            AND wle.reference_id::uuid = p_worker_stage_id
            AND lower(trim(COALESCE(wle.status, ''))) <> 'paid'
        ) INTO v_pay_to_payable;
      ELSE
        SELECT EXISTS (
          SELECT 1 FROM worker_ledger_entries wle
          WHERE wle.company_id = p_company_id
            AND wle.worker_id = p_reference_id
            AND wle.reference_type = 'studio_production_stage'
            AND lower(trim(COALESCE(wle.status, ''))) <> 'paid'
        ) INTO v_pay_to_payable;
      END IF;

      IF v_pay_to_payable THEN
        v_debit_worker := COALESCE(v_worker_wp_party, v_worker_wp_control);
      ELSE
        v_debit_worker := v_worker_wa;
      END IF;

      IF v_debit_worker IS NULL OR v_payment_account IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Worker payment requires Worker Payable (2010) and Worker Advance (1180) accounts.');
      END IF;

      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_journal_entry_id, v_debit_worker, p_amount, 0, 'Worker payment (debit)'),
        (v_journal_entry_id, v_payment_account, 0, p_amount, 'Worker payment (credit)');
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

COMMENT ON FUNCTION public.record_payment_with_accounting(UUID, UUID, payment_type, VARCHAR, UUID, DECIMAL, payment_method_enum, DATE, UUID, VARCHAR, TEXT, UUID, UUID) IS
  'Payment posting: sale/purchase/rental/expense/on_account/worker_payment; WPY refs; JE mirrors voucher no. Duplicate recovery uses same sequence year as generate_document_number (now()).';

NOTIFY pgrst, 'reload schema';
