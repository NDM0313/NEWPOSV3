-- ============================================================================
-- TASK 7: EXPENSE TRANSACTION
-- ============================================================================
-- Purpose: Expense creation with accounting integration
-- ============================================================================

-- Function to create expense with accounting
CREATE OR REPLACE FUNCTION create_expense_with_accounting(
    p_company_id UUID,
    p_branch_id UUID,
    p_category VARCHAR(100),
    p_amount DECIMAL(15,2),
    p_expense_date DATE,
    p_payment_method payment_method_enum,
    p_paid BOOLEAN,
    p_notes TEXT,
    p_created_by UUID
)
RETURNS JSON AS $$
DECLARE
    v_expense_id UUID;
    v_journal_entry_id UUID;
    v_expense_account_id UUID;
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_payment_account_id UUID;
    v_payment_id UUID;
BEGIN
    -- Get default accounts
    SELECT id INTO v_expense_account_id FROM accounts WHERE company_id = p_company_id AND code = '6000' LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;
    
    -- Determine payment account
    IF p_payment_method = 'cash' THEN
        v_payment_account_id := v_cash_account_id;
    ELSE
        v_payment_account_id := v_bank_account_id;
    END IF;

    -- Create expense record
    INSERT INTO expenses (
        company_id, branch_id, category, amount, expense_date,
        payment_method, status, notes, created_by
    )
    VALUES (
        p_company_id, p_branch_id, p_category, p_amount, p_expense_date,
        p_payment_method,
        CASE WHEN p_paid THEN 'paid' ELSE 'pending' END,
        p_notes, p_created_by
    )
    RETURNING id INTO v_expense_id;

    -- Create payment record if paid
    IF p_paid THEN
        INSERT INTO payments (
            company_id, branch_id, payment_type, reference_type, reference_id,
            amount, payment_method, payment_date, payment_account_id,
            notes, created_by
        )
        VALUES (
            p_company_id, p_branch_id, 'paid', 'expense', v_expense_id,
            p_amount, p_payment_method, p_expense_date, v_payment_account_id,
            'Payment for expense: ' || p_category, p_created_by
        )
        RETURNING id INTO v_payment_id;
    END IF;

    -- Create accounting entry
    INSERT INTO journal_entries (
        company_id, branch_id, entry_no, entry_date, description,
        reference_type, reference_id, created_by
    )
    VALUES (
        p_company_id, p_branch_id,
        'JE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'),
        p_expense_date,
        'Expense: ' || p_category,
        'expense',
        v_expense_id,
        p_created_by
    )
    RETURNING id INTO v_journal_entry_id;

    -- Accounting entries: Debit Expense, Credit Cash/Bank (or Payable if unpaid)
    IF p_paid THEN
        -- Paid: Debit Expense, Credit Cash/Bank
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES 
            (v_journal_entry_id, v_expense_account_id, p_amount, 0, 'Expense: ' || p_category),
            (v_journal_entry_id, v_payment_account_id, 0, p_amount, 'Cash/Bank payment');
    ELSE
        -- Unpaid: Debit Expense, Credit Accounts Payable
        DECLARE
            v_ap_account_id UUID;
        BEGIN
            SELECT id INTO v_ap_account_id FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
            INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES 
                (v_journal_entry_id, v_expense_account_id, p_amount, 0, 'Expense: ' || p_category),
                (v_journal_entry_id, v_ap_account_id, 0, p_amount, 'Accounts Payable for expense');
        END;
    END IF;

    -- Return result
    RETURN json_build_object(
        'success', true,
        'expense_id', v_expense_id,
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
