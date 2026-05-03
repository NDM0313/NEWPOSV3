-- record_sale_with_accounting (fix): COGS from purchase/opening WAC or products.cost_price (never sale OUT unit_cost).
-- Studio lines excluded by is_studio_product OR products.product_type = 'production'.
-- Revenue split 4000/4010 uses same studio detection; pool matches saleAccountingService.createSaleJournalEntry.
-- Dr AR = sales.total + shipment_charges; Cr 4110 Shipping Income when shipment_charges > 0.
-- Discount handling matches web: Dr 5200 + Cr 4000/4010 totaling (total + discount) when discount applies — no extra Cr to 4000 for discount.

SET search_path = public;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipment_charges NUMERIC(15,2) DEFAULT 0;

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
  v_shipment           NUMERIC(15,2);
  v_ar_debit           NUMERIC(15,2);
  v_revenue_pool       NUMERIC(15,2);
  v_cogs_total         NUMERIC(15,2);
  v_ar_account_id      UUID;
  v_revenue_account_id UUID;
  v_studio_rev_id      UUID;
  v_shipping_account_id UUID;
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

  SELECT COALESCE(shipment_charges, 0) INTO v_shipment FROM public.sales WHERE id = p_sale_id;

  IF v_total <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Sale total must be greater than 0');
  END IF;

  -- Mirror web: AR = total + shipping (sales.total is usually product side; shipping stored separately).
  v_ar_debit := ROUND((COALESCE(v_total, 0) + COALESCE(v_shipment, 0))::numeric, 2);
  -- Mirror saleAccountingService: revenueCredit = (hasDiscount ? total + discount : total), excluding shipping from split base.
  IF v_discount > 0.005 THEN
    v_revenue_pool := ROUND((COALESCE(v_total, 0) + COALESCE(v_discount, 0))::numeric, 2);
  ELSE
    v_revenue_pool := ROUND(COALESCE(v_total, 0)::numeric, 2);
  END IF;

  -- When sales.total includes tax and we Cr tax separately, split 4000/4010 on amount net of tax.
  IF v_tax > 0.005 THEN
    v_net_for_split := GREATEST(0, v_revenue_pool - v_tax);
  ELSE
    v_net_for_split := v_revenue_pool;
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
  ELSE
    v_cogs_total := 0;
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
    'cogs', v_cogs_total
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_sale_with_accounting(UUID) IS
  'Sale JE: Dr AR = total+shipment_charges; Cr 4000/4010 from revenue pool (TS parity); Cr 4110 shipping; COGS from WAC/cost_price, excludes studio/production lines.';
