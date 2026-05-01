-- ============================================================================
-- record_customer_payment: use customer_receipt ERP doc type (matches web saleService.recordPayment)
-- ============================================================================
-- Web uses documentNumberService.getNextDocumentNumber(..., 'customer_receipt').
-- Mobile RPC previously used 'payment' for tries 1–8; align numbering series with web.
-- Depends on: 20260458_record_customer_payment_trigger_only_journal.sql (full function body).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_company_id UUID,
  p_customer_id UUID,
  p_reference_id UUID,
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
  v_ar_sub_account_id UUID;
  v_parent_ar_id UUID;
  v_payment_id UUID;
  v_journal_entry_id UUID;
  v_ref_no VARCHAR(100);
  v_method payment_method_enum;
  v_customer_id UUID;
  v_try INTEGER := 0;
  v_max_retries INTEGER := 12;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than 0');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = p_account_id AND company_id = p_company_id AND is_active = TRUE
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive payment account');
  END IF;

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

  IF p_customer_id IS NOT NULL AND v_sale.customer_id IS NOT NULL AND p_customer_id != v_sale.customer_id THEN
    RETURN json_build_object('success', false, 'error', 'Sale does not belong to this customer');
  END IF;

  v_branch_id := v_sale.branch_id;
  v_customer_id := COALESCE(p_customer_id, v_sale.customer_id);

  IF v_customer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sale has no customer; link a customer before recording payment.'
    );
  END IF;

  v_method := CASE lower(trim(COALESCE(p_payment_method, 'cash')))
    WHEN 'bank' THEN 'bank'::payment_method_enum
    WHEN 'card' THEN 'card'::payment_method_enum
    WHEN 'wallet' THEN 'other'::payment_method_enum
    WHEN 'mobile_wallet' THEN 'other'::payment_method_enum
    ELSE 'cash'::payment_method_enum
  END;

  v_ar_sub_account_id := public._ensure_ar_subaccount_for_contact(p_company_id, v_customer_id);

  IF v_ar_sub_account_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Accounts Receivable (1100) not found. Configure chart of accounts.'
    );
  END IF;

  SELECT id INTO v_parent_ar_id
  FROM accounts
  WHERE company_id = p_company_id
    AND is_active IS NOT FALSE
    AND (
      code = '1100'
      OR (code = '2000' AND (LOWER(name) LIKE '%receivable%' OR name = 'Accounts Receivable'))
    )
  ORDER BY CASE WHEN code = '1100' THEN 0 ELSE 1 END
  LIMIT 1;

  LOOP
    v_try := v_try + 1;

    BEGIN
      IF v_try <= 8 THEN
        BEGIN
          v_ref_no := public.generate_document_number(
            p_company_id,
            v_branch_id,
            'customer_receipt',
            false
          );
        EXCEPTION
          WHEN undefined_function THEN
            v_ref_no := public.get_next_document_number(p_company_id, v_branch_id, 'customer_receipt');
          WHEN OTHERS THEN
            v_ref_no := public.get_next_document_number(p_company_id, v_branch_id, 'customer_receipt');
        END;
      ELSE
        v_ref_no := 'PAY-FB-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' ||
          replace(gen_random_uuid()::text, '-', '');
        IF length(v_ref_no) > 100 THEN
          v_ref_no := substr(v_ref_no, 1, 100);
        END IF;
      END IF;

      INSERT INTO payments (
        company_id, branch_id, payment_type, reference_type, reference_id,
        amount, payment_method, payment_date, payment_account_id,
        reference_number, notes, created_by, contact_id, received_by
      )
      VALUES (
        p_company_id, v_branch_id, 'received'::payment_type, 'sale', p_reference_id,
        p_amount, v_method, p_payment_date, p_account_id,
        v_ref_no, p_notes, p_created_by, v_customer_id, p_created_by
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

  SELECT je.id INTO v_journal_entry_id
  FROM journal_entries je
  WHERE je.company_id = p_company_id
    AND je.payment_id = v_payment_id
    AND (je.is_void IS DISTINCT FROM TRUE)
  ORDER BY je.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_journal_entry_id IS NULL THEN
    RAISE EXCEPTION
      'record_customer_payment: payment journal not created (ensure AFTER INSERT trigger on payments calls create_payment_journal_entry)';
  END IF;

  IF v_parent_ar_id IS NOT NULL
     AND v_ar_sub_account_id IS NOT NULL
     AND v_parent_ar_id <> v_ar_sub_account_id THEN
    UPDATE journal_entry_lines jel
    SET account_id = v_ar_sub_account_id
    WHERE jel.journal_entry_id = v_journal_entry_id
      AND jel.account_id = v_parent_ar_id
      AND jel.credit > 0;
  END IF;

  RETURN json_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'journal_entry_id', v_journal_entry_id,
    'reference_number', v_ref_no,
    'ar_account_id', v_ar_sub_account_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_customer_payment(UUID, UUID, UUID, NUMERIC, UUID, TEXT, DATE, TEXT, UUID) IS
  'Customer receipt: INSERT payments only; tries 1–8 use customer_receipt numbering (web parity); PAY-FB-* fallback unchanged.';
