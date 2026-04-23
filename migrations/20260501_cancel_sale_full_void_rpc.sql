-- =====================================================================
-- 20260501  cancel_sale_full_void(p_sale_id, p_user_id, p_reason)
-- Idempotent "full void" cancel:
--  1. sales.status = 'cancelled', cancelled_at, cancelled_by, cancel_reason
--  2. SALE_CANCELLED stock_movements inserted (restoring inventory).
--  3. sale_reversal journal_entry inserted (reversing revenue/AR/COGS/etc).
-- Safe to re-invoke: existing cancellation artefacts are detected & skipped.
-- =====================================================================

SET search_path = public;

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

    -- 1. Flip status + audit cols (idempotent)
    UPDATE public.sales
       SET status        = 'cancelled',
           cancelled_at  = COALESCE(cancelled_at, NOW()),
           cancelled_by  = COALESCE(cancelled_by, p_user_id),
           cancel_reason = COALESCE(cancel_reason, p_reason),
           updated_at    = NOW()
     WHERE id = p_sale_id;

    -- 2. Stock reversal (idempotent): only insert if no SALE_CANCELLED rows exist yet
    IF NOT EXISTS (
        SELECT 1 FROM public.stock_movements
         WHERE reference_type = 'sale'
           AND reference_id   = p_sale_id
           AND movement_type  = 'SALE_CANCELLED'
    ) THEN
        -- Copy each original 'sale' movement but flip the sign to restore stock
        INSERT INTO public.stock_movements (
            company_id, branch_id, product_id, variation_id,
            movement_type, quantity, unit_cost, total_cost,
            reference_type, reference_id, notes, created_by, created_at
        )
        SELECT company_id, branch_id, product_id, variation_id,
               'SALE_CANCELLED',
               -quantity,              -- inverse of the original (original was negative → this becomes positive to add stock back)
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

    -- 3. Journal reversal (idempotent): skip if sale_reversal JE already exists for this sale
    IF NOT EXISTS (
        SELECT 1 FROM public.journal_entries
         WHERE company_id     = v_company_id
           AND reference_type = 'sale_reversal'
           AND reference_id   = p_sale_id
    ) THEN
        -- Resolve accounts (fallback-safe)
        SELECT id INTO v_ar_account        FROM public.accounts WHERE company_id = v_company_id AND code = '1100' LIMIT 1;
        SELECT id INTO v_cash_account      FROM public.accounts WHERE company_id = v_company_id AND code = '1000' LIMIT 1;
        SELECT id INTO v_bank_account      FROM public.accounts WHERE company_id = v_company_id AND code = '1010' LIMIT 1;
        SELECT id INTO v_sales_account     FROM public.accounts WHERE company_id = v_company_id AND code = '4000' LIMIT 1;
        SELECT id INTO v_inventory_account FROM public.accounts WHERE company_id = v_company_id AND code = '1200' LIMIT 1;
        SELECT id INTO v_cogs_account      FROM public.accounts WHERE company_id = v_company_id AND code = '5100' LIMIT 1;
        SELECT id INTO v_discount_account  FROM public.accounts WHERE company_id = v_company_id AND code = '4100' LIMIT 1;

        -- Reverse COGS from original stock movements
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

        -- Reverse revenue (debit sales)
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_je_id, v_sales_account, COALESCE(v_sale.subtotal,0), 0, 'Reverse Sales Revenue');

        -- Reverse discount (if any): debit AR, credit Discount Given (opposite of original)
        IF COALESCE(v_sale.discount_amount,0) > 0 AND v_discount_account IS NOT NULL THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_discount_account, 0, v_sale.discount_amount, 'Reverse Discount Given');
        END IF;

        -- Reverse AR & payment
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

        -- Reverse COGS
        IF v_reverse_cogs > 0 AND v_cogs_account IS NOT NULL AND v_inventory_account IS NOT NULL THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_cogs_account, 0, v_reverse_cogs, 'Reverse COGS');
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_inventory_account, v_reverse_cogs, 0, 'Restore inventory');
        END IF;

        -- Refresh totals on the JE header
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

-- =====================================================================
-- Purchase mirror
-- =====================================================================

CREATE OR REPLACE FUNCTION public.cancel_purchase_full_void(
    p_purchase_id  UUID,
    p_user_id      UUID DEFAULT NULL,
    p_reason       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_po                RECORD;
    v_company_id        UUID;
    v_branch_id         UUID;
    v_already_cancelled BOOLEAN := FALSE;
    v_ap_account        UUID;
    v_cash_account      UUID;
    v_bank_account      UUID;
    v_inventory_account UUID;
    v_reverse_cost      NUMERIC(15,2) := 0;
    v_je_id             UUID;
    v_stock_created     INT := 0;
    v_pay_account       UUID;
BEGIN
    SELECT * INTO v_po FROM public.purchases WHERE id = p_purchase_id;
    IF v_po.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Purchase not found');
    END IF;

    v_company_id := v_po.company_id;
    v_branch_id  := v_po.branch_id;

    IF v_po.status = 'cancelled' THEN
        v_already_cancelled := TRUE;
    END IF;

    UPDATE public.purchases
       SET status        = 'cancelled',
           cancelled_at  = COALESCE(cancelled_at, NOW()),
           cancelled_by  = COALESCE(cancelled_by, p_user_id),
           cancel_reason = COALESCE(cancel_reason, p_reason),
           updated_at    = NOW()
     WHERE id = p_purchase_id;

    -- Stock reversal (idempotent)
    IF NOT EXISTS (
        SELECT 1 FROM public.stock_movements
         WHERE reference_type = 'purchase'
           AND reference_id   = p_purchase_id
           AND movement_type  = 'PURCHASE_CANCELLED'
    ) THEN
        INSERT INTO public.stock_movements (
            company_id, branch_id, product_id, variation_id,
            movement_type, quantity, unit_cost, total_cost,
            reference_type, reference_id, notes, created_by, created_at
        )
        SELECT company_id, branch_id, product_id, variation_id,
               'PURCHASE_CANCELLED',
               -quantity,
               unit_cost,
               -total_cost,
               'purchase',
               p_purchase_id,
               'Auto-reverse on purchase cancel',
               p_user_id,
               NOW()
          FROM public.stock_movements
         WHERE reference_type = 'purchase'
           AND reference_id   = p_purchase_id
           AND movement_type <> 'PURCHASE_CANCELLED';
        GET DIAGNOSTICS v_stock_created = ROW_COUNT;
    END IF;

    -- Journal reversal (idempotent)
    IF NOT EXISTS (
        SELECT 1 FROM public.journal_entries
         WHERE company_id     = v_company_id
           AND reference_type = 'purchase_reversal'
           AND reference_id   = p_purchase_id
    ) THEN
        SELECT id INTO v_ap_account        FROM public.accounts WHERE company_id = v_company_id AND code = '2000' LIMIT 1;
        SELECT id INTO v_cash_account      FROM public.accounts WHERE company_id = v_company_id AND code = '1000' LIMIT 1;
        SELECT id INTO v_bank_account      FROM public.accounts WHERE company_id = v_company_id AND code = '1010' LIMIT 1;
        SELECT id INTO v_inventory_account FROM public.accounts WHERE company_id = v_company_id AND code = '1200' LIMIT 1;

        SELECT COALESCE(SUM(ABS(total_cost)),0) INTO v_reverse_cost
          FROM public.stock_movements
         WHERE reference_type = 'purchase'
           AND reference_id   = p_purchase_id
           AND movement_type <> 'PURCHASE_CANCELLED';

        v_pay_account := CASE WHEN v_po.payment_method = 'cash' THEN v_cash_account ELSE v_bank_account END;

        INSERT INTO public.journal_entries (
            company_id, branch_id, entry_no, entry_date, description,
            reference_type, reference_id, created_by, is_posted, posted_at
        )
        VALUES (
            v_company_id, v_branch_id,
            'JE-REV-' || COALESCE(v_po.po_no, p_purchase_id::text),
            CURRENT_DATE,
            'Purchase Cancellation Reversal: ' || COALESCE(v_po.po_no, p_purchase_id::text) ||
              COALESCE(' — ' || p_reason, ''),
            'purchase_reversal', p_purchase_id, p_user_id, TRUE, NOW()
        )
        RETURNING id INTO v_je_id;

        IF v_reverse_cost > 0 AND v_inventory_account IS NOT NULL THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_inventory_account, 0, v_reverse_cost, 'Reverse Inventory increase');
        END IF;

        IF COALESCE(v_po.paid_amount,0) = 0 THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_ap_account, v_po.total, 0, 'Reverse AP');
        ELSIF v_po.paid_amount < v_po.total THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_ap_account, v_po.total - v_po.paid_amount, 0, 'Reverse AP (unpaid portion)');
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_pay_account, v_po.paid_amount, 0, 'Restore cash/bank (paid portion)');
        ELSE
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_je_id, v_pay_account, v_po.total, 0, 'Restore cash/bank payment');
        END IF;

        UPDATE public.journal_entries
           SET total_debit  = (SELECT COALESCE(SUM(debit),0)  FROM public.journal_entry_lines WHERE journal_entry_id = v_je_id),
               total_credit = (SELECT COALESCE(SUM(credit),0) FROM public.journal_entry_lines WHERE journal_entry_id = v_je_id)
         WHERE id = v_je_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', p_purchase_id,
        'already_cancelled', v_already_cancelled,
        'journal_entry_id', v_je_id,
        'stock_movements_created', v_stock_created
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_purchase_full_void(UUID, UUID, TEXT) TO authenticated, service_role;
