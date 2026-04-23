-- ============================================================================
-- record_payment_with_accounting: fix rental due update for schemas without rentals.total
-- ============================================================================
-- Some databases store rental gross on rentals.total_amount (not rentals.total).
-- Old function versions referenced rentals.total and crash with:
--   column "total" does not exist
-- This migration keeps existing behavior but updates rental path to:
--   COALESCE(total_amount, total, 0)
-- ============================================================================

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
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_payment_account UUID;
    v_sale_record RECORD;
    v_purchase_record RECORD;
    v_expense_record RECORD;
    v_rental_record RECORD;
BEGIN
    SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    SELECT id INTO v_ap_account_id FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;

    IF p_payment_account_id IS NOT NULL THEN
        v_payment_account := p_payment_account_id;
    ELSIF p_payment_method = 'cash' THEN
        v_payment_account := v_cash_account_id;
    ELSE
        v_payment_account := v_bank_account_id;
    END IF;

    INSERT INTO payments (
        company_id, branch_id, payment_type, reference_type, reference_id,
        amount, payment_method, payment_date, payment_account_id,
        reference_number, notes, created_by
    )
    VALUES (
        p_company_id, p_branch_id, p_payment_type, p_reference_type, p_reference_id,
        p_amount, p_payment_method, p_payment_date, v_payment_account,
        p_reference_number, p_notes, p_created_by
    )
    RETURNING id INTO v_payment_id;

    IF p_reference_type = 'sale' THEN
        SELECT * INTO v_sale_record FROM sales WHERE id = p_reference_id;
        IF v_sale_record.id IS NOT NULL THEN
            UPDATE sales
            SET
                paid_amount = COALESCE(paid_amount, 0) + p_amount,
                due_amount = GREATEST(0, total - (COALESCE(paid_amount, 0) + p_amount)),
                payment_status = (
                    CASE
                        WHEN (COALESCE(paid_amount, 0) + p_amount) >= total THEN 'paid'
                        WHEN (COALESCE(paid_amount, 0) + p_amount) > 0 THEN 'partial'
                        ELSE 'unpaid'
                    END
                )::public.payment_status
            WHERE id = p_reference_id;
        END IF;
    ELSIF p_reference_type = 'purchase' THEN
        SELECT * INTO v_purchase_record FROM purchases WHERE id = p_reference_id;
        IF v_purchase_record.id IS NOT NULL THEN
            UPDATE purchases
            SET
                paid_amount = COALESCE(paid_amount, 0) + p_amount,
                due_amount = GREATEST(0, total - (COALESCE(paid_amount, 0) + p_amount)),
                payment_status = (
                    CASE
                        WHEN (COALESCE(paid_amount, 0) + p_amount) >= total THEN 'paid'
                        WHEN (COALESCE(paid_amount, 0) + p_amount) > 0 THEN 'partial'
                        ELSE 'unpaid'
                    END
                )::public.payment_status
            WHERE id = p_reference_id;
        END IF;
    ELSIF p_reference_type = 'rental' THEN
        SELECT * INTO v_rental_record FROM rentals WHERE id = p_reference_id;
        IF v_rental_record.id IS NOT NULL THEN
            UPDATE rentals
            SET
                paid_amount = COALESCE(paid_amount, 0) + p_amount,
                due_amount = GREATEST(
                  0,
                  COALESCE(total_amount, total, 0) - (COALESCE(paid_amount, 0) + p_amount)
                ),
                updated_at = NOW()
            WHERE id = p_reference_id;
        END IF;
    ELSIF p_reference_type = 'expense' THEN
        SELECT * INTO v_expense_record FROM expenses WHERE id = p_reference_id;
        IF v_expense_record.id IS NOT NULL THEN
            UPDATE expenses
            SET status = 'paid'
            WHERE id = p_reference_id;
        END IF;
    END IF;

    INSERT INTO journal_entries (
        company_id, branch_id, entry_no, entry_date, description,
        reference_type, reference_id, created_by
    )
    VALUES (
        p_company_id, p_branch_id,
        'JE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'),
        p_payment_date,
        'Payment: ' || COALESCE(p_reference_number, p_reference_type || ' #' || p_reference_id::TEXT),
        'payment',
        v_payment_id,
        p_created_by
    )
    RETURNING id INTO v_journal_entry_id;

    IF p_payment_type = 'received' THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES
            (v_journal_entry_id, v_payment_account, p_amount, 0, 'Payment received'),
            (v_journal_entry_id, v_ar_account_id, 0, p_amount, 'Accounts Receivable decrease');
    ELSE
        IF p_reference_type = 'purchase' THEN
            INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES
                (v_journal_entry_id, v_ap_account_id, p_amount, 0, 'Accounts Payable decrease'),
                (v_journal_entry_id, v_payment_account, 0, p_amount, 'Payment made');
        ELSIF p_reference_type = 'expense' THEN
            DECLARE
                v_expense_account_id UUID;
            BEGIN
                SELECT id INTO v_expense_account_id FROM accounts WHERE company_id = p_company_id AND code = '6000' LIMIT 1;
                INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
                VALUES
                    (v_journal_entry_id, v_expense_account_id, p_amount, 0, 'Expense payment'),
                    (v_journal_entry_id, v_payment_account, 0, p_amount, 'Payment made');
            END;
        END IF;
    END IF;

    RETURN json_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'journal_entry_id', v_journal_entry_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

NOTIFY pgrst, 'reload schema';
