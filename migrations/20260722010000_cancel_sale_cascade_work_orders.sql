-- Sale cancel cascades active/completed bespoke work orders (stock + production JE).
-- Additive CREATE OR REPLACE only — no DROP/ALTER on money tables.
-- Approval: plan sale_cancel_cascades_work_orders (user confirmed).

SET search_path = public;

CREATE OR REPLACE FUNCTION public.cancel_sale_full_void(
    p_sale_id      UUID,
    p_user_id      UUID DEFAULT NULL,
    p_reason       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    v_wo                RECORD;
    v_wo_res            JSONB;
    v_wo_cancelled      INT := 0;
    v_wo_reason         TEXT;
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

    -- Cascade: cancel linked work orders first so a WO failure aborts before sale void.
    v_wo_reason := COALESCE(NULLIF(trim(p_reason), ''), 'Sale cancelled');
    FOR v_wo IN
        SELECT w.id
          FROM public.bespoke_work_orders w
         WHERE w.sale_id = p_sale_id
           AND w.status <> 'cancelled'::public.bespoke_work_order_status
         ORDER BY w.created_at ASC
    LOOP
        v_wo_res := public.cancel_bespoke_work_order(v_wo.id, p_user_id, v_wo_reason);
        IF COALESCE((v_wo_res->>'success')::boolean, false) = false THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', COALESCE(v_wo_res->>'error', 'Failed to cancel linked work order'),
                'work_order_id', v_wo.id,
                'sale_id', p_sale_id
            );
        END IF;
        v_wo_cancelled := v_wo_cancelled + 1;
    END LOOP;

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
        'stock_movements_created', v_stock_created,
        'work_orders_cancelled', v_wo_cancelled
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.cancel_sale_full_void(UUID, UUID, TEXT) IS
  'Full void sale: cascade-cancel linked bespoke WOs (stock+JE), SALE_CANCELLED stock, sale_reversal JE. Idempotent.';

GRANT EXECUTE ON FUNCTION public.cancel_sale_full_void(UUID, UUID, TEXT) TO authenticated, service_role;
