-- ============================================================================
-- TASK 3: PURCHASE TRANSACTION (END-TO-END WITH ACCOUNTING)
-- ============================================================================
-- Purpose: Complete purchase flow with inventory and accounting integration
-- ============================================================================

-- Function to create purchase with accounting entries
CREATE OR REPLACE FUNCTION create_purchase_with_accounting(
    p_company_id UUID,
    p_branch_id UUID,
    p_supplier_id UUID,
    p_supplier_name VARCHAR(255),
    p_po_date DATE,
    p_status purchase_status,
    p_subtotal DECIMAL(15,2),
    p_discount_amount DECIMAL(15,2),
    p_tax_amount DECIMAL(15,2),
    p_shipping_cost DECIMAL(15,2),
    p_total DECIMAL(15,2),
    p_paid_amount DECIMAL(15,2),
    p_notes TEXT,
    p_created_by UUID,
    p_items JSONB -- Array of purchase items
)
RETURNS JSON AS $$
DECLARE
    v_purchase_id UUID;
    v_inventory_account_id UUID;
    v_ap_account_id UUID;
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_purchase_account_id UUID;
    v_item RECORD;
    v_total_cost DECIMAL(15,2) := 0;
    v_journal_entry_id UUID;
    v_stock_movement_id UUID;
    v_result JSON;
BEGIN
    -- Get default accounts
    SELECT id INTO v_inventory_account_id FROM accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1;
    SELECT id INTO v_ap_account_id FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;
    SELECT id INTO v_purchase_account_id FROM accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1;

    -- Generate PO number
    DECLARE
        v_po_no VARCHAR(100);
        v_next_num INTEGER;
    BEGIN
        -- Get next PO number
        SELECT COALESCE(MAX(CAST(SUBSTRING(po_no FROM '[0-9]+$') AS INTEGER)), 0) + 1
        INTO v_next_num
        FROM purchases
        WHERE company_id = p_company_id;
        
        v_po_no := 'PO-' || LPAD(v_next_num::TEXT, 6, '0');
    END;

    -- Create purchase record
    INSERT INTO purchases (
        company_id, branch_id, po_no, po_date, supplier_id, supplier_name,
        status, payment_status, subtotal, discount_amount, tax_amount,
        shipping_cost, total, paid_amount, due_amount, notes, created_by
    )
    VALUES (
        p_company_id, p_branch_id, v_po_no, p_po_date, p_supplier_id, p_supplier_name,
        p_status,
        CASE 
            WHEN p_paid_amount >= p_total THEN 'paid'
            WHEN p_paid_amount > 0 THEN 'partial'
            ELSE 'unpaid'
        END,
        p_subtotal, p_discount_amount, p_tax_amount, p_shipping_cost,
        p_total, p_paid_amount, p_total - p_paid_amount, p_notes, p_created_by
    )
    RETURNING id INTO v_purchase_id;

    -- Insert purchase items and create stock movements
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) AS item
    LOOP
        -- Insert purchase item
        INSERT INTO purchase_items (
            purchase_id, product_id, variation_id, product_name, sku,
            quantity, unit, unit_price, discount_percentage, discount_amount,
            tax_percentage, tax_amount, total
        )
        VALUES (
            v_purchase_id,
            (v_item->>'product_id')::UUID,
            NULLIF(v_item->>'variation_id', 'null')::UUID,
            v_item->>'product_name',
            COALESCE(v_item->>'sku', 'N/A'),
            (v_item->>'quantity')::DECIMAL(15,2),
            COALESCE(v_item->>'unit', 'piece'),
            (v_item->>'unit_price')::DECIMAL(15,2),
            COALESCE((v_item->>'discount_percentage')::DECIMAL(15,2), 0),
            COALESCE((v_item->>'discount_amount')::DECIMAL(15,2), 0),
            COALESCE((v_item->>'tax_percentage')::DECIMAL(15,2), 0),
            COALESCE((v_item->>'tax_amount')::DECIMAL(15,2), 0),
            (v_item->>'total')::DECIMAL(15,2)
        );

        -- Calculate unit cost (after discount, before tax)
        DECLARE
            v_unit_cost DECIMAL(15,2);
            v_item_total_cost DECIMAL(15,2);
        BEGIN
            v_unit_cost := ((v_item->>'unit_price')::DECIMAL(15,2) - COALESCE((v_item->>'discount_amount')::DECIMAL(15,2), 0)) / NULLIF((v_item->>'quantity')::DECIMAL(15,2), 0);
            v_item_total_cost := v_unit_cost * (v_item->>'quantity')::DECIMAL(15,2);
            v_total_cost := v_total_cost + v_item_total_cost;

            -- Create stock movement (only if status is 'received' or 'final')
            IF p_status IN ('received', 'final') THEN
                INSERT INTO stock_movements (
                    company_id, branch_id, product_id, movement_type, quantity,
                    unit_cost, total_cost, reference_type, reference_id, created_by
                )
                VALUES (
                    p_company_id, p_branch_id,
                    (v_item->>'product_id')::UUID,
                    'purchase',
                    (v_item->>'quantity')::DECIMAL(15,2),
                    v_unit_cost,
                    v_item_total_cost,
                    'purchase',
                    v_purchase_id,
                    p_created_by
                )
                RETURNING id INTO v_stock_movement_id;
            END IF;
        END;
    END LOOP;

    -- Create accounting entries (only if status is 'received' or 'final')
    IF p_status IN ('received', 'final') THEN
        -- Create journal entry
        INSERT INTO journal_entries (
            company_id, branch_id, entry_no, entry_date, description,
            reference_type, reference_id, created_by
        )
        VALUES (
            p_company_id, p_branch_id,
            'JE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'),
            p_po_date,
            'Purchase: ' || v_po_no,
            'purchase',
            v_purchase_id,
            p_created_by
        )
        RETURNING id INTO v_journal_entry_id;

        -- Debit: Inventory (Asset)
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_inventory_account_id, v_total_cost, 0, 'Inventory increase from purchase');

        -- Credit: Accounts Payable (if unpaid) or Cash/Bank (if paid)
        IF p_paid_amount = 0 THEN
            -- Credit: Accounts Payable
            INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_entry_id, v_ap_account_id, 0, p_total, 'Accounts Payable for purchase');
        ELSIF p_paid_amount < p_total THEN
            -- Partial payment: Credit AP for unpaid, Cash/Bank for paid
            INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES 
                (v_journal_entry_id, v_ap_account_id, 0, p_total - p_paid_amount, 'Accounts Payable (unpaid portion)'),
                (v_journal_entry_id, v_cash_account_id, 0, p_paid_amount, 'Cash payment for purchase');
        ELSE
            -- Full payment: Credit Cash/Bank
            INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_entry_id, v_cash_account_id, 0, p_total, 'Cash payment for purchase');
        END IF;
    END IF;

    -- Return result
    RETURN json_build_object(
        'success', true,
        'purchase_id', v_purchase_id,
        'po_no', v_po_no,
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
