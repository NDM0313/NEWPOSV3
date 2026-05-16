-- Customer receipts (payment_type = received): RCV-0001 via document_type CUSTOMER_RECEIPT.
-- Outgoing supplier/expense payments stay PAY-* (PAYMENT + payment_type = paid).

CREATE OR REPLACE FUNCTION public._sync_customer_receipt_sequence_after_duplicate(p_company_id UUID, p_year INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $syncrcv$
DECLARE
  v_max BIGINT;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
  INTO v_max
  FROM public.payments p
  WHERE p.company_id = p_company_id
    AND p.payment_type = 'received'
    AND p.reference_number ~ '([0-9]+)$'
    AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
    AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9;

  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
  )
  VALUES (
    p_company_id,
    v_sentinel,
    'CUSTOMER_RECEIPT',
    public.erp_document_default_prefix('customer_receipt'),
    p_year,
    0,
    4,
    now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;

  UPDATE public.erp_document_sequences e
  SET
    last_number = GREATEST(
      e.last_number,
      LEAST(v_max, 2147483647)::INTEGER
    ),
    updated_at = now()
  WHERE e.company_id = p_company_id
    AND e.branch_id = v_sentinel
    AND e.document_type = 'CUSTOMER_RECEIPT'
    AND e.year = p_year;
END;
$syncrcv$;

COMMENT ON FUNCTION public._sync_customer_receipt_sequence_after_duplicate(UUID, INTEGER) IS
  'Align CUSTOMER_RECEIPT sentinel last_number with max numeric suffix on received payments after duplicate key.';

CREATE OR REPLACE FUNCTION public._sync_payment_sequence_after_duplicate(p_company_id UUID, p_year INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sync$
DECLARE
  v_max BIGINT;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
  INTO v_max
  FROM public.payments p
  WHERE p.company_id = p_company_id
    AND p.payment_type = 'paid'
    AND p.reference_number ~ '([0-9]+)$'
    AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
    AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9;

  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
  )
  VALUES (
    p_company_id,
    v_sentinel,
    'PAYMENT',
    public.erp_document_default_prefix('payment'),
    p_year,
    0,
    4,
    now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;

  UPDATE public.erp_document_sequences e
  SET
    last_number = GREATEST(
      e.last_number,
      LEAST(v_max, 2147483647)::INTEGER
    ),
    updated_at = now()
  WHERE e.company_id = p_company_id
    AND e.branch_id = v_sentinel
    AND e.document_type = 'PAYMENT'
    AND e.year = p_year;
END;
$sync$;

COMMENT ON FUNCTION public._sync_payment_sequence_after_duplicate(UUID, INTEGER) IS
  'Align PAYMENT sentinel last_number with max numeric suffix on paid (outgoing) payments after duplicate key.';

CREATE OR REPLACE FUNCTION public.generate_document_number(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_document_type TEXT DEFAULT 'payment',
  p_include_year BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_prefix   TEXT;
  v_next     INTEGER;
  v_year     INTEGER;
  v_doc_type TEXT;
  v_padding  INTEGER;
  v_branch   UUID;
  v_observed BIGINT := 0;
  v_pad_ins  INTEGER;
  v_studio_sale BIGINT := 0;
  v_eff_pad  INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::INTEGER;
  v_doc_type := UPPER(TRIM(p_document_type));
  v_branch := COALESCE(p_branch_id, public.erp_numbering_global_branch_sentinel());

  v_pad_ins := CASE
    WHEN v_doc_type IN ('MANUAL_JOURNAL', 'FUND_TRANSFER') THEN 6
    ELSE 4
  END;

  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
  )
  VALUES (
    p_company_id, v_branch, v_doc_type,
    public.erp_document_default_prefix(p_document_type),
    v_year, 0, v_pad_ins, now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;

  BEGIN
    IF v_doc_type = 'PAYMENT' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.payments p
      WHERE p.company_id = p_company_id
        AND p.payment_type = 'paid'
        AND p.reference_number ~ '([0-9]+)$'
        AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
        AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'CUSTOMER_RECEIPT' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.payments p
      WHERE p.company_id = p_company_id
        AND p.payment_type = 'received'
        AND p.reference_number ~ '([0-9]+)$'
        AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
        AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'WORKER_PAYMENT' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.payments
      WHERE company_id = p_company_id
        AND reference_type = 'worker_payment'
        AND reference_number ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(reference_number FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'SALE' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.sales
      WHERE company_id = p_company_id
        AND invoice_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(invoice_no FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'PURCHASE' THEN
      SELECT COALESCE(GREATEST(
        COALESCE(MAX(CAST(SUBSTRING(po_no FROM '([0-9]+)$') AS BIGINT))
          FILTER (WHERE po_no IS NOT NULL AND po_no ~ '([0-9]+)$'
            AND LENGTH(SUBSTRING(po_no FROM '([0-9]+)$')) <= 9), 0),
        COALESCE(MAX(CAST(SUBSTRING(order_no FROM '([0-9]+)$') AS BIGINT))
          FILTER (WHERE order_no IS NOT NULL AND order_no ~ '([0-9]+)$'
            AND LENGTH(SUBSTRING(order_no FROM '([0-9]+)$')) <= 9), 0),
        COALESCE(MAX(CAST(SUBSTRING(draft_no FROM '([0-9]+)$') AS BIGINT))
          FILTER (WHERE draft_no IS NOT NULL AND draft_no ~ '([0-9]+)$'
            AND LENGTH(SUBSTRING(draft_no FROM '([0-9]+)$')) <= 9), 0)
      ), 0)
      INTO v_observed
      FROM public.purchases
      WHERE company_id = p_company_id;
    ELSIF v_doc_type = 'EXPENSE' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(expense_no FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.expenses
      WHERE company_id = p_company_id
        AND expense_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(expense_no FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'RENTAL' THEN
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(booking_no FROM '([0-9]+)$') AS BIGINT)), 0)
          INTO v_observed
        FROM public.rentals
        WHERE company_id = p_company_id
          AND booking_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(booking_no FROM '([0-9]+)$')) <= 9;
      EXCEPTION WHEN undefined_column THEN v_observed := 0;
      END;
    ELSIF v_doc_type = 'STUDIO' THEN
      v_observed := 0;
      v_studio_sale := 0;
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(production_no FROM '([0-9]+)$') AS BIGINT)), 0)
          INTO v_observed
        FROM public.studio_productions
        WHERE company_id = p_company_id
          AND production_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(production_no FROM '([0-9]+)$')) <= 9;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        v_observed := 0;
      END;
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(order_no FROM '([0-9]+)$') AS BIGINT)), 0)
          INTO v_studio_sale
        FROM public.sales
        WHERE company_id = p_company_id
          AND COALESCE(is_studio, false) = true
          AND order_no IS NOT NULL
          AND order_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(order_no FROM '([0-9]+)$')) <= 9;
      EXCEPTION WHEN undefined_column THEN
        v_studio_sale := 0;
      END;
      v_observed := GREATEST(COALESCE(v_observed, 0), COALESCE(v_studio_sale, 0));
    ELSIF v_doc_type = 'MANUAL_JOURNAL' THEN
      SELECT COALESCE(MAX(s.n), 0)
        INTO v_observed
      FROM (
        SELECT CAST(SUBSTRING(je.entry_no FROM '([0-9]+)$') AS BIGINT) AS n
        FROM public.journal_entries je
        WHERE je.company_id = p_company_id
          AND je.entry_no ~ '^JV-[0-9]+$'
        UNION ALL
        SELECT CAST(SUBSTRING(je.document_no FROM '([0-9]+)$') AS BIGINT) AS n
        FROM public.journal_entries je
        WHERE je.company_id = p_company_id
          AND je.document_no IS NOT NULL
          AND je.document_no ~ '^JV-[0-9]+$'
      ) s;
    ELSIF v_doc_type = 'FUND_TRANSFER' THEN
      SELECT COALESCE(MAX(s.n), 0)
        INTO v_observed
      FROM (
        SELECT CAST(SUBSTRING(je.entry_no FROM '([0-9]+)$') AS BIGINT) AS n
        FROM public.journal_entries je
        WHERE je.company_id = p_company_id
          AND je.entry_no ~ '^FT-[0-9]+$'
        UNION ALL
        SELECT CAST(SUBSTRING(je.document_no FROM '([0-9]+)$') AS BIGINT) AS n
        FROM public.journal_entries je
        WHERE je.company_id = p_company_id
          AND je.document_no IS NOT NULL
          AND je.document_no ~ '^FT-[0-9]+$'
      ) s;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_observed := 0;
  END;

  UPDATE public.erp_document_sequences
  SET
    last_number = GREATEST(last_number + 1, v_observed::INTEGER + 1),
    updated_at = now()
  WHERE company_id = p_company_id
    AND branch_id = v_branch
    AND document_type = v_doc_type
    AND year = v_year
  RETURNING prefix, last_number, padding
  INTO v_prefix, v_next, v_padding;

  IF v_prefix IS NULL OR v_next IS NULL THEN
    RAISE EXCEPTION 'erp_document_sequences: failed to get next number for company=%, type=%',
      p_company_id, v_doc_type;
  END IF;

  v_eff_pad := LEAST(GREATEST(COALESCE(v_padding, v_pad_ins), 4), 6);

  IF p_include_year THEN
    RETURN v_prefix || '-' || RIGHT(v_year::TEXT, 2) || '-' ||
           LPAD(v_next::TEXT, v_eff_pad, '0');
  ELSE
    RETURN v_prefix || '-' ||
           LPAD(v_next::TEXT, v_eff_pad, '0');
  END IF;
END;
$body$;

COMMENT ON FUNCTION public.generate_document_number(UUID, UUID, TEXT, BOOLEAN) IS
  'ERP numbering: received → CUSTOMER_RECEIPT (RCV); paid → PAYMENT (PAY); WORKER_PAYMENT/WPY; padding 4–6.';

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
        END IF;
      EXCEPTION WHEN OTHERS THEN
        IF lower(trim(COALESCE(p_reference_type, ''))) = 'worker_payment' THEN
          v_ref_no := 'WPY-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random() * 1000)::TEXT;
        ELSIF p_payment_type = 'received'::payment_type THEN
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
        IF lower(trim(COALESCE(p_reference_type, ''))) = 'worker_payment' THEN
          PERFORM public._sync_worker_payment_sequence_after_duplicate(p_company_id, v_year_seq);
          UPDATE public.erp_document_sequences
          SET last_number = last_number + 1, updated_at = now()
          WHERE company_id = p_company_id
            AND branch_id = public.erp_numbering_global_branch_sentinel()
            AND document_type = 'WORKER_PAYMENT'
            AND year = v_year_seq;
        ELSIF p_payment_type = 'received'::payment_type THEN
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
  'Payment posting: received → CUSTOMER_RECEIPT (RCV-); paid → PAYMENT (PAY-); worker WPY; GL skip flag unchanged.';

NOTIFY pgrst, 'reload schema';
