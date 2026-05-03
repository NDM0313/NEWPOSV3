-- record_sale_with_accounting: Dr AR = sales.total; Cr 4000 + 4010 split by sales_items.is_studio_product;
-- COGS (5010) from sale OUT movements for lines where is_studio_product is false (excludes studio replica line).
-- Fixes TB imbalance when subtotal omits studio portion; fixes inflated COGS from studio SALE OUT.

SET search_path = public;

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
  v_studio_rev_id      UUID;
  v_tax_account_id     UUID;
  v_discount_account_id UUID;
  v_cogs_account_id    UUID;
  v_inventory_account_id UUID;
  v_journal_entry_id   UUID;
  v_existing_je_id     UUID;
  v_split_base         NUMERIC(15,2);
  v_studio_sum         NUMERIC(15,2);
  v_merch_sum          NUMERIC(15,2);
  v_line_sum           NUMERIC(15,2);
  v_cr_4000            NUMERIC(15,2);
  v_cr_4010            NUMERIC(15,2);
  v_has_sales_items    BOOLEAN;
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

  v_ar_account_id       := public._ensure_ar_subaccount_for_contact(v_company_id, v_customer_id);
  v_revenue_account_id  := public._ensure_system_account(v_company_id, '4000', 'Sales Revenue', 'revenue');
  v_studio_rev_id       := public._ensure_system_account(v_company_id, '4010', 'Studio Service Revenue', 'revenue');
  v_cogs_account_id     := public._ensure_system_account(v_company_id, '5010', 'COGS - Inventory', 'expense');
  v_inventory_account_id := public._ensure_system_account(v_company_id, '1200', 'Inventory Asset', 'asset');
  IF v_tax > 0 THEN
    v_tax_account_id    := public._ensure_system_account(v_company_id, '2100', 'Sales Tax Payable', 'liability');
  END IF;
  IF v_discount > 0 THEN
    v_discount_account_id := public._ensure_system_account(v_company_id, '5200', 'Discount Allowed', 'expense');
  END IF;

  v_cogs_total := 0;
  v_has_sales_items := to_regclass('public.sales_items') IS NOT NULL;
  IF v_has_sales_items THEN
    v_cogs_total := COALESCE(
      (
        SELECT SUM(ABS(COALESCE(sm.total_cost, sm.unit_cost * sm.quantity)))
        FROM stock_movements sm
        INNER JOIN public.sales_items si
          ON si.sale_id = p_sale_id AND si.product_id = sm.product_id
        WHERE sm.reference_type = 'sale'
          AND sm.reference_id = p_sale_id
          AND LOWER(COALESCE(sm.movement_type, '')) IN ('sale', 'sales')
          AND COALESCE(si.is_studio_product, false) = false
      ), 0
    );
  ELSE
    v_cogs_total := COALESCE(
      (
        SELECT SUM(ABS(COALESCE(total_cost, unit_cost * quantity)))
        FROM stock_movements
        WHERE reference_type = 'sale'
          AND reference_id = p_sale_id
          AND LOWER(COALESCE(movement_type, '')) IN ('sale', 'sales')
      ), 0
    );
  END IF;

  IF v_discount > 0.005 THEN
    v_split_base := GREATEST(COALESCE(v_subtotal, 0) - COALESCE(v_discount, 0), 0);
  ELSE
    v_split_base := GREATEST(
      COALESCE(v_total, 0) - COALESCE(v_tax, 0),
      GREATEST(COALESCE(v_subtotal, 0) - COALESCE(v_discount, 0), 0)
    );
  END IF;

  v_studio_sum := 0;
  v_merch_sum := 0;
  IF v_has_sales_items THEN
    SELECT
      COALESCE(SUM(si.total) FILTER (WHERE COALESCE(si.is_studio_product, false) = true), 0),
      COALESCE(SUM(si.total) FILTER (WHERE COALESCE(si.is_studio_product, false) = false), 0)
    INTO v_studio_sum, v_merch_sum
    FROM public.sales_items si
    WHERE si.sale_id = p_sale_id;
  END IF;

  v_line_sum := v_studio_sum + v_merch_sum;
  IF v_line_sum > 0.005 AND v_split_base > 0 THEN
    v_cr_4010 := ROUND(v_split_base * (v_studio_sum / v_line_sum) * 100) / 100;
    v_cr_4000 := v_split_base - v_cr_4010;
  ELSE
    v_cr_4000 := v_split_base;
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
  VALUES (v_journal_entry_id, v_ar_account_id, v_total, 0,
          'Accounts Receivable - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));

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

  IF v_discount > 0.005 AND v_discount_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_discount_account_id, v_discount, 0,
            'Discount allowed on ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_revenue_account_id, 0, v_discount,
            'Discount offset - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  IF v_tax > 0 AND v_tax_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_tax_account_id, 0, v_tax,
            'Sales tax - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
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
    'cogs', v_cogs_total
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_sale_with_accounting(UUID) IS
  'Sale JE: Dr AR = total; Cr 4000/4010 by line weights; COGS excludes is_studio_product sale movements.';
