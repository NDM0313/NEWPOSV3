-- Phase B: unify future outgoing PAY sequence (supplier, worker, courier, purchase via RPC).
-- Does NOT rewrite payments.reference_number, GL debit/credit rules, or expense EXP numbering.

-- ─── Forward-merge SUPPLIER_PAYMENT counter into PAYMENT (company-scoped sentinel) ───
CREATE OR REPLACE FUNCTION public.merge_supplier_payment_sequence_forward()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $merge$
DECLARE
  r RECORD;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
  v_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_pay_last INTEGER := 0;
  v_sup_last INTEGER := 0;
  v_observed BIGINT := 0;
  v_merged INTEGER := 0;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT company_id
    FROM public.erp_document_sequences
    WHERE document_type IN ('PAYMENT', 'SUPPLIER_PAYMENT')
  LOOP
    SELECT COALESCE(MAX(last_number), 0) INTO v_pay_last
    FROM public.erp_document_sequences
    WHERE company_id = r.company_id
      AND branch_id = v_sentinel
      AND document_type = 'PAYMENT'
      AND year = v_year;

    SELECT COALESCE(MAX(last_number), 0) INTO v_sup_last
    FROM public.erp_document_sequences
    WHERE company_id = r.company_id
      AND branch_id = v_sentinel
      AND document_type = 'SUPPLIER_PAYMENT'
      AND year = v_year;

    SELECT COALESCE(MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
    INTO v_observed
    FROM public.payments p
    WHERE p.company_id = r.company_id
      AND p.payment_type = 'paid'
      AND p.reference_number ~ '^PAY-'
      AND p.reference_number ~ '([0-9]+)$'
      AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9;

    v_merged := GREATEST(v_pay_last, v_sup_last, LEAST(v_observed, 2147483647)::INTEGER);

    INSERT INTO public.erp_document_sequences (
      company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
    )
    VALUES (
      r.company_id,
      v_sentinel,
      'PAYMENT',
      public.erp_document_default_prefix('payment'),
      v_year,
      v_merged,
      4,
      now()
    )
    ON CONFLICT (company_id, branch_id, document_type, year)
    DO UPDATE SET
      last_number = GREATEST(public.erp_document_sequences.last_number, EXCLUDED.last_number),
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$merge$;

COMMENT ON FUNCTION public.merge_supplier_payment_sequence_forward() IS
  'Phase B: align PAYMENT sequence with max(SUPPLIER_PAYMENT counter, PAY-* payments). Does not change historical voucher strings.';

SELECT public.merge_supplier_payment_sequence_forward();

-- ─── record_payment_with_accounting: worker → PAY; manual_payment + courier_payment GL ───
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
  v_year_seq INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_worker_wp_control UUID;
  v_worker_wp_party UUID;
  v_worker_wa UUID;
  v_debit_worker UUID;
  v_pay_to_payable BOOLEAN;
  v_doc_kind TEXT;
  v_courier_payable_id UUID;
  v_courier_contact_name TEXT;
BEGIN
  PERFORM set_config('app.record_payment_with_accounting_gl', '1', true);

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

  ELSIF lower(trim(COALESCE(p_reference_type, ''))) = 'manual_payment' THEN
    IF p_reference_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Manual supplier payment requires contact id');
    END IF;
    IF p_payment_type <> 'paid'::payment_type THEN
      RETURN json_build_object('success', false, 'error', 'Manual supplier payment must be paid');
    END IF;
    v_ap_account_id := public._ensure_ap_subaccount_for_contact(p_company_id, p_reference_id);

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
          IF p_payment_type = 'received'::payment_type THEN
            v_doc_kind := 'customer_receipt';
          ELSE
            v_doc_kind := 'payment';
          END IF;
          v_ref_no := public.generate_document_number(
            p_company_id,
            public.erp_numbering_global_branch_sentinel(),
            v_doc_kind,
            false
          );
      EXCEPTION WHEN OTHERS THEN
        IF p_payment_type = 'received'::payment_type THEN
          v_ref_no := 'RCV-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random() * 1000)::TEXT;
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
        IF p_payment_type = 'received'::payment_type THEN
          PERFORM public._sync_customer_receipt_sequence_after_duplicate(p_company_id, v_year_seq);
          UPDATE public.erp_document_sequences
          SET last_number = last_number + 1, updated_at = now()
          WHERE company_id = p_company_id
            AND branch_id = public.erp_numbering_global_branch_sentinel()
            AND document_type = 'CUSTOMER_RECEIPT'
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

    ELSIF lower(trim(COALESCE(p_reference_type, ''))) IN ('on_account', 'manual_payment') THEN
      IF v_ap_account_id IS NULL THEN
        SELECT id INTO v_ap_account_id
        FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
      END IF;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_journal_entry_id, v_ap_account_id, p_amount, 0, 'Accounts Payable decrease'),
        (v_journal_entry_id, v_payment_account, 0, p_amount, 'Payment made');

    ELSIF lower(trim(COALESCE(p_reference_type, ''))) = 'courier_payment' THEN
      SELECT COALESCE(NULLIF(TRIM(name), ''), 'Courier') INTO v_courier_contact_name
      FROM contacts WHERE id = p_reference_id LIMIT 1;
      v_courier_payable_id := public.get_or_create_courier_payable_account(
        p_company_id, p_reference_id, v_courier_contact_name
      );
      IF v_courier_payable_id IS NULL OR v_payment_account IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Courier payment requires courier payable account (2030).');
      END IF;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_journal_entry_id, v_courier_payable_id, p_amount, 0, 'Courier payment'),
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

NOTIFY pgrst, 'reload schema';
