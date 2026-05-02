-- ============================================================================
-- Physical sale COGS posts to 5010 (COGS - Inventory), not 5000 (Cost of
-- Production / studio worker accruals). Keeps P&L separation from studio labor.
-- Updates: record_sale_with_accounting, cancel_sale_full_void COGS resolution.
-- ============================================================================

SET search_path = public;

-- ----------------------------------------------------------------------------
-- record_sale_with_accounting — Dr COGS - Inventory (5010), Cr Inventory (1200)
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
  v_cogs_account_id     := public._ensure_system_account(v_company_id, '5010', 'COGS - Inventory', 'expense');
  v_inventory_account_id := public._ensure_system_account(v_company_id, '1200', 'Inventory Asset', 'asset');
  IF v_tax > 0 THEN
    v_tax_account_id    := public._ensure_system_account(v_company_id, '2100', 'Sales Tax Payable', 'liability');
  END IF;
  IF v_discount > 0 THEN
    v_discount_account_id := public._ensure_system_account(v_company_id, '5200', 'Discount Allowed', 'expense');
  END IF;

  v_cogs_total := COALESCE(
    (
      SELECT SUM(ABS(COALESCE(total_cost, unit_cost * quantity)))
      FROM stock_movements
      WHERE reference_type = 'sale'
        AND reference_id = p_sale_id
        AND LOWER(COALESCE(movement_type, '')) IN ('sale', 'sales')
    ), 0
  );

  v_net_revenue := GREATEST(v_subtotal - v_discount, 0);

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

  IF v_net_revenue > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_revenue_account_id, 0, v_net_revenue,
            'Sales revenue - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  IF v_discount > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_discount_account_id, v_discount, 0,
            'Discount allowed on ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_revenue_account_id, 0, v_discount,
            'Discount offset - ' || COALESCE(v_invoice_no, p_sale_id::TEXT));
  END IF;

  IF v_tax > 0 THEN
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
  'Posts sale document JE (Dr AR, Cr Revenue/Tax/Discount, Dr 5010 COGS - Inventory, Cr 1200 Inventory). Idempotent.';

-- ----------------------------------------------------------------------------
-- cancel_sale_full_void — resolve COGS account: 5010, then legacy 5000, then 5100
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_sale_full_void(
    p_sale_id      UUID,
    p_user_id      UUID DEFAULT NULL,
    p_reason       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale              RECORD;
    v_company_id        UUID;
    v_branch_id         UUID;
    v_already_cancelled BOOLEAN := FALSE;
    v_ar_account        UUID;
    v_cash_account      UUID;
    v_bank_account      UUID;
    v_sales_account     UUID;
    v_inventory_account UUID;
    v_cogs_account      UUID;
    v_discount_account  UUID;
    v_reverse_cogs      NUMERIC(15,2) := 0;
    v_je_id             UUID;
    v_stock_created     INT := 0;
    v_pay_account       UUID;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
    IF v_sale.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
    END IF;

    v_company_id := v_sale.company_id;
    v_branch_id  := v_sale.branch_id;

    IF v_sale.status = 'cancelled' THEN
        v_already_cancelled := TRUE;
    END IF;

    UPDATE public.sales
       SET status        = 'cancelled',
           cancelled_at  = COALESCE(cancelled_at, NOW()),
           cancelled_by  = COALESCE(cancelled_by, p_user_id),
           cancel_reason = COALESCE(cancel_reason, p_reason),
           updated_at    = NOW()
     WHERE id = p_sale_id;

    IF NOT EXISTS (
        SELECT 1 FROM public.stock_movements
         WHERE reference_type = 'sale'
           AND reference_id   = p_sale_id
           AND movement_type  = 'SALE_CANCELLED'
    ) THEN
        INSERT INTO public.stock_movements (
            company_id, branch_id, product_id, variation_id,
            movement_type, quantity, unit_cost, total_cost,
            reference_type, reference_id, notes, created_by, created_at
        )
        SELECT company_id, branch_id, product_id, variation_id,
               'SALE_CANCELLED',
               -quantity,
               unit_cost,
               -total_cost,
               'sale',
               p_sale_id,
               'Auto-reverse on sale cancel',
               p_user_id,
               NOW()
          FROM public.stock_movements
         WHERE reference_type = 'sale'
           AND reference_id   = p_sale_id
           AND movement_type <> 'SALE_CANCELLED';
        GET DIAGNOSTICS v_stock_created = ROW_COUNT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.journal_entries
         WHERE company_id     = v_company_id
           AND reference_type = 'sale_reversal'
           AND reference_id   = p_sale_id
    ) THEN
        SELECT id INTO v_ar_account        FROM public.accounts WHERE company_id = v_company_id AND code = '1100' LIMIT 1;
        SELECT id INTO v_cash_account      FROM public.accounts WHERE company_id = v_company_id AND code = '1000' LIMIT 1;
        SELECT id INTO v_bank_account      FROM public.accounts WHERE company_id = v_company_id AND code = '1010' LIMIT 1;
        SELECT id INTO v_sales_account     FROM public.accounts WHERE company_id = v_company_id AND code = '4000' LIMIT 1;
        SELECT id INTO v_inventory_account FROM public.accounts WHERE company_id = v_company_id AND code = '1200' LIMIT 1;
        SELECT id INTO v_cogs_account      FROM public.accounts WHERE company_id = v_company_id AND code = '5010' LIMIT 1;
        IF v_cogs_account IS NULL THEN
          SELECT id INTO v_cogs_account    FROM public.accounts WHERE company_id = v_company_id AND code = '5000' LIMIT 1;
        END IF;
        IF v_cogs_account IS NULL THEN
          SELECT id INTO v_cogs_account    FROM public.accounts WHERE company_id = v_company_id AND code = '5100' LIMIT 1;
        END IF;
        SELECT id INTO v_discount_account  FROM public.accounts WHERE company_id = v_company_id AND code = '5200' LIMIT 1;

        SELECT COALESCE(SUM(ABS(total_cost)), 0) INTO v_reverse_cogs
          FROM public.stock_movements
         WHERE reference_type = 'sale'
           AND reference_id   = p_sale_id
           AND movement_type <> 'SALE_CANCELLED';

        v_pay_account := CASE WHEN v_sale.payment_method = 'cash' THEN v_cash_account ELSE v_bank_account END;

        INSERT INTO public.journal_entries (
            company_id, branch_id, entry_no, entry_date, description,
            reference_type, reference_id, created_by, is_posted, posted_at
        )
        VALUES (
            v_company_id, v_branch_id,
            'JE-REV-' || COALESCE(v_sale.invoice_no, p_sale_id::text),
            CURRENT_DATE,
            'Sale Cancellation Reversal: ' || COALESCE(v_sale.invoice_no, p_sale_id::text) ||
              COALESCE(' — ' || p_reason, ''),
            'sale_reversal', p_sale_id, p_user_id, TRUE, NOW()
        )
        RETURNING id INTO v_je_id;

        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_je_id, v_sales_account, COALESCE(v_sale.subtotal,0), 0, 'Reverse Sales Revenue');

        IF COALESCE(v_sale.discount_amount,0) > 0 AND v_discount_account IS NOT NULL THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_discount_account, 0, v_sale.discount_amount, 'Reverse Discount Given');
        END IF;

        IF COALESCE(v_sale.paid_amount,0) = 0 THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_ar_account, 0, v_sale.total, 'Reverse AR (unpaid)');
        ELSIF v_sale.paid_amount < v_sale.total THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_ar_account, 0, v_sale.total - v_sale.paid_amount, 'Reverse AR (unpaid portion)');
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_pay_account, 0, v_sale.paid_amount, 'Reverse cash/bank (paid portion)');
        ELSE
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_pay_account, 0, v_sale.total, 'Reverse cash/bank payment');
        END IF;

        IF v_reverse_cogs > 0 AND v_cogs_account IS NOT NULL AND v_inventory_account IS NOT NULL THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_cogs_account, 0, v_reverse_cogs, 'Reverse COGS');
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_inventory_account, v_reverse_cogs, 0, 'Restore inventory');
        END IF;

        UPDATE public.journal_entries
           SET total_debit  = (SELECT COALESCE(SUM(debit),0)  FROM public.journal_entry_lines WHERE journal_entry_id = v_je_id),
               total_credit = (SELECT COALESCE(SUM(credit),0) FROM public.journal_entry_lines WHERE journal_entry_id = v_je_id)
         WHERE id = v_je_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', p_sale_id,
        'already_cancelled', v_already_cancelled,
        'journal_entry_id', v_je_id,
        'stock_movements_created', v_stock_created
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sale_full_void(UUID, UUID, TEXT) TO authenticated, service_role;
