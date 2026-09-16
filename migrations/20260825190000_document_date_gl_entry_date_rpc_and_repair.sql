-- Document calendar dates drive journal_entries.entry_date for sale/purchase RPCs.
-- Improves Asia/Karachi casting for po_date/invoice_date and re-repairs active JEs.

SET search_path = public;

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
      UPDATE journal_entries
      SET entry_date = COALESCE(v_sale.invoice_date::date, (timezone('Asia/Karachi', v_sale.created_at))::date, CURRENT_DATE)
      WHERE id = v_existing_je_id
        AND entry_date IS DISTINCT FROM COALESCE(v_sale.invoice_date::date, (timezone('Asia/Karachi', v_sale.created_at))::date, CURRENT_DATE);
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
    COALESCE(v_sale.invoice_date::date, (timezone('Asia/Karachi', v_sale.created_at))::date, CURRENT_DATE),
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
      SELECT sc.id, sc.charge_type, sc.amount, sc.tailor_contact_id, sc.expense_category_id
      FROM public.sale_charges sc
      WHERE sc.sale_id = p_sale_id
        AND LOWER(TRIM(COALESCE(sc.charge_type, ''))) NOT IN ('discount', 'shipping')
        AND COALESCE(sc.amount, 0) > 0.005
    LOOP
      v_tailor_name := NULL;
      IF v_charge.expense_category_id IS NOT NULL THEN
        SELECT name INTO v_tailor_name FROM public.expense_categories WHERE id = v_charge.expense_category_id;
      END IF;
      IF v_tailor_name IS NULL AND v_charge.tailor_contact_id IS NOT NULL THEN
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

-- ---------------------------------------------------------------------------
-- record_purchase_with_accounting — entry_date from po_date
-- ---------------------------------------------------------------------------
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
  v_entry_date           DATE;
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
  v_entry_date  := COALESCE(
    (timezone('Asia/Karachi', v_purchase.po_date::timestamptz))::date,
    (timezone('Asia/Karachi', v_purchase.created_at))::date,
    CURRENT_DATE
  );

  IF v_total <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Purchase total must be greater than 0');
  END IF;

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
      UPDATE journal_entries
      SET entry_date = v_entry_date
      WHERE id = v_existing_je_id
        AND entry_date IS DISTINCT FROM v_entry_date;
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
    v_entry_date,
    'Purchase #' || COALESCE(v_po_no, v_purchase.id::TEXT),
    'purchase',
    p_purchase_id,
    v_purchase.created_by,
    true
  )
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_inventory_account_id, v_subtotal, 0,
          'Inventory purchase - ' || COALESCE(v_po_no, p_purchase_id::TEXT));

  IF v_tax > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_tax_account_id, v_tax, 0,
            'Input tax - ' || COALESCE(v_po_no, p_purchase_id::TEXT));
  END IF;

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
  'Posts purchase JE (Dr Inventory/Tax, Cr AP). entry_date from po_date (Asia/Karachi).';

-- ---------------------------------------------------------------------------
-- Improve source-date trigger (Asia/Karachi calendar day)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_journal_entry_source_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
BEGIN
  IF NEW.payment_id IS NOT NULL THEN
    SELECT p.payment_date
    INTO v_date
    FROM public.payments p
    WHERE p.id = NEW.payment_id;
  ELSIF NEW.reference_type = 'sale' THEN
    SELECT COALESCE(s.invoice_date::date, (timezone('Asia/Karachi', s.created_at))::date)
    INTO v_date
    FROM public.sales s
    WHERE s.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'purchase' THEN
    SELECT COALESCE(
      (timezone('Asia/Karachi', p.po_date::timestamptz))::date,
      (timezone('Asia/Karachi', p.created_at))::date
    )
    INTO v_date
    FROM public.purchases p
    WHERE p.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'expense' THEN
    SELECT e.expense_date INTO v_date
    FROM public.expenses e
    WHERE e.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'sale_return' THEN
    SELECT r.return_date::date INTO v_date
    FROM public.sale_returns r
    WHERE r.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'purchase_return' THEN
    SELECT r.return_date::date INTO v_date
    FROM public.purchase_returns r
    WHERE r.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'rental'
        AND COALESCE(NEW.action_fingerprint, '') LIKE 'rental_party_revenue:%' THEN
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

DROP TRIGGER IF EXISTS trg_sync_journal_entry_source_date ON public.journal_entries;
CREATE TRIGGER trg_sync_journal_entry_source_date
BEFORE INSERT OR UPDATE OF reference_type, reference_id, payment_id, entry_date, action_fingerprint
ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_journal_entry_source_date();

-- Re-repair active document JEs (timezone-aware for purchases)
UPDATE public.journal_entries je
SET entry_date = s.invoice_date::date
FROM public.sales s
WHERE je.reference_type = 'sale'
  AND je.reference_id = s.id
  AND je.payment_id IS NULL
  AND COALESCE(je.is_void, false) = false
  AND s.invoice_date IS NOT NULL
  AND je.entry_date IS DISTINCT FROM s.invoice_date::date;

UPDATE public.journal_entries je
SET entry_date = (timezone('Asia/Karachi', p.po_date::timestamptz))::date
FROM public.purchases p
WHERE je.reference_type = 'purchase'
  AND je.reference_id = p.id
  AND je.payment_id IS NULL
  AND COALESCE(je.is_void, false) = false
  AND p.po_date IS NOT NULL
  AND je.entry_date IS DISTINCT FROM (timezone('Asia/Karachi', p.po_date::timestamptz))::date;

UPDATE public.journal_entries je
SET entry_date = p.payment_date
FROM public.payments p
WHERE je.payment_id = p.id
  AND COALESCE(je.is_void, false) = false
  AND p.payment_date IS NOT NULL
  AND je.entry_date IS DISTINCT FROM p.payment_date;

UPDATE public.journal_entries je
SET entry_date = e.expense_date
FROM public.expenses e
WHERE je.reference_type = 'expense'
  AND je.reference_id = e.id
  AND je.payment_id IS NULL
  AND COALESCE(je.is_void, false) = false
  AND e.expense_date IS NOT NULL
  AND je.entry_date IS DISTINCT FROM e.expense_date;

UPDATE public.journal_entries je
SET entry_date = r.return_date::date
FROM public.sale_returns r
WHERE je.reference_type = 'sale_return'
  AND je.reference_id = r.id
  AND COALESCE(je.is_void, false) = false
  AND r.return_date IS NOT NULL
  AND je.entry_date IS DISTINCT FROM r.return_date::date;

UPDATE public.journal_entries je
SET entry_date = r.return_date::date
FROM public.purchase_returns r
WHERE je.reference_type = 'purchase_return'
  AND je.reference_id = r.id
  AND COALESCE(je.is_void, false) = false
  AND r.return_date IS NOT NULL
  AND je.entry_date IS DISTINCT FROM r.return_date::date;

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

COMMENT ON FUNCTION public.record_sale_with_accounting(UUID) IS
  'Posts sale document JE. entry_date from invoice_date (fallback created_at Asia/Karachi).';
