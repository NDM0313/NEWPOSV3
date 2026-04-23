-- ============================================================================
-- finalize_sale_return: sold-qty validation must work with sales_items OR sale_items
-- ============================================================================
-- Fixes mobile sale-return errors like:
-- "Return qty (...) exceeds sold qty (0) ..."
-- when invoice lines are stored in sales_items but function only reads sale_items.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_sale_return(
    p_sale_return_id UUID,
    p_company_id UUID,
    p_created_by UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_sale RECORD;
    v_item RECORD;
    v_sold_qty DECIMAL(15,2);
    v_returned_so_far DECIMAL(15,2);
    v_ar_account_id UUID;
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_sales_return_account_id UUID;
    v_payment_account_id UUID;
    v_journal_entry_id UUID;
    v_total_return_amount DECIMAL(15,2) := 0;
    v_has_sales_items BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'sales_items'
    ) INTO v_has_sales_items;

    SELECT * INTO v_return FROM sale_returns WHERE id = p_sale_return_id AND company_id = p_company_id;
    IF v_return.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Sale return not found');
    END IF;
    IF v_return.status = 'final' THEN
        RETURN json_build_object('success', false, 'error', 'Sale return already finalized');
    END IF;

    SELECT * INTO v_sale FROM sales WHERE id = v_return.original_sale_id AND company_id = p_company_id;
    IF v_sale.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Original sale not found');
    END IF;
    IF v_sale.status != 'final' THEN
        RETURN json_build_object('success', false, 'error', 'Sale return allowed only for final invoices. Original sale is not final.');
    END IF;

    FOR v_item IN SELECT * FROM sale_return_items WHERE sale_return_id = p_sale_return_id
    LOOP
        IF v_has_sales_items THEN
          EXECUTE $q$
            SELECT COALESCE(SUM(quantity), 0)
            FROM sales_items
            WHERE sale_id = $1
              AND product_id = $2
              AND (variation_id IS NOT DISTINCT FROM $3)
          $q$
          INTO v_sold_qty
          USING v_return.original_sale_id, v_item.product_id, v_item.variation_id;
        ELSE
          EXECUTE $q$
            SELECT COALESCE(SUM(quantity), 0)
            FROM sale_items
            WHERE sale_id = $1
              AND product_id = $2
              AND (variation_id IS NOT DISTINCT FROM $3)
          $q$
          INTO v_sold_qty
          USING v_return.original_sale_id, v_item.product_id, v_item.variation_id;
        END IF;

        IF v_item.quantity > v_sold_qty THEN
            RETURN json_build_object(
              'success', false,
              'error', format('Return qty (%s) exceeds sold qty (%s) for product %s', v_item.quantity, v_sold_qty, v_item.product_name)
            );
        END IF;

        SELECT COALESCE(SUM(sri.quantity), 0) INTO v_returned_so_far
        FROM sale_return_items sri
        JOIN sale_returns sr ON sr.id = sri.sale_return_id AND sr.status = 'final'
        WHERE sr.original_sale_id = v_return.original_sale_id
          AND sri.product_id = v_item.product_id
          AND (sri.variation_id IS NOT DISTINCT FROM v_item.variation_id);

        IF v_returned_so_far + v_item.quantity > v_sold_qty THEN
            RETURN json_build_object(
              'success', false,
              'error', format('Total return qty would exceed sold qty for product %s', v_item.product_name)
            );
        END IF;
    END LOOP;

    SELECT id INTO v_sales_return_account_id FROM accounts WHERE company_id = p_company_id AND code = '4010' LIMIT 1;
    IF v_sales_return_account_id IS NULL THEN
        SELECT id INTO v_sales_return_account_id FROM accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1;
    END IF;
    SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;

    FOR v_item IN SELECT * FROM sale_return_items WHERE sale_return_id = p_sale_return_id
    LOOP
        INSERT INTO stock_movements (
            company_id, branch_id, product_id, movement_type, quantity,
            unit_cost, total_cost, reference_type, reference_id, notes, created_by
        )
        VALUES (
            p_company_id, v_return.branch_id, v_item.product_id,
            'sale_return',
            v_item.quantity,
            v_item.unit_price,
            v_item.total,
            'sale_return',
            p_sale_return_id,
            'Sale return: ' || COALESCE(v_return.return_no, v_return.id::TEXT) || ' - ' || v_item.product_name,
            p_created_by
        );
        v_total_return_amount := v_total_return_amount + v_item.total;
    END LOOP;

    INSERT INTO journal_entries (
        company_id, branch_id, entry_no, entry_date, description,
        reference_type, reference_id, created_by
    )
    VALUES (
        p_company_id, v_return.branch_id,
        'SR-' || TO_CHAR(v_return.return_date, 'YYYYMMDD') || '-' ||
        LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id AND entry_no LIKE 'SR-%')::TEXT, 4, '0'),
        v_return.return_date,
        'Sale Return: ' || COALESCE(v_return.return_no, p_sale_return_id::TEXT) || ' (Original: ' || v_sale.invoice_no || ')',
        'sale_return', p_sale_return_id, p_created_by
    )
    RETURNING id INTO v_journal_entry_id;

    IF v_sales_return_account_id IS NOT NULL THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_sales_return_account_id, v_return.total, 0, 'Sales Return');
    END IF;

    IF COALESCE(v_sale.paid_amount, 0) = 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_ar_account_id, 0, v_return.total, 'Credit AR - sale return');
    ELSE
        IF v_sale.payment_method = 'cash' THEN
          v_payment_account_id := v_cash_account_id;
        ELSE
          v_payment_account_id := v_bank_account_id;
        END IF;
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_payment_account_id, 0, v_return.total, 'Credit Cash/Bank - sale return');
    END IF;

    UPDATE sale_returns
    SET status = 'final', updated_at = NOW()
    WHERE id = p_sale_return_id;

    RETURN json_build_object(
        'success', true,
        'sale_return_id', p_sale_return_id,
        'journal_entry_id', v_journal_entry_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
