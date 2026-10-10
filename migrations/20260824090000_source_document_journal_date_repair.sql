-- Enforce operational document dates on active canonical journal postings and
-- repair existing active date mismatches without rewriting audit history.

SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_journal_entry_source_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
BEGIN
  -- Payment-linked journals always follow the payment's selected date, regardless
  -- of the operational document stored in reference_type/reference_id.
  IF NEW.payment_id IS NOT NULL THEN
    SELECT p.payment_date
    INTO v_date
    FROM public.payments p
    WHERE p.id = NEW.payment_id;
  ELSIF NEW.reference_type = 'sale' THEN
    SELECT s.invoice_date INTO v_date
    FROM public.sales s
    WHERE s.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'purchase' THEN
    SELECT p.po_date INTO v_date
    FROM public.purchases p
    WHERE p.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'expense' THEN
    SELECT e.expense_date INTO v_date
    FROM public.expenses e
    WHERE e.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'sale_return' THEN
    SELECT r.return_date INTO v_date
    FROM public.sale_returns r
    WHERE r.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'purchase_return' THEN
    SELECT r.return_date INTO v_date
    FROM public.purchase_returns r
    WHERE r.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'rental'
        AND COALESCE(NEW.action_fingerprint, '') LIKE 'rental_party_revenue:%' THEN
    -- Only the canonical rental revenue JE follows booking_date. Other rental JEs
    -- (payments, return penalties and devaluation events) have their own dates.
    SELECT r.booking_date INTO v_date
    FROM public.rentals r
    WHERE r.id = NEW.reference_id;
  END IF;

  IF v_date IS NOT NULL THEN
    NEW.entry_date := v_date;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_journal_entry_source_date
ON public.journal_entries;

CREATE TRIGGER trg_sync_journal_entry_source_date
BEFORE INSERT OR UPDATE OF reference_type, reference_id, payment_id, entry_date, action_fingerprint
ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_journal_entry_source_date();

-- Keep the existing helper signature and payment linkage. The suppression GUC in
-- record_payment_with_accounting/auto_create_payment_journal_entry is unchanged.
CREATE OR REPLACE FUNCTION public.create_payment_journal_entry(
  p_payment_id UUID,
  p_company_id UUID,
  p_branch_id UUID,
  p_sale_id UUID,
  p_amount NUMERIC,
  p_payment_account_id UUID,
  p_customer_name VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_entry_id UUID;
  v_receivable_account_id UUID;
  v_invoice_no VARCHAR;
  v_payment_date DATE;
BEGIN
  SELECT payment_date
  INTO v_payment_date
  FROM public.payments
  WHERE id = p_payment_id;

  IF v_payment_date IS NULL THEN
    RAISE EXCEPTION 'Payment % has no payment_date', p_payment_id;
  END IF;

  SELECT id
  INTO v_receivable_account_id
  FROM public.accounts
  WHERE company_id = p_company_id
    AND is_active IS NOT FALSE
    AND (
      code = '1100'
      OR (
        code = '2000'
        AND (LOWER(name) LIKE '%receivable%' OR name = 'Accounts Receivable')
      )
    )
  ORDER BY CASE WHEN code = '1100' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_receivable_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable account (1100 or 2000) not found';
  END IF;

  SELECT invoice_no
  INTO v_invoice_no
  FROM public.sales
  WHERE id = p_sale_id;

  INSERT INTO public.journal_entries (
    company_id,
    branch_id,
    entry_date,
    description,
    reference_type,
    reference_id,
    payment_id
  ) VALUES (
    p_company_id,
    p_branch_id,
    v_payment_date,
    'Payment received from ' || COALESCE(p_customer_name, 'Customer'),
    'sale',
    p_sale_id,
    p_payment_id
  )
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    description
  ) VALUES (
    v_journal_entry_id,
    p_payment_account_id,
    p_amount,
    0,
    'Payment received - ' || COALESCE(v_invoice_no, '')
  );

  INSERT INTO public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    description
  ) VALUES (
    v_journal_entry_id,
    v_receivable_account_id,
    0,
    p_amount,
    'Payment received - ' || COALESCE(v_invoice_no, '')
  );

  RETURN v_journal_entry_id;
END;
$$;

-- Repair active source-linked journals only. Voided entries, reversal entries,
-- correction journals, journal lines and duplicate chains are intentionally left
-- untouched so the historical audit trail remains immutable.
DO $$
DECLARE
  v_sales_count BIGINT;
  v_purchases_count BIGINT;
  v_expenses_count BIGINT;
  v_payments_count BIGINT;
  v_sale_returns_count BIGINT;
  v_purchase_returns_count BIGINT;
  v_rentals_count BIGINT;
BEGIN
  UPDATE public.journal_entries je
  SET entry_date = s.invoice_date
  FROM public.sales s
  WHERE je.reference_type = 'sale'
    AND je.reference_id = s.id
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
    AND s.invoice_date IS NOT NULL
    AND je.entry_date IS DISTINCT FROM s.invoice_date;
  GET DIAGNOSTICS v_sales_count = ROW_COUNT;

  UPDATE public.journal_entries je
  SET entry_date = p.po_date
  FROM public.purchases p
  WHERE je.reference_type = 'purchase'
    AND je.reference_id = p.id
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
    AND p.po_date IS NOT NULL
    AND je.entry_date IS DISTINCT FROM p.po_date;
  GET DIAGNOSTICS v_purchases_count = ROW_COUNT;

  UPDATE public.journal_entries je
  SET entry_date = e.expense_date
  FROM public.expenses e
  WHERE je.reference_type = 'expense'
    AND je.reference_id = e.id
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
    AND e.expense_date IS NOT NULL
    AND je.entry_date IS DISTINCT FROM e.expense_date;
  GET DIAGNOSTICS v_expenses_count = ROW_COUNT;

  UPDATE public.journal_entries je
  SET entry_date = p.payment_date
  FROM public.payments p
  WHERE je.payment_id = p.id
    AND COALESCE(je.is_void, false) = false
    AND p.payment_date IS NOT NULL
    AND je.entry_date IS DISTINCT FROM p.payment_date;
  GET DIAGNOSTICS v_payments_count = ROW_COUNT;

  UPDATE public.journal_entries je
  SET entry_date = r.return_date
  FROM public.sale_returns r
  WHERE je.reference_type = 'sale_return'
    AND je.reference_id = r.id
    AND COALESCE(je.is_void, false) = false
    AND r.return_date IS NOT NULL
    AND je.entry_date IS DISTINCT FROM r.return_date;
  GET DIAGNOSTICS v_sale_returns_count = ROW_COUNT;

  UPDATE public.journal_entries je
  SET entry_date = r.return_date
  FROM public.purchase_returns r
  WHERE je.reference_type = 'purchase_return'
    AND je.reference_id = r.id
    AND COALESCE(je.is_void, false) = false
    AND r.return_date IS NOT NULL
    AND je.entry_date IS DISTINCT FROM r.return_date;
  GET DIAGNOSTICS v_purchase_returns_count = ROW_COUNT;

  UPDATE public.journal_entries je
  SET entry_date = r.booking_date
  FROM public.rentals r
  WHERE je.reference_type = 'rental'
    AND je.reference_id = r.id
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
    AND COALESCE(je.action_fingerprint, '') LIKE 'rental_party_revenue:%'
    AND r.booking_date IS NOT NULL
    AND je.entry_date IS DISTINCT FROM r.booking_date;
  GET DIAGNOSTICS v_rentals_count = ROW_COUNT;

  RAISE NOTICE 'Source-date repair: sales=%, purchases=%, expenses=%, payments=%, sale_returns=%, purchase_returns=%, rentals=%',
    v_sales_count,
    v_purchases_count,
    v_expenses_count,
    v_payments_count,
    v_sale_returns_count,
    v_purchase_returns_count,
    v_rentals_count;
END;
$$;

COMMENT ON FUNCTION public.sync_journal_entry_source_date() IS
  'Enforces source operational dates on canonical and payment-linked journal entries while preserving reversal and void history.';

COMMENT ON FUNCTION public.create_payment_journal_entry(UUID, UUID, UUID, UUID, NUMERIC, UUID, VARCHAR) IS
  'Creates a payment-linked journal entry dated strictly from payments.payment_date.';
