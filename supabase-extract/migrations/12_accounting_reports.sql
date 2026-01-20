-- ============================================================================
-- TASK 9: REPORTS (READ-ONLY, ACCOUNTING-DRIVEN)
-- ============================================================================
-- Purpose: All reports generated from accounting data
-- ============================================================================

-- Function: Profit & Loss Statement
CREATE OR REPLACE FUNCTION get_profit_loss(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    account_type VARCHAR(50),
    account_name VARCHAR(255),
    amount DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.type as account_type,
        a.name as account_name,
        COALESCE(SUM(jel.debit - jel.credit), 0) as amount
    FROM accounts a
    LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
    LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
        AND je.company_id = p_company_id
        AND je.entry_date >= p_start_date
        AND je.entry_date <= p_end_date
    WHERE a.company_id = p_company_id
    AND a.type IN ('Revenue', 'Expense')
    AND a.is_active = true
    GROUP BY a.id, a.type, a.name
    HAVING COALESCE(SUM(jel.debit - jel.credit), 0) != 0
    ORDER BY 
        CASE a.type 
            WHEN 'Revenue' THEN 1 
            WHEN 'Expense' THEN 2 
        END,
        a.name;
END;
$$ LANGUAGE plpgsql;

-- Function: Inventory Valuation Report
CREATE OR REPLACE FUNCTION get_inventory_valuation(
    p_company_id UUID,
    p_as_on_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR(255),
    sku VARCHAR(100),
    quantity DECIMAL(15,2),
    average_cost DECIMAL(15,2),
    total_value DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku,
        COALESCE(SUM(sm.quantity), 0) as quantity,
        COALESCE(AVG(CASE WHEN sm.quantity > 0 THEN sm.unit_cost END), 0) as average_cost,
        COALESCE(SUM(sm.total_cost), 0) as total_value
    FROM products p
    LEFT JOIN stock_movements sm ON sm.product_id = p.id
        AND sm.company_id = p_company_id
        AND sm.created_at::DATE <= p_as_on_date
    WHERE p.company_id = p_company_id
    AND p.is_active = true
    GROUP BY p.id, p.name, p.sku
    HAVING COALESCE(SUM(sm.quantity), 0) > 0
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;

-- Function: Customer Balance Report
CREATE OR REPLACE FUNCTION get_customer_balances(
    p_company_id UUID,
    p_as_on_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    customer_id UUID,
    customer_name VARCHAR(255),
    total_sales DECIMAL(15,2),
    total_payments DECIMAL(15,2),
    balance DECIMAL(15,2)
) AS $$
DECLARE
    v_ar_account_id UUID;
BEGIN
    SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    
    RETURN QUERY
    SELECT 
        c.id as customer_id,
        c.name as customer_name,
        COALESCE(SUM(CASE WHEN je.reference_type = 'sale' AND jel.debit > 0 THEN jel.debit ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN je.reference_type = 'payment' AND jel.credit > 0 THEN jel.credit ELSE 0 END), 0) as total_payments,
        COALESCE(SUM(jel.debit - jel.credit), 0) as balance
    FROM contacts c
    LEFT JOIN sales s ON s.customer_id = c.id AND s.company_id = p_company_id
    LEFT JOIN journal_entries je ON je.reference_type = 'sale' AND je.reference_id = s.id
        AND je.entry_date <= p_as_on_date
    LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.account_id = v_ar_account_id
    LEFT JOIN payments p ON p.reference_type = 'sale' AND p.reference_id = s.id
    LEFT JOIN journal_entries je_pay ON je_pay.reference_type = 'payment' AND je_pay.reference_id = p.id
        AND je_pay.entry_date <= p_as_on_date
    LEFT JOIN journal_entry_lines jel_pay ON jel_pay.journal_entry_id = je_pay.id AND jel_pay.account_id = v_ar_account_id
    WHERE c.company_id = p_company_id
    AND c.type IN ('customer', 'both')
    AND c.is_active = true
    GROUP BY c.id, c.name
    HAVING COALESCE(SUM(jel.debit - jel.credit), 0) != 0
    ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;

-- Function: Supplier Balance Report
CREATE OR REPLACE FUNCTION get_supplier_balances(
    p_company_id UUID,
    p_as_on_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    supplier_id UUID,
    supplier_name VARCHAR(255),
    total_purchases DECIMAL(15,2),
    total_payments DECIMAL(15,2),
    balance DECIMAL(15,2)
) AS $$
DECLARE
    v_ap_account_id UUID;
BEGIN
    SELECT id INTO v_ap_account_id FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
    
    RETURN QUERY
    SELECT 
        c.id as supplier_id,
        c.name as supplier_name,
        COALESCE(SUM(CASE WHEN je.reference_type = 'purchase' AND jel.credit > 0 THEN jel.credit ELSE 0 END), 0) as total_purchases,
        COALESCE(SUM(CASE WHEN je.reference_type = 'payment' AND jel.debit > 0 THEN jel.debit ELSE 0 END), 0) as total_payments,
        COALESCE(SUM(jel.credit - jel.debit), 0) as balance
    FROM contacts c
    LEFT JOIN purchases p ON p.supplier_id = c.id AND p.company_id = p_company_id
    LEFT JOIN journal_entries je ON je.reference_type = 'purchase' AND je.reference_id = p.id
        AND je.entry_date <= p_as_on_date
    LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.account_id = v_ap_account_id
    LEFT JOIN payments pay ON pay.reference_type = 'purchase' AND pay.reference_id = p.id
    LEFT JOIN journal_entries je_pay ON je_pay.reference_type = 'payment' AND je_pay.reference_id = pay.id
        AND je_pay.entry_date <= p_as_on_date
    LEFT JOIN journal_entry_lines jel_pay ON jel_pay.journal_entry_id = je_pay.id AND jel_pay.account_id = v_ap_account_id
    WHERE c.company_id = p_company_id
    AND c.type IN ('supplier', 'both')
    AND c.is_active = true
    GROUP BY c.id, c.name
    HAVING COALESCE(SUM(jel.credit - jel.debit), 0) != 0
    ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;
