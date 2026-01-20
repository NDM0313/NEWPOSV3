-- ============================================================================
-- TASK 5: PAYMENT ENGINE (UNIFIED)
-- ============================================================================
-- Purpose: Unified payment processing with accounting integration
-- ============================================================================

-- Function to record payment with accounting
CREATE OR REPLACE FUNCTION record_payment_with_accounting(
    p_company_id UUID,
    p_branch_id UUID,
    p_payment_type payment_type, -- 'received' or 'paid'
    p_reference_type VARCHAR(50), -- 'sale', 'purchase', 'expense', 'rental'
    p_reference_id UUID,
    p_amount DECIMAL(15,2),
    p_payment_method payment_method_enum,
    p_payment_date DATE,
    p_payment_account_id UUID, -- Cash/Bank account
    p_reference_number VARCHAR(100),
    p_notes TEXT,
    p_created_by UUID
)
RETURNS JSON AS $$
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
BEGIN
    -- Get default accounts
    SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    SELECT id INTO v_ap_account_id FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;
    
    -- Use provided payment account or default based on payment method
    IF p_payment_account_id IS NOT NULL THEN
        v_payment_account := p_payment_account_id;
    ELSIF p_payment_method = 'cash' THEN
        v_payment_account := v_cash_account_id;
    ELSE
        v_payment_account := v_bank_account_id;
    END IF;

    -- Create payment record
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

    -- Update reference record payment status
    IF p_reference_type = 'sale' THEN
        SELECT * INTO v_sale_record FROM sales WHERE id = p_reference_id;
        IF v_sale_record.id IS NOT NULL THEN
            UPDATE sales
            SET 
                paid_amount = COALESCE(paid_amount, 0) + p_amount,
                due_amount = GREATEST(0, total - (COALESCE(paid_amount, 0) + p_amount)),
                payment_status = CASE
                    WHEN (COALESCE(paid_amount, 0) + p_amount) >= total THEN 'paid'
                    WHEN (COALESCE(paid_amount, 0) + p_amount) > 0 THEN 'partial'
                    ELSE 'unpaid'
                END
            WHERE id = p_reference_id;
        END IF;
    ELSIF p_reference_type = 'purchase' THEN
        SELECT * INTO v_purchase_record FROM purchases WHERE id = p_reference_id;
        IF v_purchase_record.id IS NOT NULL THEN
            UPDATE purchases
            SET 
                paid_amount = COALESCE(paid_amount, 0) + p_amount,
                due_amount = GREATEST(0, total - (COALESCE(paid_amount, 0) + p_amount)),
                payment_status = CASE
                    WHEN (COALESCE(paid_amount, 0) + p_amount) >= total THEN 'paid'
                    WHEN (COALESCE(paid_amount, 0) + p_amount) > 0 THEN 'partial'
                    ELSE 'unpaid'
                END
            WHERE id = p_reference_id;
        END IF;
    ELSIF p_reference_type = 'expense' THEN
        SELECT * INTO v_expense_record FROM expenses WHERE id = p_reference_id;
        IF v_expense_record.id IS NOT NULL THEN
            UPDATE expenses
            SET 
                status = 'paid'
            WHERE id = p_reference_id;
        END IF;
    END IF;

    -- Create accounting entry
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

    -- Accounting entries based on payment type
    IF p_payment_type = 'received' THEN
        -- Payment received (from customer)
        -- Debit: Cash/Bank, Credit: Accounts Receivable
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES 
            (v_journal_entry_id, v_payment_account, p_amount, 0, 'Payment received'),
            (v_journal_entry_id, v_ar_account_id, 0, p_amount, 'Accounts Receivable decrease');
    ELSE
        -- Payment paid (to supplier/expense)
        -- Debit: Accounts Payable/Expense, Credit: Cash/Bank
        IF p_reference_type = 'purchase' THEN
            INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES 
                (v_journal_entry_id, v_ap_account_id, p_amount, 0, 'Accounts Payable decrease'),
                (v_journal_entry_id, v_payment_account, 0, p_amount, 'Payment made');
        ELSIF p_reference_type = 'expense' THEN
            -- Get expense account
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

    -- Return result
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
