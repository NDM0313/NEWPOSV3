-- ============================================================================
-- TASK 6: LEDGER & BALANCE CALCULATION
-- ============================================================================
-- Purpose: Ledger views and balance calculations
-- ============================================================================

-- Function to get account ledger
CREATE OR REPLACE FUNCTION get_account_ledger(
    p_account_id UUID,
    p_company_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    entry_date DATE,
    description TEXT,
    debit DECIMAL(15,2),
    credit DECIMAL(15,2),
    balance DECIMAL(15,2),
    reference_type VARCHAR(50),
    reference_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jel.journal_entry_id,
        je.entry_date,
        COALESCE(jel.description, je.description) as description,
        jel.debit,
        jel.credit,
        SUM(jel.debit - jel.credit) OVER (
            PARTITION BY jel.account_id 
            ORDER BY je.entry_date, je.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as balance,
        je.reference_type,
        je.reference_id
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.account_id = p_account_id
    AND je.company_id = p_company_id
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    ORDER BY je.entry_date, je.id;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer ledger (Accounts Receivable)
CREATE OR REPLACE FUNCTION get_customer_ledger(
    p_customer_id UUID,
    p_company_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    entry_date DATE,
    description TEXT,
    debit DECIMAL(15,2),
    credit DECIMAL(15,2),
    balance DECIMAL(15,2),
    reference_type VARCHAR(50),
    reference_id UUID,
    invoice_no VARCHAR(100)
) AS $$
DECLARE
    v_ar_account_id UUID;
BEGIN
    -- Get AR account
    SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    
    RETURN QUERY
    SELECT 
        je.entry_date,
        COALESCE(jel.description, je.description) as description,
        jel.debit,
        jel.credit,
        SUM(jel.debit - jel.credit) OVER (
            PARTITION BY p_customer_id
            ORDER BY je.entry_date, je.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as balance,
        je.reference_type,
        je.reference_id,
        s.invoice_no
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN sales s ON je.reference_type = 'sale' AND je.reference_id = s.id AND s.customer_id = p_customer_id
    WHERE jel.account_id = v_ar_account_id
    AND je.company_id = p_company_id
    AND (s.customer_id = p_customer_id OR (je.reference_type = 'payment' AND EXISTS (
        SELECT 1 FROM payments p 
        WHERE p.id = je.reference_id 
        AND p.reference_type = 'sale'
        AND EXISTS (SELECT 1 FROM sales s2 WHERE s2.id = p.reference_id AND s2.customer_id = p_customer_id)
    )))
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    ORDER BY je.entry_date, je.id;
END;
$$ LANGUAGE plpgsql;

-- Function to get supplier ledger (Accounts Payable)
CREATE OR REPLACE FUNCTION get_supplier_ledger(
    p_supplier_id UUID,
    p_company_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    entry_date DATE,
    description TEXT,
    debit DECIMAL(15,2),
    credit DECIMAL(15,2),
    balance DECIMAL(15,2),
    reference_type VARCHAR(50),
    reference_id UUID,
    po_no VARCHAR(100)
) AS $$
DECLARE
    v_ap_account_id UUID;
BEGIN
    -- Get AP account
    SELECT id INTO v_ap_account_id FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
    
    RETURN QUERY
    SELECT 
        je.entry_date,
        COALESCE(jel.description, je.description) as description,
        jel.debit,
        jel.credit,
        SUM(jel.credit - jel.debit) OVER (
            PARTITION BY p_supplier_id
            ORDER BY je.entry_date, je.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as balance,
        je.reference_type,
        je.reference_id,
        p.po_no
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN purchases p ON je.reference_type = 'purchase' AND je.reference_id = p.id AND p.supplier_id = p_supplier_id
    WHERE jel.account_id = v_ap_account_id
    AND je.company_id = p_company_id
    AND (p.supplier_id = p_supplier_id OR (je.reference_type = 'payment' AND EXISTS (
        SELECT 1 FROM payments pay 
        WHERE pay.id = je.reference_id 
        AND pay.reference_type = 'purchase'
        AND EXISTS (SELECT 1 FROM purchases p2 WHERE p2.id = pay.reference_id AND p2.supplier_id = p_supplier_id)
    )))
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    ORDER BY je.entry_date, je.id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate trial balance
CREATE OR REPLACE FUNCTION get_trial_balance(
    p_company_id UUID,
    p_as_on_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    account_code VARCHAR(50),
    account_name VARCHAR(255),
    account_type VARCHAR(50),
    debit_total DECIMAL(15,2),
    credit_total DECIMAL(15,2),
    balance DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.code as account_code,
        a.name as account_name,
        a.type as account_type,
        COALESCE(SUM(CASE WHEN jel.debit > 0 THEN jel.debit ELSE 0 END), 0) as debit_total,
        COALESCE(SUM(CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END), 0) as credit_total,
        COALESCE(SUM(jel.debit - jel.credit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
    LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
        AND je.company_id = p_company_id
        AND je.entry_date <= p_as_on_date
    WHERE a.company_id = p_company_id
    AND a.is_active = true
    GROUP BY a.id, a.code, a.name, a.type
    HAVING COALESCE(SUM(jel.debit - jel.credit), 0) != 0
    ORDER BY a.code;
END;
$$ LANGUAGE plpgsql;
