-- ============================================================================
-- Party sub-ledger RPCs + payment routing fix
-- ----------------------------------------------------------------------------
-- Problem:
--   record_customer_payment and record_payment_with_accounting always posted
--   AR/AP journal lines against the parent control accounts (code '1100' /
--   '2000') instead of the contact-specific sub-account
--   (accounts.parent_id = control AND accounts.linked_contact_id = contact).
--   As a result, payments did not appear in the specific supplier/customer
--   sub-account ledger.
--
-- Fix:
--   1. Add helper SQL functions that resolve (or auto-create) the party
--      sub-account, mirroring the desktop partySubledgerAccountService.ts.
--   2. Patch record_customer_payment to credit the customer's AR child.
--   3. Patch record_payment_with_accounting so that:
--        - sale     -> credit customer AR child
--        - purchase -> debit  supplier AP child
--        - rental   -> credit customer AR child + update rentals totals
--        - expense  -> unchanged (expense flow doesn't route through AR/AP)
--   4. Preserve parent-account fallback when contact cannot be resolved.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: slug from contact code / id
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._party_slug_from_contact(
  p_contact_code TEXT,
  p_contact_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_contact_code IS NOT NULL AND length(trim(p_contact_code)) > 0 THEN
    RETURN upper(replace(p_contact_code, '-', ''));
  END IF;
  RETURN upper(substr(replace(p_contact_id::text, '-', ''), 1, 6));
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Helper: ensure AR sub-account for customer (control 1100)
--    Returns the child account id, or the control id as fallback, or NULL
--    if the control itself is missing.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ensure_ar_subaccount_for_contact(
  p_company_id UUID,
  p_contact_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control_id UUID;
  v_child_id UUID;
  v_contact RECORD;
  v_slug TEXT;
  v_code TEXT;
  v_name TEXT;
BEGIN
  SELECT id INTO v_control_id
  FROM accounts
  WHERE company_id = p_company_id
    AND trim(COALESCE(code, '')) = '1100'
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_control_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN v_control_id;
  END IF;

  SELECT id INTO v_child_id
  FROM accounts
  WHERE company_id = p_company_id
    AND parent_id = v_control_id
    AND linked_contact_id = p_contact_id
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_child_id IS NOT NULL THEN
    RETURN v_child_id;
  END IF;

  SELECT id, name, type, code INTO v_contact
  FROM contacts
  WHERE company_id = p_company_id AND id = p_contact_id
  LIMIT 1;

  IF v_contact.id IS NULL THEN
    RETURN v_control_id;
  END IF;

  v_slug := public._party_slug_from_contact(v_contact.code, p_contact_id);
  v_code := 'AR-' || v_slug;
  v_name := left('Receivable — ' || COALESCE(v_contact.name, 'Customer'), 250);

  BEGIN
    INSERT INTO accounts (
      company_id, code, name, type, parent_id, linked_contact_id, is_active
    )
    VALUES (
      p_company_id, v_code, v_name, 'asset'::account_type, v_control_id, p_contact_id, TRUE
    )
    RETURNING id INTO v_child_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_child_id
      FROM accounts
      WHERE company_id = p_company_id AND code = v_code
      LIMIT 1;
  END;

  RETURN COALESCE(v_child_id, v_control_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Helper: ensure AP sub-account for supplier (control 2000)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ensure_ap_subaccount_for_contact(
  p_company_id UUID,
  p_contact_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control_id UUID;
  v_child_id UUID;
  v_contact RECORD;
  v_slug TEXT;
  v_code TEXT;
  v_name TEXT;
BEGIN
  SELECT id INTO v_control_id
  FROM accounts
  WHERE company_id = p_company_id
    AND trim(COALESCE(code, '')) = '2000'
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_control_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN v_control_id;
  END IF;

  SELECT id INTO v_child_id
  FROM accounts
  WHERE company_id = p_company_id
    AND parent_id = v_control_id
    AND linked_contact_id = p_contact_id
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_child_id IS NOT NULL THEN
    RETURN v_child_id;
  END IF;

  SELECT id, name, type, code INTO v_contact
  FROM contacts
  WHERE company_id = p_company_id AND id = p_contact_id
  LIMIT 1;

  IF v_contact.id IS NULL THEN
    RETURN v_control_id;
  END IF;

  v_slug := public._party_slug_from_contact(v_contact.code, p_contact_id);
  v_code := 'AP-' || v_slug;
  v_name := left('Payable — ' || COALESCE(v_contact.name, 'Supplier'), 250);

  BEGIN
    INSERT INTO accounts (
      company_id, code, name, type, parent_id, linked_contact_id, is_active
    )
    VALUES (
      p_company_id, v_code, v_name, 'liability'::account_type, v_control_id, p_contact_id, TRUE
    )
    RETURNING id INTO v_child_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_child_id
      FROM accounts
      WHERE company_id = p_company_id AND code = v_code
      LIMIT 1;
  END;

  RETURN COALESCE(v_child_id, v_control_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Helper: ensure Worker Payable sub-account (control 2010)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ensure_worker_payable_subaccount(
  p_company_id UUID,
  p_contact_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control_id UUID;
  v_child_id UUID;
  v_contact RECORD;
  v_slug TEXT;
  v_code TEXT;
  v_name TEXT;
BEGIN
  SELECT id INTO v_control_id
  FROM accounts
  WHERE company_id = p_company_id
    AND trim(COALESCE(code, '')) = '2010'
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_control_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN v_control_id;
  END IF;

  SELECT id INTO v_child_id
  FROM accounts
  WHERE company_id = p_company_id
    AND parent_id = v_control_id
    AND linked_contact_id = p_contact_id
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_child_id IS NOT NULL THEN
    RETURN v_child_id;
  END IF;

  SELECT id, name, type, code INTO v_contact
  FROM contacts
  WHERE company_id = p_company_id AND id = p_contact_id
  LIMIT 1;

  IF v_contact.id IS NULL THEN
    RETURN v_control_id;
  END IF;

  v_slug := public._party_slug_from_contact(v_contact.code, p_contact_id);
  v_code := 'WP-' || v_slug;
  v_name := left('Worker Payable — ' || COALESCE(v_contact.name, 'Worker'), 250);

  BEGIN
    INSERT INTO accounts (
      company_id, code, name, type, parent_id, linked_contact_id, is_active
    )
    VALUES (
      p_company_id, v_code, v_name, 'liability'::account_type, v_control_id, p_contact_id, TRUE
    )
    RETURNING id INTO v_child_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_child_id
      FROM accounts
      WHERE company_id = p_company_id AND code = v_code
      LIMIT 1;
  END;

  RETURN COALESCE(v_child_id, v_control_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Patched record_customer_payment (AR child instead of parent 1100)
-- ----------------------------------------------------------------------------
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
  v_ar_account_id UUID;
  v_payment_id UUID;
  v_journal_entry_id UUID;
  v_ref_no VARCHAR(100);
  v_method payment_method_enum;
  v_customer_id UUID;
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

  IF p_customer_id IS NOT NULL AND v_sale.customer_id IS NOT NULL AND v_sale.customer_id != p_customer_id THEN
    RETURN json_build_object('success', false, 'error', 'Sale does not belong to this customer');
  END IF;

  v_branch_id := v_sale.branch_id;
  v_customer_id := COALESCE(p_customer_id, v_sale.customer_id);

  v_method := CASE lower(trim(COALESCE(p_payment_method, 'cash')))
    WHEN 'bank' THEN 'bank'::payment_method_enum
    WHEN 'card' THEN 'card'::payment_method_enum
    WHEN 'wallet' THEN 'other'::payment_method_enum
    WHEN 'mobile_wallet' THEN 'other'::payment_method_enum
    ELSE 'cash'::payment_method_enum
  END;

  -- Resolve AR child for this specific customer (auto-creates if missing).
  -- Falls back to parent 1100 when customer id is null.
  v_ar_account_id := public._ensure_ar_subaccount_for_contact(p_company_id, v_customer_id);

  IF v_ar_account_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Accounts Receivable (1100) not found. Configure chart of accounts.'
    );
  END IF;

  BEGIN
    v_ref_no := get_next_document_number(p_company_id, v_branch_id, 'payment');
  EXCEPTION
    WHEN OTHERS THEN
      v_ref_no := 'PMT-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::TEXT, 4, '0');
  END;

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

  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by
  )
  VALUES (
    p_company_id, v_branch_id,
    'JE-' || to_char(p_payment_date, 'YYYYMMDD') || '-' || lpad(
      (SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'
    ),
    p_payment_date,
    'Payment received: ' || COALESCE(v_sale.invoice_no, p_reference_id::TEXT),
    'payment',
    v_payment_id,
    p_created_by
  )
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, p_account_id, p_amount, 0, 'Payment received');

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_ar_account_id, 0, p_amount, 'Accounts Receivable decrease');

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
    'reference_number', v_ref_no,
    'ar_account_id', v_ar_account_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_customer_payment(UUID, UUID, UUID, NUMERIC, UUID, TEXT, DATE, TEXT, UUID) IS
  'Atomic customer payment: Dr cash/bank, Cr customer AR sub-account (auto-created under 1100). Falls back to parent 1100 if customer is null.';

-- ----------------------------------------------------------------------------
-- 6. Patched record_payment_with_accounting (sale / purchase / rental / expense)
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

  -- Update reference record + resolve party sub-account
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
      UPDATE rentals
      SET
        paid_amount = COALESCE(paid_amount, 0) + p_amount,
        due_amount = GREATEST(0, COALESCE(total, 0) - (COALESCE(paid_amount, 0) + p_amount))
      WHERE id = p_reference_id;
    END IF;

  ELSIF p_reference_type = 'expense' THEN
    SELECT * INTO v_expense_record FROM expenses WHERE id = p_reference_id;
    IF v_expense_record.id IS NOT NULL THEN
      v_branch_id := COALESCE(v_branch_id, v_expense_record.branch_id);
      UPDATE expenses SET status = 'paid' WHERE id = p_reference_id;
    END IF;
  END IF;

  -- Insert payment row
  INSERT INTO payments (
    company_id, branch_id, payment_type, reference_type, reference_id,
    amount, payment_method, payment_date, payment_account_id,
    reference_number, notes, created_by
  )
  VALUES (
    p_company_id, v_branch_id, p_payment_type, p_reference_type, p_reference_id,
    p_amount, p_payment_method, p_payment_date, v_payment_account,
    p_reference_number, p_notes, p_created_by
  )
  RETURNING id INTO v_payment_id;

  -- Journal entry header
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
    'Payment: ' || COALESCE(p_reference_number, p_reference_type || ' #' || p_reference_id::TEXT),
    'payment',
    v_payment_id,
    p_created_by
  )
  RETURNING id INTO v_journal_entry_id;

  -- Journal lines (routed to party sub-account where applicable)
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
  'Unified payment engine: posts AR/AP journal lines against the contact-specific sub-account under control 1100/2000 (auto-created). Supports sale, purchase, rental, expense reference types.';

-- ----------------------------------------------------------------------------
-- 7. Reload PostgREST schema cache
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
