-- ============================================================================
-- Round 3 — Self-healing numbering + payment unique-violation retry +
-- sequence repair across all document types.
-- ============================================================================
-- Problem set being fixed:
--   1) "Payment reference allocation failed after retries." still happens
--      even with per-RPC retry because generate_document_number/last_number
--      can be behind max(reference_number) in payments (and analogous tables)
--      so every retry still returns a colliding number.
--   2) record_payment_with_accounting had no unique-violation retry, so any
--      transient duplicate on reference_number bubbled up as an error.
--   3) Historic data drift on sequences across all prefixes needs a one-shot
--      realignment so future numbers are strictly greater than the existing
--      observed maximum.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Self-healing generate_document_number:
--    - Before bumping last_number, align it to observed MAX suffix in the
--      natural owner table for that document_type, so that the next issued
--      number is strictly greater than anything already present.
--    - Keeps atomic ON CONFLICT DO UPDATE semantics via a pre-sync UPDATE.
-- ----------------------------------------------------------------------------
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
BEGIN
  v_year := EXTRACT(YEAR FROM now())::INTEGER;
  v_doc_type := UPPER(TRIM(p_document_type));
  v_branch := COALESCE(p_branch_id, public.erp_numbering_global_branch_sentinel());

  -- Ensure row exists
  INSERT INTO public.erp_document_sequences (
    company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
  )
  VALUES (
    p_company_id, v_branch, v_doc_type,
    public.erp_document_default_prefix(p_document_type),
    v_year, 0, 4, now()
  )
  ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;

  -- Observe max suffix from the owning table for this document_type
  BEGIN
    IF v_doc_type = 'PAYMENT' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.payments
      WHERE company_id = p_company_id
        AND reference_number ~ '([0-9]+)$'
        AND reference_number NOT ILIKE 'PAY-BACKFILL-%'
        AND LENGTH(SUBSTRING(reference_number FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'SALE' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.sales
      WHERE company_id = p_company_id
        AND invoice_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(invoice_no FROM '([0-9]+)$')) <= 9;
    ELSIF v_doc_type = 'PURCHASE' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(po_no FROM '([0-9]+)$') AS BIGINT)), 0)
        INTO v_observed
      FROM public.purchases
      WHERE company_id = p_company_id
        AND po_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(po_no FROM '([0-9]+)$')) <= 9;
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
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(production_no FROM '([0-9]+)$') AS BIGINT)), 0)
          INTO v_observed
        FROM public.studio_productions
        WHERE company_id = p_company_id
          AND production_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(production_no FROM '([0-9]+)$')) <= 9;
      EXCEPTION WHEN undefined_column OR undefined_table THEN v_observed := 0;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_observed := 0;
  END;

  -- Atomically bump last_number to GREATEST(last_number+1, observed+1)
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

  IF p_include_year THEN
    RETURN v_prefix || '-' || RIGHT(v_year::TEXT, 2) || '-' ||
           LPAD(v_next::TEXT, GREATEST(COALESCE(v_padding, 4), 1), '0');
  ELSE
    RETURN v_prefix || '-' ||
           LPAD(v_next::TEXT, GREATEST(COALESCE(v_padding, 4), 1), '0');
  END IF;
END;
$body$;

COMMENT ON FUNCTION public.generate_document_number(UUID, UUID, TEXT, BOOLEAN) IS
'ERP Numbering Engine v2: self-healing. Before bumping last_number, aligns to observed max suffix in the owning table so retries and drift never collide.';

-- ----------------------------------------------------------------------------
-- 2) record_payment_with_accounting with unique-violation retry around INSERT
-- ----------------------------------------------------------------------------
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
  v_max_retries INTEGER := 10;
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

  -- INSERT payments with unique-violation retry using self-healing numbering.
  LOOP
    v_try := v_try + 1;
    BEGIN
      IF p_reference_number IS NOT NULL AND TRIM(p_reference_number) <> '' AND v_try = 1 THEN
        v_ref_no := p_reference_number;
      ELSE
        BEGIN
          v_ref_no := public.generate_document_number(p_company_id, v_branch_id, 'payment', false);
        EXCEPTION WHEN OTHERS THEN
          v_ref_no := 'PAY-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random()*1000)::TEXT;
        END;
      END IF;

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
'Atomic payment posting with unique-violation retry on payments.reference_number and self-healing numbering.';

-- ----------------------------------------------------------------------------
-- 3) One-shot sequence repair across all document types
--    Aligns erp_document_sequences.last_number to observed MAX for current year.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_current_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
BEGIN
  -- PAYMENT
  UPDATE public.erp_document_sequences s
  SET last_number = GREATEST(
        COALESCE(s.last_number, 0),
        COALESCE((
          SELECT MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT))
          FROM public.payments p
          WHERE p.company_id = s.company_id
            AND p.reference_number ~ '([0-9]+)$'
            AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
            AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9
        ), 0)::INTEGER
      ),
      updated_at = now()
  WHERE UPPER(s.document_type) = 'PAYMENT'
    AND s.year = v_current_year;

  -- SALE
  UPDATE public.erp_document_sequences s
  SET last_number = GREATEST(
        COALESCE(s.last_number, 0),
        COALESCE((
          SELECT MAX(CAST(SUBSTRING(x.invoice_no FROM '([0-9]+)$') AS BIGINT))
          FROM public.sales x
          WHERE x.company_id = s.company_id
            AND x.invoice_no ~ '([0-9]+)$'
            AND LENGTH(SUBSTRING(x.invoice_no FROM '([0-9]+)$')) <= 9
        ), 0)::INTEGER
      ),
      updated_at = now()
  WHERE UPPER(s.document_type) = 'SALE'
    AND s.year = v_current_year;

  -- PURCHASE
  UPDATE public.erp_document_sequences s
  SET last_number = GREATEST(
        COALESCE(s.last_number, 0),
        COALESCE((
          SELECT MAX(CAST(SUBSTRING(x.po_no FROM '([0-9]+)$') AS BIGINT))
          FROM public.purchases x
          WHERE x.company_id = s.company_id
            AND x.po_no ~ '([0-9]+)$'
            AND LENGTH(SUBSTRING(x.po_no FROM '([0-9]+)$')) <= 9
        ), 0)::INTEGER
      ),
      updated_at = now()
  WHERE UPPER(s.document_type) = 'PURCHASE'
    AND s.year = v_current_year;

  -- EXPENSE
  BEGIN
    UPDATE public.erp_document_sequences s
    SET last_number = GREATEST(
          COALESCE(s.last_number, 0),
          COALESCE((
            SELECT MAX(CAST(SUBSTRING(x.expense_no FROM '([0-9]+)$') AS BIGINT))
            FROM public.expenses x
            WHERE x.company_id = s.company_id
              AND x.expense_no ~ '([0-9]+)$'
              AND LENGTH(SUBSTRING(x.expense_no FROM '([0-9]+)$')) <= 9
          ), 0)::INTEGER
        ),
        updated_at = now()
    WHERE UPPER(s.document_type) = 'EXPENSE'
      AND s.year = v_current_year;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END;

  -- RENTAL
  BEGIN
    UPDATE public.erp_document_sequences s
    SET last_number = GREATEST(
          COALESCE(s.last_number, 0),
          COALESCE((
            SELECT MAX(CAST(SUBSTRING(x.booking_no FROM '([0-9]+)$') AS BIGINT))
            FROM public.rentals x
            WHERE x.company_id = s.company_id
              AND x.booking_no ~ '([0-9]+)$'
              AND LENGTH(SUBSTRING(x.booking_no FROM '([0-9]+)$')) <= 9
          ), 0)::INTEGER
        ),
        updated_at = now()
    WHERE UPPER(s.document_type) = 'RENTAL'
      AND s.year = v_current_year;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END;

  -- STUDIO
  BEGIN
    UPDATE public.erp_document_sequences s
    SET last_number = GREATEST(
          COALESCE(s.last_number, 0),
          COALESCE((
            SELECT MAX(CAST(SUBSTRING(x.production_no FROM '([0-9]+)$') AS BIGINT))
            FROM public.studio_productions x
            WHERE x.company_id = s.company_id
              AND x.production_no ~ '([0-9]+)$'
              AND LENGTH(SUBSTRING(x.production_no FROM '([0-9]+)$')) <= 9
          ), 0)::INTEGER
        ),
        updated_at = now()
    WHERE UPPER(s.document_type) = 'STUDIO'
      AND s.year = v_current_year;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END;
END $$;

NOTIFY pgrst, 'reload schema';
