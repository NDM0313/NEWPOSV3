-- 4120 Package Split: Extra Service Income as tracking/clearing node for sale extras.
-- Checkbox ON/OFF controls sales.total / AR only; JE always Cr 4120 for extras, Cr 4000/4010 = pool - extras.
-- Expenditure (stitching/dyeing + sale_charge_id): Dr 4120 / Cr cash with sub-ledger tags.

SET search_path = public;

-- ----------------------------------------------------------------------------
-- 1. Schema
-- ----------------------------------------------------------------------------
ALTER TABLE public.sale_charges
  ADD COLUMN IF NOT EXISTS charged_to_customer BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.sale_charges
  ADD COLUMN IF NOT EXISTS tailor_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS sale_charge_id UUID REFERENCES public.sale_charges(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS tailor_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;

ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS sale_charge_id UUID REFERENCES public.sale_charges(id) ON DELETE SET NULL;

ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS tailor_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sale_charges.charged_to_customer IS
  'When false, extra is inclusive in package (not on customer invoice total); still credits 4120 on sale JE.';
COMMENT ON COLUMN public.sale_charges.tailor_contact_id IS
  'Tailor/dyer contact for 4120 sub-ledger (required for service extra charges).';

-- ----------------------------------------------------------------------------
-- 2. Validate inclusive extras (25% cap)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_sale_extra_charges_inclusive(p_sale_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale       sales%ROWTYPE;
  v_invoice_val NUMERIC(15,2);
  v_max        NUMERIC(15,2);
  v_row        RECORD;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  IF v_sale.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sale not found');
  END IF;

  v_invoice_val := ROUND(
    (COALESCE(v_sale.total, 0) + COALESCE(v_sale.shipment_charges, 0))::numeric,
    2
  );
  IF v_invoice_val <= 0.005 THEN
    RETURN json_build_object('success', true);
  END IF;

  v_max := ROUND((v_invoice_val * 0.25)::numeric, 2);

  FOR v_row IN
    SELECT sc.id, sc.charge_type, sc.amount
    FROM public.sale_charges sc
    WHERE sc.sale_id = p_sale_id
      AND COALESCE(sc.charged_to_customer, true) = false
      AND LOWER(TRIM(COALESCE(sc.charge_type, ''))) NOT IN ('discount', 'shipping')
      AND COALESCE(sc.amount, 0) > 0.005
  LOOP
    IF ROUND(COALESCE(v_row.amount, 0)::numeric, 2) > v_max + 0.005 THEN
      RETURN json_build_object(
        'success', false,
        'error',
        format(
          'Inclusive extra expense (%s: Rs. %s) cannot exceed 25%% of invoice total (max Rs. %s).',
          COALESCE(v_row.charge_type, 'extra'),
          to_char(v_row.amount, 'FM999,999,990.00'),
          to_char(v_max, 'FM999,999,990.00')
        )
      );
    END IF;
  END LOOP;

  RETURN json_build_object('success', true, 'max_inclusive_extra', v_max);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Open 4120 balance per sale_charge (credits - debits on tagged lines)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_4120_balance_for_sale_charge(p_sale_charge_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_extra_acct UUID;
  v_credits    NUMERIC(15,2);
  v_debits     NUMERIC(15,2);
BEGIN
  IF p_sale_charge_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT s.company_id INTO v_company_id
  FROM public.sale_charges sc
  INNER JOIN public.sales s ON s.id = sc.sale_id
  WHERE sc.id = p_sale_charge_id;

  IF v_company_id IS NULL THEN
    RETURN 0;
  END IF;

  v_extra_acct := public._ensure_system_account(
    v_company_id, '4120', 'Extra Service Income', 'revenue'
  );

  SELECT
    COALESCE(SUM(jel.credit), 0),
    COALESCE(SUM(jel.debit), 0)
  INTO v_credits, v_debits
  FROM public.journal_entry_lines jel
  INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.sale_charge_id = p_sale_charge_id
    AND jel.account_id = v_extra_acct
    AND COALESCE(je.is_void, false) = false;

  RETURN GREATEST(0, ROUND((COALESCE(v_credits, 0) - COALESCE(v_debits, 0))::numeric, 2));
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Sub-ledger listing for expenditure UI
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extra_service_clearing_lines(
  p_company_id UUID,
  p_tailor_contact_id UUID DEFAULT NULL
)
RETURNS TABLE (
  sale_charge_id UUID,
  sale_id UUID,
  invoice_no TEXT,
  charge_type TEXT,
  amount NUMERIC,
  charged_to_customer BOOLEAN,
  tailor_contact_id UUID,
  tailor_name TEXT,
  open_balance NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.sale_id,
    COALESCE(s.invoice_no, s.order_no, s.id::TEXT),
    sc.charge_type::TEXT,
    sc.amount,
    COALESCE(sc.charged_to_customer, true),
    sc.tailor_contact_id,
    c.name,
    public.open_4120_balance_for_sale_charge(sc.id)
  FROM public.sale_charges sc
  INNER JOIN public.sales s ON s.id = sc.sale_id
  LEFT JOIN public.contacts c ON c.id = sc.tailor_contact_id
  WHERE s.company_id = p_company_id
    AND LOWER(TRIM(COALESCE(sc.charge_type, ''))) NOT IN ('discount', 'shipping')
    AND COALESCE(sc.amount, 0) > 0.005
    AND (p_tailor_contact_id IS NULL OR sc.tailor_contact_id = p_tailor_contact_id)
    AND public.open_4120_balance_for_sale_charge(sc.id) > 0.005
  ORDER BY s.created_at DESC, sc.created_at DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. record_sale_with_accounting — package split + per-line 4120 tags
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_sale_with_accounting(p_sale_id UUID)
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
  v_shipment           NUMERIC(15,2);
  v_extra              NUMERIC(15,2);
  v_extra_from_charges NUMERIC(15,2);
  v_ar_debit           NUMERIC(15,2);
  v_revenue_pool       NUMERIC(15,2);
  v_cogs_total         NUMERIC(15,2);
  v_ar_account_id      UUID;
  v_revenue_account_id UUID;
  v_studio_rev_id      UUID;
  v_shipping_account_id UUID;
  v_extra_service_account_id UUID;
  v_tax_account_id     UUID;
  v_discount_account_id UUID;
  v_cogs_account_id    UUID;
  v_inventory_account_id UUID;
  v_journal_entry_id   UUID;
  v_existing_je_id     UUID;
  v_studio_sum         NUMERIC(15,2);
  v_merch_sum          NUMERIC(15,2);
  v_line_sum           NUMERIC(15,2);
  v_cr_4000            NUMERIC(15,2);
  v_cr_4010            NUMERIC(15,2);
  v_net_for_split      NUMERIC(15,2);
  v_has_sales_items    BOOLEAN;
  v_validation         JSON;
  v_charge             RECORD;
  v_tailor_name        TEXT;
  v_line_desc          TEXT;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  IF v_sale.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sale not found');
  END IF;

  v_validation := public.validate_sale_extra_charges_inclusive(p_sale_id);
  IF COALESCE((v_validation->>'success')::boolean, false) = false THEN
    RETURN v_validation;
  END IF;

  v_company_id  := v_sale.company_id;
  v_branch_id   := v_sale.branch_id;
  v_customer_id := v_sale.customer_id;
  v_invoice_no  := v_sale.invoice_no;
  v_subtotal    := COALESCE(v_sale.subtotal, 0);
  v_tax         := COALESCE(v_sale.tax_amount, 0);
  v_discount    := COALESCE(v_sale.discount_amount, 0);
  v_total       := COALESCE(v_sale.total, v_subtotal + v_tax - v_discount);

  SELECT COALESCE(shipment_charges, 0) INTO v_shipment FROM public.sales WHERE id = p_sale_id;

  SELECT COALESCE(SUM(sc.amount), 0)
  INTO v_extra_from_charges
  FROM public.sale_charges sc
  WHERE sc.sale_id = p_sale_id
    AND LOWER(TRIM(COALESCE(sc.charge_type, ''))) NOT IN ('discount', 'shipping');

  v_extra := ROUND(
    COALESCE(
      NULLIF(v_extra_from_charges, 0),
      COALESCE(v_sale.extra_expenses, 0),
      0
    )::numeric,
    2
  );

  IF v_total <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Sale total must be greater than 0');
  END IF;

  v_ar_debit := ROUND((COALESCE(v_total, 0) + COALESCE(v_shipment, 0))::numeric, 2);

  IF v_discount > 0.005 THEN
    v_revenue_pool := ROUND((COALESCE(v_total, 0) + COALESCE(v_discount, 0))::numeric, 2);
  ELSE
    v_revenue_pool := ROUND(COALESCE(v_total, 0)::numeric, 2);
  END IF;

  IF v_tax > 0.005 THEN
    v_net_for_split := GREATEST(0, v_revenue_pool - v_tax - v_extra);
  ELSE
    v_net_for_split := GREATEST(0, v_revenue_pool - v_extra);
  END IF;

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

  v_ar_account_id        := public._ensure_ar_subaccount_for_contact(v_company_id, v_customer_id);
  v_revenue_account_id   := public._ensure_system_account(v_company_id, '4000', 'Sales Revenue', 'revenue');
  v_studio_rev_id        := public._ensure_system_account(v_company_id, '4010', 'Studio Service Revenue', 'revenue');
  v_shipping_account_id  := public._ensure_system_account(v_company_id, '4110', 'Shipping Income', 'revenue');
  v_extra_service_account_id := public._ensure_system_account(v_company_id, '4120', 'Extra Service Income', 'revenue');
  v_cogs_account_id      := public._ensure_system_account(v_company_id, '5010', 'COGS - Inventory', 'expense');
  v_inventory_account_id := public._ensure_system_account(v_company_id, '1200', 'Inventory Asset', 'asset');
  IF v_tax > 0 THEN
    v_tax_account_id := public._ensure_system_account(v_company_id, '2100', 'Sales Tax Payable', 'liability');
  END IF;
  IF v_discount > 0.005 THEN
    v_discount_account_id := public._ensure_system_account(v_company_id, '5200', 'Discount Allowed', 'expense');
  END IF;

  v_has_sales_items := to_regclass('public.sales_items') IS NOT NULL;

  v_cogs_total := 0;
  IF v_has_sales_items THEN
    SELECT COALESCE(SUM(
      ROUND((
        COALESCE(si.quantity, 0) * COALESCE(w.wac, p.cost_price, 0)
      )::numeric, 2)
    ), 0)
    INTO v_cogs_total
    FROM public.sales_items si
    INNER JOIN public.products p ON p.id = si.product_id AND p.company_id = v_company_id
    LEFT JOIN LATERAL (
      SELECT
        CASE
          WHEN SUM(ABS(sm.quantity)) > 0.00001 THEN
            SUM(ABS(COALESCE(sm.total_cost, sm.unit_cost * ABS(sm.quantity)))) / SUM(ABS(sm.quantity))
        END AS wac
      FROM public.stock_movements sm
      WHERE sm.company_id = v_company_id
        AND sm.product_id = si.product_id
        AND LOWER(TRIM(COALESCE(sm.movement_type, ''))) IN (
          'purchase', 'opening_stock', 'opening', 'opening balance', 'opening_balance'
        )
    ) w ON true
    WHERE si.sale_id = p_sale_id
      AND COALESCE(si.is_studio_product, false) = false
      AND COALESCE(p.product_type, '') <> 'production';
  END IF;

  v_studio_sum := 0;
  v_merch_sum := 0;
  IF v_has_sales_items THEN
    SELECT
      COALESCE(SUM(si.total) FILTER (
        WHERE COALESCE(si.is_studio_product, false) = true
           OR COALESCE(p.product_type, '') = 'production'
      ), 0),
      COALESCE(SUM(si.total) FILTER (
        WHERE COALESCE(si.is_studio_product, false) = false
          AND COALESCE(p.product_type, '') <> 'production'
      ), 0)
    INTO v_studio_sum, v_merch_sum
    FROM public.sales_items si
    LEFT JOIN public.products p ON p.id = si.product_id
    WHERE si.sale_id = p_sale_id;
  END IF;

  v_line_sum := COALESCE(v_studio_sum, 0) + COALESCE(v_merch_sum, 0);
  IF v_line_sum > 0.005 AND v_net_for_split > 0 THEN
    v_cr_4010 := ROUND((v_net_for_split * (v_studio_sum / v_line_sum))::numeric * 100) / 100;
    v_cr_4000 := v_net_for_split - v_cr_4010;
  ELSE
    v_cr_4000 := v_net_for_split;
    v_cr_4010 := 0;
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
    COALESCE(v_sale.created_at::DATE, NOW()::DATE),
    'Sale #' || COALESCE(v_invoice_no, v_sale.id::TEXT),
    'sale',
    p_sale_id,
    v_sale.created_by,
    true
  )
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_ar_account_id, v_ar_debit, 0,
          'Accounts Receivable - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));

  IF v_discount > 0.005 AND v_discount_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_discount_account_id, v_discount, 0,
            'Discount allowed on ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  IF v_cr_4000 > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_revenue_account_id, 0, v_cr_4000,
            'Sales revenue - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  IF v_cr_4010 > 0 AND v_studio_rev_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_studio_rev_id, 0, v_cr_4010,
            'Studio Service Revenue - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  ELSIF v_cr_4010 > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_revenue_account_id, 0, v_cr_4010,
            'Studio Service Revenue (fallback 4000) - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  IF v_extra_service_account_id IS NOT NULL THEN
    FOR v_charge IN
      SELECT sc.id, sc.charge_type, sc.amount, sc.tailor_contact_id
      FROM public.sale_charges sc
      WHERE sc.sale_id = p_sale_id
        AND LOWER(TRIM(COALESCE(sc.charge_type, ''))) NOT IN ('discount', 'shipping')
        AND COALESCE(sc.amount, 0) > 0.005
    LOOP
      v_tailor_name := NULL;
      IF v_charge.tailor_contact_id IS NOT NULL THEN
        SELECT name INTO v_tailor_name FROM public.contacts WHERE id = v_charge.tailor_contact_id;
      END IF;
      v_line_desc := 'Extra Service - ' || COALESCE(v_invoice_no, p_sale_id::TEXT)
        || ' - ' || COALESCE(v_tailor_name, 'Tailor')
        || ' - ' || COALESCE(v_charge.charge_type, 'extra');

      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, debit, credit, description,
        sale_id, sale_charge_id, tailor_contact_id
      )
      VALUES (
        v_journal_entry_id,
        v_extra_service_account_id,
        0,
        ROUND(COALESCE(v_charge.amount, 0)::numeric, 2),
        v_line_desc,
        p_sale_id,
        v_charge.id,
        v_charge.tailor_contact_id
      );
    END LOOP;
  END IF;

  IF v_extra > 0.005 AND v_extra_service_account_id IS NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, sale_id)
    VALUES (v_journal_entry_id, v_revenue_account_id, 0, v_extra,
            'Extra Service Income (fallback 4000) - ' || COALESCE(v_invoice_no, p_sale_id::TEXT),
            p_sale_id);
  END IF;

  IF v_tax > 0 AND v_tax_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_tax_account_id, 0, v_tax,
            'Sales tax - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  IF COALESCE(v_shipment, 0) > 0.005 AND v_shipping_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_shipping_account_id, 0, v_shipment,
            'Shipping income - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  IF v_cogs_total > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_cogs_account_id, v_cogs_total, 0,
            'COGS - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_inventory_account_id, 0, v_cogs_total,
            'Inventory out - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

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
    'ar_debit', v_ar_debit,
    'cogs', v_cogs_total,
    'extra_service_income', v_extra,
    'merchandise_revenue', v_net_for_split
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_sale_with_accounting(UUID) IS
  '4120 package split: Dr AR = sales.total + shipping; Cr 4000/4010 = pool minus all extras; Cr 4120 per extra charge (tagged sale/tailor/charge); inclusive extras validated at 25% of invoice.';

-- ----------------------------------------------------------------------------
-- 6. record_expense_with_accounting — Dr 4120 for linked stitching/dyeing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_expense_with_accounting(p_expense_id UUID)
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
  v_extra_service_id     UUID;
  v_open_bal             NUMERIC(15,2);
  v_sale_id              UUID;
  v_sale_charge_id       UUID;
  v_tailor_id            UUID;
  v_invoice_no           TEXT;
  v_is_clearing          BOOLEAN;
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

  v_sale_id := v_expense.sale_id;
  v_sale_charge_id := v_expense.sale_charge_id;
  v_tailor_id := v_expense.tailor_contact_id;

  v_is_clearing := (
    v_sale_charge_id IS NOT NULL
    AND v_category_lc IN ('stitching', 'dying', 'dyeing', 'lining')
  );

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
    v_payment_account_id := public._ensure_system_account(v_company_id, '1000', 'Cash in Hand', 'asset');
  END IF;

  IF v_is_clearing THEN
    v_extra_service_id := public._ensure_system_account(
      v_company_id, '4120', 'Extra Service Income', 'revenue'
    );
    v_open_bal := public.open_4120_balance_for_sale_charge(v_sale_charge_id);
    IF v_amount > v_open_bal + 0.005 THEN
      RETURN json_build_object(
        'success', false,
        'error',
        format(
          'Payout Rs. %s exceeds open Extra Service balance Rs. %s for this sale charge.',
          to_char(v_amount, 'FM999,999,990.00'),
          to_char(v_open_bal, 'FM999,999,990.00')
        )
      );
    END IF;

    IF v_sale_id IS NULL THEN
      SELECT sc.sale_id INTO v_sale_id FROM public.sale_charges sc WHERE sc.id = v_sale_charge_id;
    END IF;
    IF v_tailor_id IS NULL THEN
      SELECT sc.tailor_contact_id INTO v_tailor_id FROM public.sale_charges sc WHERE sc.id = v_sale_charge_id;
    END IF;

    SELECT COALESCE(s.invoice_no, s.order_no, s.id::TEXT) INTO v_invoice_no
    FROM public.sales s WHERE s.id = v_sale_id;

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
        || ' - 4120 clearing'
        || CASE WHEN v_invoice_no IS NOT NULL THEN ' - ' || v_invoice_no ELSE '' END,
      'expense',
      p_expense_id,
      v_expense.created_by,
      true
    )
    RETURNING id INTO v_journal_entry_id;

    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, debit, credit, description,
      sale_id, sale_charge_id, tailor_contact_id
    )
    VALUES (
      v_journal_entry_id,
      v_extra_service_id,
      v_amount,
      0,
      'Extra Service clearing - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT),
      v_sale_id,
      v_sale_charge_id,
      v_tailor_id
    );

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (
      v_journal_entry_id,
      v_payment_account_id,
      0,
      v_amount,
      'Tailor payout - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT)
    );

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
      'expense_account_id', v_extra_service_id,
      'payment_account_id', v_payment_account_id,
      'amount', v_amount,
      'clearing_4120', true,
      'open_balance_after', GREATEST(0, v_open_bal - v_amount)
    );
  END IF;

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
  'Expense JE: stitching/dyeing + sale_charge_id → Dr 4120 / Cr cash (sub-ledger tags). Other categories → Dr mapped expense / Cr cash.';
