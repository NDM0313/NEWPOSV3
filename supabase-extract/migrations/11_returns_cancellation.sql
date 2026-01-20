-- ============================================================================
-- TASK 8: RETURNS & CANCELLATION LOGIC
-- ============================================================================
-- Purpose: Handle sale/purchase returns and cancellations with reverse accounting
-- ============================================================================

-- Function to cancel/return sale with reverse accounting
CREATE OR REPLACE FUNCTION cancel_sale_with_reverse_accounting(
    p_sale_id UUID,
    p_company_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_sale_record RECORD;
    v_journal_entry_id UUID;
    v_ar_account_id UUID;
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_sales_account_id UUID;
    v_inventory_account_id UUID;
    v_cogs_account_id UUID;
    v_payment_account_id UUID;
    v_reverse_cogs DECIMAL(15,2) := 0;
    v_item RECORD;
BEGIN
    -- Get sale record
    SELECT * INTO v_sale_record FROM sales WHERE id = p_sale_id AND company_id = p_company_id;
    
    IF v_sale_record.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Sale not found');
    END IF;

    -- Only allow cancellation if status is 'final' (invoice)
    IF v_sale_record.status != 'final' OR v_sale_record.type != 'invoice' THEN
        RETURN json_build_object('success', false, 'error', 'Only final invoices can be cancelled');
    END IF;

    -- Get default accounts
    SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;
    SELECT id INTO v_sales_account_id FROM accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1;
    SELECT id INTO v_inventory_account_id FROM accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1;
    SELECT id INTO v_cogs_account_id FROM accounts WHERE company_id = p_company_id AND code = '5100' LIMIT 1;

    -- Calculate reverse COGS from stock movements
    SELECT COALESCE(SUM(ABS(total_cost)), 0) INTO v_reverse_cogs
    FROM stock_movements
    WHERE reference_type = 'sale'
    AND reference_id = p_sale_id
    AND company_id = p_company_id;

    -- Create reverse journal entry
    INSERT INTO journal_entries (
        company_id, branch_id, entry_no, entry_date, description,
        reference_type, reference_id
    )
    VALUES (
        p_company_id, v_sale_record.branch_id,
        'JE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'),
        CURRENT_DATE,
        'Sale Cancellation: ' || v_sale_record.invoice_no || COALESCE(' - ' || p_reason, ''),
        'sale_return',
        p_sale_id
    )
    RETURNING id INTO v_journal_entry_id;

    -- Reverse: Credit AR/Cash (original debit), Debit Sales Revenue (original credit)
    IF v_sale_record.paid_amount = 0 THEN
        -- Unpaid: Credit AR
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_ar_account_id, 0, v_sale_record.total, 'Reverse AR for cancelled sale');
    ELSIF v_sale_record.paid_amount < v_sale_record.total THEN
        -- Partial: Credit AR and Cash/Bank
        IF v_sale_record.payment_method = 'cash' THEN
            v_payment_account_id := v_cash_account_id;
        ELSE
            v_payment_account_id := v_bank_account_id;
        END IF;
        
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES 
            (v_journal_entry_id, v_ar_account_id, 0, v_sale_record.total - v_sale_record.paid_amount, 'Reverse AR (unpaid portion)'),
            (v_journal_entry_id, v_payment_account_id, 0, v_sale_record.paid_amount, 'Reverse Cash/Bank payment');
    ELSE
        -- Full payment: Credit Cash/Bank
        IF v_sale_record.payment_method = 'cash' THEN
            v_payment_account_id := v_cash_account_id;
        ELSE
            v_payment_account_id := v_bank_account_id;
        END IF;
        
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_payment_account_id, 0, v_sale_record.total, 'Reverse Cash/Bank payment');
    END IF;

    -- Debit Sales Revenue (reverse original credit)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_sales_account_id, v_sale_record.subtotal, 0, 'Reverse Sales Revenue');

    -- Reverse COGS: Credit COGS, Debit Inventory
    IF v_reverse_cogs > 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES 
            (v_journal_entry_id, v_cogs_account_id, 0, v_reverse_cogs, 'Reverse COGS'),
            (v_journal_entry_id, v_inventory_account_id, v_reverse_cogs, 0, 'Reverse Inventory decrease');
    END IF;

    -- Reverse stock movements (create positive movements)
    FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id
    LOOP
        DECLARE
            v_unit_cost DECIMAL(15,2);
        BEGIN
            -- Get average cost
            SELECT COALESCE(AVG(unit_cost), 0) INTO v_unit_cost
            FROM stock_movements
            WHERE product_id = v_item.product_id
            AND company_id = p_company_id
            AND quantity > 0;

            INSERT INTO stock_movements (
                company_id, branch_id, product_id, movement_type, quantity,
                unit_cost, total_cost, reference_type, reference_id
            )
            VALUES (
                p_company_id, v_sale_record.branch_id,
                v_item.product_id,
                'return',
                v_item.quantity, -- Positive for return
                v_unit_cost,
                v_unit_cost * v_item.quantity,
                'sale_return',
                p_sale_id
            );
        END;
    END LOOP;

    -- Update sale status
    UPDATE sales
    SET status = 'draft', -- Or create a 'cancelled' status
        notes = COALESCE(notes || E'\n', '') || 'CANCELLED: ' || COALESCE(p_reason, 'No reason provided')
    WHERE id = p_sale_id;

    RETURN json_build_object(
        'success', true,
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

-- Function to cancel/return purchase with reverse accounting
CREATE OR REPLACE FUNCTION cancel_purchase_with_reverse_accounting(
    p_purchase_id UUID,
    p_company_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_purchase_record RECORD;
    v_journal_entry_id UUID;
    v_inventory_account_id UUID;
    v_ap_account_id UUID;
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_payment_account_id UUID;
    v_reverse_cost DECIMAL(15,2) := 0;
BEGIN
    -- Get purchase record
    SELECT * INTO v_purchase_record FROM purchases WHERE id = p_purchase_id AND company_id = p_company_id;
    
    IF v_purchase_record.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Purchase not found');
    END IF;

    -- Only allow cancellation if status is 'received' or 'final'
    IF v_purchase_record.status NOT IN ('received', 'final') THEN
        RETURN json_build_object('success', false, 'error', 'Only received/final purchases can be cancelled');
    END IF;

    -- Get default accounts
    SELECT id INTO v_inventory_account_id FROM accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1;
    SELECT id INTO v_ap_account_id FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;

    -- Calculate reverse cost from stock movements
    SELECT COALESCE(SUM(ABS(total_cost)), 0) INTO v_reverse_cost
    FROM stock_movements
    WHERE reference_type = 'purchase'
    AND reference_id = p_purchase_id
    AND company_id = p_company_id;

    -- Create reverse journal entry
    INSERT INTO journal_entries (
        company_id, branch_id, entry_no, entry_date, description,
        reference_type, reference_id
    )
    VALUES (
        p_company_id, v_purchase_record.branch_id,
        'JE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'),
        CURRENT_DATE,
        'Purchase Cancellation: ' || v_purchase_record.po_no || COALESCE(' - ' || p_reason, ''),
        'purchase_return',
        p_purchase_id
    )
    RETURNING id INTO v_journal_entry_id;

    -- Reverse: Credit Inventory (original debit), Debit AP/Cash (original credit)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_entry_id, v_inventory_account_id, 0, v_reverse_cost, 'Reverse Inventory increase');

    IF v_purchase_record.paid_amount = 0 THEN
        -- Unpaid: Debit AP
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_ap_account_id, v_purchase_record.total, 0, 'Reverse AP for cancelled purchase');
    ELSIF v_purchase_record.paid_amount < v_purchase_record.total THEN
        -- Partial: Debit AP and Credit Cash/Bank
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES 
            (v_journal_entry_id, v_ap_account_id, v_purchase_record.total - v_purchase_record.paid_amount, 0, 'Reverse AP (unpaid portion)'),
            (v_journal_entry_id, v_cash_account_id, 0, v_purchase_record.paid_amount, 'Reverse Cash payment');
    ELSE
        -- Full payment: Credit Cash/Bank
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_cash_account_id, 0, v_purchase_record.total, 'Reverse Cash payment');
    END IF;

    -- Reverse stock movements (create negative movements)
    INSERT INTO stock_movements (
        company_id, branch_id, product_id, movement_type, quantity,
        unit_cost, total_cost, reference_type, reference_id
    )
    SELECT 
        p_company_id, v_purchase_record.branch_id,
        product_id,
        'return',
        -quantity, -- Negative for return
        unit_cost,
        -total_cost, -- Negative for return
        'purchase_return',
        p_purchase_id
    FROM purchase_items
    WHERE purchase_id = p_purchase_id;

    -- Update purchase status
    UPDATE purchases
    SET status = 'draft',
        notes = COALESCE(notes || E'\n', '') || 'CANCELLED: ' || COALESCE(p_reason, 'No reason provided')
    WHERE id = p_purchase_id;

    RETURN json_build_object(
        'success', true,
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
