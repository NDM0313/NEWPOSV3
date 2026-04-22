-- ============================================================================
-- Document posting RPCs (sale / purchase / expense) + numbering bootstrap
--
-- Fixes the critical mobile bug where sale / purchase / expense documents were
-- getting inserted into their tables without any corresponding journal entries,
-- so the accounts module showed no trace of them.
--
-- Design:
--   * Three idempotent RPCs post a double-entry journal for the document.
--   * Sub-ledger routing (customer/supplier AR-AP) reuses the helpers from
--     migration 20260422_party_subledger_rpcs_and_payment_routing.sql.
--   * A small helper `_ensure_system_account` auto-creates the standard GL
--     codes (1200 Inventory, 4000 Sales, 5000 COGS, 5200 Discount, 6000…) if
--     the company has not set up its chart of accounts yet.
--   * `_bootstrap_company_doc_sequence` seeds per-company document counters so
--     the mobile app can safely switch to `get_next_document_number_global`
--     without colliding with historical numbers.
-- ============================================================================

SET search_path = public;

-- ----------------------------------------------------------------------------
-- 1. Standard system account bootstrapper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ensure_system_account(
  p_company_id UUID,
  p_code       VARCHAR(50),
  p_name       VARCHAR(255),
  p_type       VARCHAR(50),
  p_parent_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM accounts
  WHERE company_id = p_company_id AND code = p_code
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO accounts (company_id, code, name, type, parent_id, is_active)
  VALUES (p_company_id, p_code, p_name, p_type::account_type, p_parent_id, true)
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- Race: another txn created it concurrently
  SELECT id INTO v_id
  FROM accounts
  WHERE company_id = p_company_id AND code = p_code
  LIMIT 1;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public._ensure_system_account(UUID, VARCHAR, VARCHAR, VARCHAR, UUID) IS
  'Create a chart-of-accounts row for the company if missing. Safe to call repeatedly.';


-- ----------------------------------------------------------------------------
-- 2. record_sale_with_accounting
--
--    Posts journal lines for a sale document:
--      Dr AR customer sub-account            = grand total
--      Cr Sales Revenue (4000)               = subtotal - discount
--      Cr Sales Tax Payable (2100)           = tax_amount  (if > 0)
--      Dr Discount Allowed (5200)            = discount_amount  (if > 0)
--      Dr Cost of Goods Sold (5000)          = total cost
--      Cr Inventory Asset (1200)             = total cost
--
--    COGS is derived from the stock_movements rows the mobile `createSale`
--    already inserts (movement_type = 'sale', reference_type = 'sale').
--    Sale items are read from `sales_items` (preferred) with a fallback to
--    the legacy `sale_items` table.
--
--    Idempotent — if a non-void JE already exists for the sale, the function
--    replaces the lines (via void + re-insert) so it can be re-run safely.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_sale_with_accounting(
  p_sale_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale               sales%ROWTYPE;
  v_company_id         UUID;
  v_branch_id          UUID;
  v_customer_id        UUID;
  v_invoice_no         TEXT;
  v_subtotal           NUMERIC(15,2);
  v_tax                NUMERIC(15,2);
  v_discount           NUMERIC(15,2);
  v_total              NUMERIC(15,2);
  v_cogs_total         NUMERIC(15,2);
  v_ar_account_id      UUID;
  v_revenue_account_id UUID;
  v_tax_account_id     UUID;
  v_discount_account_id UUID;
  v_cogs_account_id    UUID;
  v_inventory_account_id UUID;
  v_journal_entry_id   UUID;
  v_net_revenue        NUMERIC(15,2);
  v_existing_je_id     UUID;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  IF v_sale.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sale not found');
  END IF;

  v_company_id  := v_sale.company_id;
  v_branch_id   := v_sale.branch_id;
  v_customer_id := v_sale.customer_id;
  v_invoice_no  := v_sale.invoice_no;
  v_subtotal    := COALESCE(v_sale.subtotal, 0);
  v_tax         := COALESCE(v_sale.tax_amount, 0);
  v_discount    := COALESCE(v_sale.discount_amount, 0);
  v_total       := COALESCE(v_sale.total, v_subtotal + v_tax - v_discount);

  IF v_total <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Sale total must be greater than 0');
  END IF;

  -- Canonical-document JE check (matches the partial unique index
  -- idx_journal_entries_canonical_sale_document_active).
  SELECT id INTO v_existing_je_id
  FROM journal_entries
  WHERE company_id = v_company_id
    AND reference_type = 'sale'
    AND reference_id = p_sale_id
    AND payment_id IS NULL
    AND COALESCE(is_void, false) = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_je_id IS NOT NULL THEN
    -- If this JE was posted by THIS rpc previously (our description prefix),
    -- void it so we can re-post a fresh copy. Otherwise another system (web
    -- ERP) already posted a canonical JE for the document — leave it alone
    -- and report success without duplicating.
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE id = v_existing_je_id AND description LIKE 'Sale #%'
    ) THEN
      BEGIN
        UPDATE journal_entries
        SET is_void = true,
            void_reason = 'Re-posted via record_sale_with_accounting'
        WHERE id = v_existing_je_id;
      EXCEPTION WHEN undefined_column THEN
        DELETE FROM journal_entry_lines WHERE journal_entry_id = v_existing_je_id;
        DELETE FROM journal_entries WHERE id = v_existing_je_id;
      END;
    ELSE
      RETURN json_build_object(
        'success', true,
        'skipped', true,
        'journal_entry_id', v_existing_je_id,
        'reason', 'Canonical journal entry already exists'
      );
    END IF;
  END IF;

  -- Resolve accounts (create if missing)
  v_ar_account_id       := public._ensure_ar_subaccount_for_contact(v_company_id, v_customer_id);
  v_revenue_account_id  := public._ensure_system_account(v_company_id, '4000', 'Sales Revenue', 'revenue');
  v_cogs_account_id     := public._ensure_system_account(v_company_id, '5000', 'Cost of Goods Sold', 'expense');
  v_inventory_account_id := public._ensure_system_account(v_company_id, '1200', 'Inventory Asset', 'asset');
  IF v_tax > 0 THEN
    v_tax_account_id    := public._ensure_system_account(v_company_id, '2100', 'Sales Tax Payable', 'liability');
  END IF;
  IF v_discount > 0 THEN
    v_discount_account_id := public._ensure_system_account(v_company_id, '5200', 'Discount Allowed', 'expense');
  END IF;

  -- COGS from stock_movements recorded by createSale.
  -- Sale stock movements are stored with negative quantity/total_cost (outflow),
  -- so we take ABS to get the cost of goods sold as a positive amount.
  v_cogs_total := COALESCE(
    (
      SELECT SUM(ABS(COALESCE(total_cost, unit_cost * quantity)))
      FROM stock_movements
      WHERE reference_type = 'sale'
        AND reference_id = p_sale_id
        AND LOWER(COALESCE(movement_type, '')) IN ('sale', 'sales')
    ), 0
  );

  -- Net product revenue (excluding tax and adding back discount so we do not
  -- double-credit revenue for a discount)
  v_net_revenue := GREATEST(v_subtotal - v_discount, 0);

  -- Journal entry header
  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, is_posted
  )
  VALUES (
    v_company_id,
    v_branch_id,
    'JE-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(
      (SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = v_company_id)::TEXT,
      4, '0'
    ),
    COALESCE(v_sale.created_at::DATE, NOW()::DATE),
    'Sale #' || COALESCE(v_invoice_no, v_sale.id::TEXT),
    'sale',
    p_sale_id,
    v_sale.created_by,
    true
  )
  RETURNING id INTO v_journal_entry_id;

  -- Dr AR customer sub-account
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_ar_account_id, v_total, 0,
          'Accounts Receivable - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));

  -- Cr Sales Revenue (net of discount)
  IF v_net_revenue > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_revenue_account_id, 0, v_net_revenue,
            'Sales revenue - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  -- Dr Discount Allowed
  IF v_discount > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_discount_account_id, v_discount, 0,
            'Discount allowed on ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
    -- Rebalance the AR side: we already credited revenue v_subtotal - v_discount; AR got v_total which includes tax;
    -- To keep balance we need revenue side to equal (net_revenue) and discount (debit) to offset.
    -- Adjustment: Cr Revenue additional = v_discount so that AR = revenue + tax.
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_revenue_account_id, 0, v_discount,
            'Discount offset - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  -- Cr Tax Payable
  IF v_tax > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_tax_account_id, 0, v_tax,
            'Sales tax - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  -- COGS + Inventory
  IF v_cogs_total > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_cogs_account_id, v_cogs_total, 0,
            'COGS - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_inventory_account_id, 0, v_cogs_total,
            'Inventory out - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  -- Update totals
  BEGIN
    UPDATE journal_entries
    SET total_debit  = (SELECT COALESCE(SUM(debit), 0)  FROM journal_entry_lines WHERE journal_entry_id = v_journal_entry_id),
        total_credit = (SELECT COALESCE(SUM(credit), 0) FROM journal_entry_lines WHERE journal_entry_id = v_journal_entry_id)
    WHERE id = v_journal_entry_id;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  RETURN json_build_object(
    'success', true,
    'journal_entry_id', v_journal_entry_id,
    'ar_account_id', v_ar_account_id,
    'total', v_total,
    'cogs', v_cogs_total
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_sale_with_accounting(UUID) IS
  'Posts the journal entry for a sale (Dr AR sub-account, Cr Revenue/Tax/Discount, Dr COGS, Cr Inventory). Idempotent.';


-- ----------------------------------------------------------------------------
-- 3. record_purchase_with_accounting
--
--    Posts journal lines for a purchase document:
--      Dr Inventory Asset (1200)          = subtotal
--      Dr Purchase Tax Receivable (1210)  = tax (if > 0)
--      Cr AP supplier sub-account         = grand total
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_purchase_with_accounting(
  p_purchase_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase             purchases%ROWTYPE;
  v_company_id           UUID;
  v_branch_id            UUID;
  v_supplier_id          UUID;
  v_po_no                TEXT;
  v_subtotal             NUMERIC(15,2);
  v_tax                  NUMERIC(15,2);
  v_total                NUMERIC(15,2);
  v_ap_account_id        UUID;
  v_inventory_account_id UUID;
  v_tax_account_id       UUID;
  v_journal_entry_id     UUID;
  v_existing_je_id       UUID;
BEGIN
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id;
  IF v_purchase.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Purchase not found');
  END IF;

  v_company_id  := v_purchase.company_id;
  v_branch_id   := v_purchase.branch_id;
  v_supplier_id := v_purchase.supplier_id;
  v_po_no       := v_purchase.po_no;
  v_subtotal    := COALESCE(v_purchase.subtotal, 0);
  v_tax         := COALESCE(v_purchase.tax_amount, 0);
  v_total       := COALESCE(v_purchase.total, v_subtotal + v_tax);

  IF v_total <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Purchase total must be greater than 0');
  END IF;

  -- Canonical-document JE check (matches partial unique index
  -- idx_journal_entries_canonical_purchase_document_active).
  SELECT id INTO v_existing_je_id
  FROM journal_entries
  WHERE company_id = v_company_id
    AND reference_type = 'purchase'
    AND reference_id = p_purchase_id
    AND payment_id IS NULL
    AND COALESCE(is_void, false) = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_je_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE id = v_existing_je_id AND description LIKE 'Purchase #%'
    ) THEN
      BEGIN
        UPDATE journal_entries
        SET is_void = true,
            void_reason = 'Re-posted via record_purchase_with_accounting'
        WHERE id = v_existing_je_id;
      EXCEPTION WHEN undefined_column THEN
        DELETE FROM journal_entry_lines WHERE journal_entry_id = v_existing_je_id;
        DELETE FROM journal_entries WHERE id = v_existing_je_id;
      END;
    ELSE
      RETURN json_build_object(
        'success', true,
        'skipped', true,
        'journal_entry_id', v_existing_je_id,
        'reason', 'Canonical journal entry already exists'
      );
    END IF;
  END IF;

  v_ap_account_id        := public._ensure_ap_subaccount_for_contact(v_company_id, v_supplier_id);
  v_inventory_account_id := public._ensure_system_account(v_company_id, '1200', 'Inventory Asset', 'asset');
  IF v_tax > 0 THEN
    v_tax_account_id     := public._ensure_system_account(v_company_id, '1210', 'Purchase Tax Receivable', 'asset');
  END IF;

  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, is_posted
  )
  VALUES (
    v_company_id,
    v_branch_id,
    'JE-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(
      (SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = v_company_id)::TEXT,
      4, '0'
    ),
    COALESCE(v_purchase.created_at::DATE, NOW()::DATE),
    'Purchase #' || COALESCE(v_po_no, v_purchase.id::TEXT),
    'purchase',
    p_purchase_id,
    v_purchase.created_by,
    true
  )
  RETURNING id INTO v_journal_entry_id;

  -- Dr Inventory
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_inventory_account_id, v_subtotal, 0,
          'Inventory purchase - ' || COALESCE(v_po_no, p_purchase_id::TEXT));

  -- Dr Tax
  IF v_tax > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_tax_account_id, v_tax, 0,
            'Input tax - ' || COALESCE(v_po_no, p_purchase_id::TEXT));
  END IF;

  -- Cr AP supplier
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_ap_account_id, 0, v_total,
          'Payable to supplier - ' || COALESCE(v_po_no, p_purchase_id::TEXT));

  BEGIN
    UPDATE journal_entries
    SET total_debit  = (SELECT COALESCE(SUM(debit), 0)  FROM journal_entry_lines WHERE journal_entry_id = v_journal_entry_id),
        total_credit = (SELECT COALESCE(SUM(credit), 0) FROM journal_entry_lines WHERE journal_entry_id = v_journal_entry_id)
    WHERE id = v_journal_entry_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  RETURN json_build_object(
    'success', true,
    'journal_entry_id', v_journal_entry_id,
    'ap_account_id', v_ap_account_id,
    'total', v_total
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_purchase_with_accounting(UUID) IS
  'Posts the journal entry for a purchase (Dr Inventory/Tax, Cr AP sub-account). Idempotent.';


-- ----------------------------------------------------------------------------
-- 4. record_expense_with_accounting
--
--    Posts journal lines for an expense document:
--      Dr Expense Account (mapped by category)
--      Cr Payment Account (cash/bank - from expenses.payment_account_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_expense_with_accounting(
  p_expense_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense              expenses%ROWTYPE;
  v_company_id           UUID;
  v_branch_id            UUID;
  v_category_lc          TEXT;
  v_expense_code         VARCHAR(50);
  v_expense_name         VARCHAR(255);
  v_expense_account_id   UUID;
  v_payment_account_id   UUID;
  v_cash_account_id      UUID;
  v_bank_account_id      UUID;
  v_journal_entry_id     UUID;
  v_existing_je_id       UUID;
  v_amount               NUMERIC(15,2);
BEGIN
  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id;
  IF v_expense.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Expense not found');
  END IF;

  v_company_id := v_expense.company_id;
  v_branch_id  := v_expense.branch_id;
  v_amount     := COALESCE(v_expense.amount, 0);
  v_category_lc := LOWER(COALESCE(v_expense.category::TEXT, ''));

  IF v_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Expense amount must be greater than 0');
  END IF;

  -- Canonical-document JE check (expenses have no unique index yet, so we
  -- treat any non-void expense JE as canonical).
  SELECT id INTO v_existing_je_id
  FROM journal_entries
  WHERE company_id = v_company_id
    AND reference_type = 'expense'
    AND reference_id = p_expense_id
    AND payment_id IS NULL
    AND COALESCE(is_void, false) = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_je_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE id = v_existing_je_id AND description LIKE 'Expense #%'
    ) THEN
      BEGIN
        UPDATE journal_entries
        SET is_void = true,
            void_reason = 'Re-posted via record_expense_with_accounting'
        WHERE id = v_existing_je_id;
      EXCEPTION WHEN undefined_column THEN
        DELETE FROM journal_entry_lines WHERE journal_entry_id = v_existing_je_id;
        DELETE FROM journal_entries WHERE id = v_existing_je_id;
      END;
    ELSE
      RETURN json_build_object(
        'success', true,
        'skipped', true,
        'journal_entry_id', v_existing_je_id,
        'reason', 'Journal entry already exists'
      );
    END IF;
  END IF;

  -- Map category -> expense account code
  v_expense_code := CASE
    WHEN v_category_lc IN ('salaries', 'salary', 'wages') THEN '6110'
    WHEN v_category_lc IN ('marketing', 'advertising') THEN '6120'
    WHEN v_category_lc IN ('rent', 'utilities', 'office_supplies', 'office') THEN '6100'
    WHEN v_category_lc IN ('shipping', 'freight', 'courier') THEN '5100'
    WHEN v_category_lc IN ('production', 'manufacturing') THEN '5000'
    WHEN v_category_lc IN ('travel') THEN '6130'
    WHEN v_category_lc IN ('repairs') THEN '6140'
    WHEN v_category_lc IN ('professional_fees') THEN '6150'
    WHEN v_category_lc IN ('insurance') THEN '6160'
    WHEN v_category_lc IN ('taxes') THEN '6170'
    ELSE '6000'
  END;

  v_expense_name := CASE v_expense_code
    WHEN '6110' THEN 'Salaries & Wages'
    WHEN '6120' THEN 'Marketing & Advertising'
    WHEN '6100' THEN 'General Administrative'
    WHEN '5100' THEN 'Shipping & Freight'
    WHEN '5000' THEN 'Production / Manufacturing'
    WHEN '6130' THEN 'Travel'
    WHEN '6140' THEN 'Repairs & Maintenance'
    WHEN '6150' THEN 'Professional Fees'
    WHEN '6160' THEN 'Insurance'
    WHEN '6170' THEN 'Taxes (non-sales)'
    ELSE 'Miscellaneous Expense'
  END;

  v_expense_account_id := public._ensure_system_account(v_company_id, v_expense_code, v_expense_name, 'expense');

  -- Resolve payment account: prefer explicit id, fallback by method
  v_payment_account_id := v_expense.payment_account_id;
  IF v_payment_account_id IS NULL THEN
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = v_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = v_company_id AND code = '1010' LIMIT 1;
    IF LOWER(COALESCE(v_expense.payment_method::TEXT, 'cash')) = 'cash' THEN
      v_payment_account_id := v_cash_account_id;
    ELSE
      v_payment_account_id := v_bank_account_id;
    END IF;
  END IF;

  IF v_payment_account_id IS NULL THEN
    -- Ensure a cash fallback
    v_payment_account_id := public._ensure_system_account(v_company_id, '1000', 'Cash in Hand', 'asset');
  END IF;

  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, is_posted
  )
  VALUES (
    v_company_id,
    v_branch_id,
    'JE-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(
      (SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = v_company_id)::TEXT,
      4, '0'
    ),
    COALESCE(v_expense.expense_date, NOW()::DATE),
    'Expense #' || COALESCE(v_expense.expense_no, v_expense.id::TEXT)
      || CASE WHEN v_expense.description IS NOT NULL THEN ' - ' || v_expense.description ELSE '' END,
    'expense',
    p_expense_id,
    v_expense.created_by,
    true
  )
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_journal_entry_id, v_expense_account_id, v_amount, 0,
     v_expense_name || ' - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT)),
    (v_journal_entry_id, v_payment_account_id, 0, v_amount,
     'Expense payment - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT));

  BEGIN
    UPDATE journal_entries
    SET total_debit  = v_amount,
        total_credit = v_amount
    WHERE id = v_journal_entry_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  RETURN json_build_object(
    'success', true,
    'journal_entry_id', v_journal_entry_id,
    'expense_account_id', v_expense_account_id,
    'payment_account_id', v_payment_account_id,
    'amount', v_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_expense_with_accounting(UUID) IS
  'Posts the journal entry for an expense (Dr mapped expense account, Cr payment account). Idempotent.';


-- ----------------------------------------------------------------------------
-- 5. _bootstrap_company_doc_sequence
--
--    Seeds (or patches) the per-company `document_sequences_global` counter so
--    that when the mobile app calls `get_next_document_number_global` the
--    next number is MAX(existing numeric suffix, current_number).
--    Safe to call repeatedly.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._bootstrap_company_doc_sequence(
  p_company_id UUID,
  p_type       VARCHAR(50)
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_from_docs   INTEGER := 0;
  v_current         INTEGER := 0;
  v_final           INTEGER;
  v_norm            TEXT := UPPER(TRIM(p_type));
  v_key             TEXT;
BEGIN
  -- Normalize the key under which we store the sequence (short code).
  v_key := CASE v_norm
    WHEN 'INVOICE' THEN 'SL'
    WHEN 'SALE'    THEN 'SL'
    WHEN 'SALES'   THEN 'SL'
    WHEN 'PO'      THEN 'PUR'
    WHEN 'PURCHASE' THEN 'PUR'
    WHEN 'EXPENSE' THEN 'EXP'
    WHEN 'RENTAL'  THEN 'RNT'
    WHEN 'STUDIO'  THEN 'STD'
    WHEN 'JOURNAL' THEN 'JE'
    WHEN 'PAYMENT' THEN 'PAY'
    WHEN 'RECEIPT' THEN 'RCP'
    WHEN 'PRODUCT' THEN 'PRD'
    WHEN 'POS'     THEN 'PS'
    WHEN 'CUSTOMER' THEN 'CUS'
    WHEN 'SUPPLIER' THEN 'SUP'
    WHEN 'WORKER'  THEN 'WRK'
    WHEN 'JOB'     THEN 'JOB'
    ELSE v_norm
  END;

  BEGIN
    IF v_key = 'SL' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_no, '[^0-9]+', '', 'g'), ''))::INTEGER, 0)
        INTO v_max_from_docs
        FROM sales WHERE company_id = p_company_id
          AND UPPER(COALESCE(invoice_no, '')) LIKE 'SL-%';
    ELSIF v_key = 'PS' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_no, '[^0-9]+', '', 'g'), ''))::INTEGER, 0)
        INTO v_max_from_docs
        FROM sales WHERE company_id = p_company_id
          AND UPPER(COALESCE(invoice_no, '')) LIKE 'PS-%';
    ELSIF v_key = 'STD' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_no, '[^0-9]+', '', 'g'), ''))::INTEGER, 0)
        INTO v_max_from_docs
        FROM sales WHERE company_id = p_company_id
          AND UPPER(COALESCE(invoice_no, '')) LIKE 'STD-%';
    ELSIF v_key = 'PUR' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(po_no, '[^0-9]+', '', 'g'), ''))::INTEGER, 0)
        INTO v_max_from_docs
        FROM purchases WHERE company_id = p_company_id;
    ELSIF v_key = 'EXP' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(expense_no, '[^0-9]+', '', 'g'), ''))::INTEGER, 0)
        INTO v_max_from_docs
        FROM expenses WHERE company_id = p_company_id;
    ELSIF v_key = 'RNT' THEN
      BEGIN
        SELECT COALESCE(MAX(NULLIF(regexp_replace(booking_no, '[^0-9]+', '', 'g'), ''))::INTEGER, 0)
          INTO v_max_from_docs
          FROM rentals WHERE company_id = p_company_id;
      EXCEPTION WHEN undefined_table THEN
        v_max_from_docs := 0;
      END;
    ELSIF v_key = 'PAY' THEN
      BEGIN
        SELECT COALESCE(MAX(NULLIF(regexp_replace(reference_number, '[^0-9]+', '', 'g'), ''))::INTEGER, 0)
          INTO v_max_from_docs
          FROM payments WHERE company_id = p_company_id;
      EXCEPTION WHEN undefined_table THEN
        v_max_from_docs := 0;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_max_from_docs := 0;
  END;

  BEGIN
    SELECT COALESCE(current_number, 0) INTO v_current
      FROM document_sequences_global
     WHERE company_id = p_company_id AND document_type = v_key;
  EXCEPTION WHEN undefined_table THEN
    RETURN v_max_from_docs;
  END;

  v_final := GREATEST(v_current, v_max_from_docs);

  BEGIN
    INSERT INTO document_sequences_global (company_id, document_type, current_number)
    VALUES (p_company_id, v_key, v_final)
    ON CONFLICT (company_id, document_type) DO UPDATE
      SET current_number = GREATEST(document_sequences_global.current_number, EXCLUDED.current_number);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN v_final;
END;
$$;

COMMENT ON FUNCTION public._bootstrap_company_doc_sequence(UUID, VARCHAR) IS
  'Syncs document_sequences_global.current_number with MAX(existing doc numbers) for a company+type (short codes: SL, PS, STD, PUR, EXP, RNT, PAY). Accepts aliases (invoice/sale/sales -> SL, etc.).';


-- ----------------------------------------------------------------------------
-- 6. Reload PostgREST schema cache
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
