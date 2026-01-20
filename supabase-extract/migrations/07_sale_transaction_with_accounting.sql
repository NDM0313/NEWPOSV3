-- ============================================================================
-- TASK 4: SALE TRANSACTION (END-TO-END WITH ACCOUNTING)
-- ============================================================================
-- Purpose: Complete sale flow with inventory and accounting integration
-- ============================================================================

-- Function to create sale with accounting entries
CREATE OR REPLACE FUNCTION create_sale_with_accounting(
    p_company_id UUID,
    p_branch_id UUID,
    p_customer_id UUID,
    p_customer_name VARCHAR(255),
    p_invoice_date DATE,
    p_type sale_type,
    p_status sale_status,
    p_subtotal DECIMAL(15,2),
    p_discount_amount DECIMAL(15,2),
    p_tax_amount DECIMAL(15,2),
    p_shipping_charges DECIMAL(15,2),
    p_total DECIMAL(15,2),
    p_paid_amount DECIMAL(15,2),
    p_payment_method payment_method_enum,
    p_notes TEXT,
    p_created_by UUID,
    p_items JSONB -- Array of sale items
)
RETURNS JSON AS $$
DECLARE
    v_sale_id UUID;
    v_ar_account_id UUID;
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_sales_account_id UUID;
    v_inventory_account_id UUID;
    v_cogs_account_id UUID;
    v_item RECORD;
    v_total_revenue DECIMAL(15,2) := 0;
    v_total_cogs DECIMAL(15,2) := 0;
    v_journal_entry_id UUID;
    v_stock_movement_id UUID;
    v_unit_cost DECIMAL(15,2);
    v_item_cogs DECIMAL(15,2);
BEGIN
    -- Get default accounts
    SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;
    SELECT id INTO v_sales_account_id FROM accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1;
    SELECT id INTO v_inventory_account_id FROM accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1;
    SELECT id INTO v_cogs_account_id FROM accounts WHERE company_id = p_company_id AND code = '5100' LIMIT 1;

    -- Generate invoice/quotation number
    DECLARE
        v_invoice_no VARCHAR(100);
        v_doc_prefix VARCHAR(10);
        v_next_num INTEGER;
    BEGIN
        IF p_type = 'invoice' THEN
            v_doc_prefix := 'INV-';
        ELSE
            v_doc_prefix := 'QUO-';
        END IF;
        
        SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM '[0-9]+$') AS INTEGER)), 0) + 1
        INTO v_next_num
        FROM sales
        WHERE company_id = p_company_id AND type = p_type;
        
        v_invoice_no := v_doc_prefix || LPAD(v_next_num::TEXT, 6, '0');
    END;

    -- Create sale record
    INSERT INTO sales (
        company_id, branch_id, invoice_no, invoice_date, customer_id, customer_name,
        type, status, payment_status, payment_method, subtotal, discount_amount,
        tax_amount, shipping_charges, total, paid_amount, due_amount, notes, created_by
    )
    VALUES (
        p_company_id, p_branch_id, v_invoice_no, p_invoice_date, p_customer_id, p_customer_name,
        p_type, p_status,
        CASE 
            WHEN p_paid_amount >= p_total THEN 'paid'
            WHEN p_paid_amount > 0 THEN 'partial'
            ELSE 'unpaid'
        END,
        p_payment_method, p_subtotal, p_discount_amount, p_tax_amount,
        p_shipping_charges, p_total, p_paid_amount, p_total - p_paid_amount, p_notes, p_created_by
    )
    RETURNING id INTO v_sale_id;

    -- Insert sale items and create stock movements
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) AS item
    LOOP
        -- Insert sale item
        INSERT INTO sale_items (
            sale_id, product_id, variation_id, product_name, sku,
            quantity, unit, unit_price, discount_percentage, discount_amount,
            tax_percentage, tax_amount, total
        )
        VALUES (
            v_sale_id,
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

        -- Calculate revenue and COGS
        DECLARE
            v_item_revenue DECIMAL(15,2);
            v_product_id UUID;
            v_quantity DECIMAL(15,2);
        BEGIN
            v_product_id := (v_item->>'product_id')::UUID;
            v_quantity := (v_item->>'quantity')::DECIMAL(15,2);
            v_item_revenue := (v_item->>'total')::DECIMAL(15,2);
            v_total_revenue := v_total_revenue + v_item_revenue;

            -- Get average cost from stock movements (FIFO or Average Cost)
            SELECT COALESCE(AVG(unit_cost), 0) INTO v_unit_cost
            FROM stock_movements
            WHERE product_id = v_product_id
            AND company_id = p_company_id
            AND quantity > 0; -- Only IN movements

            v_item_cogs := v_unit_cost * v_quantity;
            v_total_cogs := v_total_cogs + v_item_cogs;

            -- Create stock movement (only if type is 'invoice' and status is 'final')
            IF p_type = 'invoice' AND p_status = 'final' THEN
                INSERT INTO stock_movements (
                    company_id, branch_id, product_id, movement_type, quantity,
                    unit_cost, total_cost, reference_type, reference_id, created_by
                )
                VALUES (
                    p_company_id, p_branch_id,
                    v_product_id,
                    'sale',
                    -v_quantity, -- Negative for OUT
                    v_unit_cost,
                    -v_item_cogs, -- Negative for OUT
                    'sale',
                    v_sale_id,
                    p_created_by
                )
                RETURNING id INTO v_stock_movement_id;
            END IF;
        END;
    END LOOP;

    -- Create accounting entries (only if type is 'invoice' and status is 'final')
    IF p_type = 'invoice' AND p_status = 'final' THEN
        -- Create journal entry
        INSERT INTO journal_entries (
            company_id, branch_id, entry_no, entry_date, description,
            reference_type, reference_id, created_by
        )
        VALUES (
            p_company_id, p_branch_id,
            'JE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'),
            p_invoice_date,
            'Sale: ' || v_invoice_no,
            'sale',
            v_sale_id,
            p_created_by
        )
        RETURNING id INTO v_journal_entry_id;

        -- Debit: Accounts Receivable (if unpaid) or Cash/Bank (if paid)
        IF p_paid_amount = 0 THEN
            -- Debit: Accounts Receivable
            INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_entry_id, v_ar_account_id, p_total, 0, 'Accounts Receivable for sale');
        ELSIF p_paid_amount < p_total THEN
            -- Partial payment: Debit AR for unpaid, Cash/Bank for paid
            DECLARE
                v_payment_account_id UUID;
            BEGIN
                IF p_payment_method = 'cash' THEN
                    v_payment_account_id := v_cash_account_id;
                ELSE
                    v_payment_account_id := v_bank_account_id;
                END IF;
                
                INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
                VALUES 
                    (v_journal_entry_id, v_ar_account_id, p_total - p_paid_amount, 0, 'Accounts Receivable (unpaid portion)'),
                    (v_journal_entry_id, v_payment_account_id, p_paid_amount, 0, 'Cash/Bank payment received');
            END;
        ELSE
            -- Full payment: Debit Cash/Bank
            DECLARE
                v_payment_account_id UUID;
            BEGIN
                IF p_payment_method = 'cash' THEN
                    v_payment_account_id := v_cash_account_id;
                ELSE
                    v_payment_account_id := v_bank_account_id;
                END IF;
                
                INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
                VALUES (v_journal_entry_id, v_payment_account_id, p_total, 0, 'Cash/Bank payment received');
            END;
        END IF;

        -- Credit: Sales Revenue
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_sales_account_id, 0, v_total_revenue, 'Sales Revenue');

        -- COGS Entry: Debit COGS, Credit Inventory
        IF v_total_cogs > 0 THEN
            INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES 
                (v_journal_entry_id, v_cogs_account_id, v_total_cogs, 0, 'Cost of Goods Sold'),
                (v_journal_entry_id, v_inventory_account_id, 0, v_total_cogs, 'Inventory decrease from sale');
        END IF;
    END IF;

    -- Return result
    RETURN json_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'invoice_no', v_invoice_no,
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
