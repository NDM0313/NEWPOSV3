-- ============================================================================
-- TASK 3: DUMMY DATA INJECTION (REALISTIC)
-- ============================================================================
-- Purpose: Create realistic demo data for testing and demonstration
-- ============================================================================

-- Function to seed demo data
CREATE OR REPLACE FUNCTION seed_demo_data(p_company_id UUID, p_branch_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_category_id UUID;
    v_product_id UUID;
    v_customer_id UUID;
    v_supplier_id UUID;
    v_purchase_id UUID;
    v_sale_id UUID;
    v_expense_id UUID;
    v_account_cash UUID;
    v_account_bank UUID;
    v_account_ar UUID;
    v_account_ap UUID;
    v_account_sales UUID;
    v_account_inventory UUID;
    v_account_cogs UUID;
    v_account_expense UUID;
    v_item JSONB;
    v_items JSONB := '[]'::JSONB;
    v_total DECIMAL(15,2);
    v_result JSON;
BEGIN
    -- Get account IDs
    SELECT id INTO v_account_cash FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_account_bank FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;
    SELECT id INTO v_account_ar FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    SELECT id INTO v_account_ap FROM accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1;
    SELECT id INTO v_account_sales FROM accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1;
    SELECT id INTO v_account_inventory FROM accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1;
    SELECT id INTO v_account_cogs FROM accounts WHERE company_id = p_company_id AND code = '5100' LIMIT 1;
    SELECT id INTO v_account_expense FROM accounts WHERE company_id = p_company_id AND code = '6000' LIMIT 1;

    -- ========================================================================
    -- 1. PRODUCT CATEGORIES
    -- ========================================================================
    INSERT INTO product_categories (company_id, name, description, is_active)
    VALUES 
        (p_company_id, 'Bridal Dresses', 'Traditional bridal wear', true),
        (p_company_id, 'Groom Wear', 'Sherwani and traditional groom outfits', true),
        (p_company_id, 'Accessories', 'Jewelry, shoes, and other accessories', true)
    ON CONFLICT DO NOTHING;

    -- Get category ID
    SELECT id INTO v_category_id FROM product_categories WHERE company_id = p_company_id AND name = 'Bridal Dresses' LIMIT 1;

    -- ========================================================================
    -- 2. PRODUCTS (10-15 products)
    -- ========================================================================
    INSERT INTO products (company_id, name, sku, barcode, category_id, cost_price, retail_price, current_stock, is_active)
    VALUES 
        (p_company_id, 'Red Bridal Dress - Premium', 'BRD-001', '1234567890123', v_category_id, 50000, 75000, 5, true),
        (p_company_id, 'Red Bridal Dress - Standard', 'BRD-002', '1234567890124', v_category_id, 35000, 50000, 8, true),
        (p_company_id, 'Maroon Bridal Dress', 'BRD-003', '1234567890125', v_category_id, 45000, 65000, 6, true),
        (p_company_id, 'Gold Bridal Dress', 'BRD-004', '1234567890126', v_category_id, 60000, 85000, 4, true),
        (p_company_id, 'Pink Bridal Dress', 'BRD-005', '1234567890127', v_category_id, 40000, 60000, 7, true),
        (p_company_id, 'Blue Bridal Dress', 'BRD-006', '1234567890128', v_category_id, 42000, 62000, 5, true),
        (p_company_id, 'Green Bridal Dress', 'BRD-007', '1234567890129', v_category_id, 38000, 58000, 6, true),
        (p_company_id, 'Purple Bridal Dress', 'BRD-008', '1234567890130', v_category_id, 48000, 70000, 5, true),
        (p_company_id, 'White Bridal Dress', 'BRD-009', '1234567890131', v_category_id, 55000, 80000, 3, true),
        (p_company_id, 'Orange Bridal Dress', 'BRD-010', '1234567890132', v_category_id, 39000, 59000, 6, true),
        (p_company_id, 'Red Bridal Dress - Deluxe', 'BRD-011', '1234567890133', v_category_id, 70000, 100000, 2, true),
        (p_company_id, 'Traditional Jewelry Set', 'ACC-001', '1234567890134', v_category_id, 15000, 25000, 10, true),
        (p_company_id, 'Bridal Shoes', 'ACC-002', '1234567890135', v_category_id, 5000, 8000, 15, true)
    ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- 3. CUSTOMERS (5-10 customers)
    -- ========================================================================
    INSERT INTO contacts (company_id, branch_id, type, name, phone, email, address, city, country, opening_balance, credit_limit, is_active, created_by)
    VALUES 
        (p_company_id, p_branch_id, 'customer', 'Fatima Khan', '+92-300-1111111', 'fatima@example.com', '123 Main St', 'Lahore', 'Pakistan', 0, 100000, true, p_user_id),
        (p_company_id, p_branch_id, 'customer', 'Ayesha Ali', '+92-300-2222222', 'ayesha@example.com', '456 Park Ave', 'Karachi', 'Pakistan', 0, 150000, true, p_user_id),
        (p_company_id, p_branch_id, 'customer', 'Sana Ahmed', '+92-300-3333333', 'sana@example.com', '789 Market Rd', 'Islamabad', 'Pakistan', 0, 80000, true, p_user_id),
        (p_company_id, p_branch_id, 'customer', 'Zainab Hassan', '+92-300-4444444', 'zainab@example.com', '321 Garden St', 'Lahore', 'Pakistan', 0, 120000, true, p_user_id),
        (p_company_id, p_branch_id, 'customer', 'Maryam Sheikh', '+92-300-5555555', 'maryam@example.com', '654 River Rd', 'Karachi', 'Pakistan', 0, 90000, true, p_user_id),
        (p_company_id, p_branch_id, 'customer', 'Hira Malik', '+92-300-6666666', 'hira@example.com', '987 Hill Ave', 'Lahore', 'Pakistan', 0, 110000, true, p_user_id),
        (p_company_id, p_branch_id, 'customer', 'Amina Raza', '+92-300-7777777', 'amina@example.com', '147 Valley St', 'Islamabad', 'Pakistan', 0, 95000, true, p_user_id),
        (p_company_id, p_branch_id, 'customer', 'Sara Iqbal', '+92-300-8888888', 'sara@example.com', '258 Mountain Rd', 'Lahore', 'Pakistan', 0, 130000, true, p_user_id)
    ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- 4. SUPPLIERS (5-10 suppliers)
    -- ========================================================================
    INSERT INTO contacts (company_id, branch_id, type, name, phone, email, address, city, country, opening_balance, credit_limit, is_active, created_by)
    VALUES 
        (p_company_id, p_branch_id, 'supplier', 'Fabric Suppliers Ltd', '+92-300-9011111', 'fabric@supplier.com', '100 Factory St', 'Lahore', 'Pakistan', 0, 500000, true, p_user_id),
        (p_company_id, p_branch_id, 'supplier', 'Design House Inc', '+92-300-9022222', 'design@supplier.com', '200 Design Ave', 'Karachi', 'Pakistan', 0, 300000, true, p_user_id),
        (p_company_id, p_branch_id, 'supplier', 'Accessories World', '+92-300-9033333', 'accessories@supplier.com', '300 Accessory Rd', 'Lahore', 'Pakistan', 0, 200000, true, p_user_id),
        (p_company_id, p_branch_id, 'supplier', 'Textile Mills Co', '+92-300-9044444', 'textile@supplier.com', '400 Mill St', 'Faisalabad', 'Pakistan', 0, 400000, true, p_user_id),
        (p_company_id, p_branch_id, 'supplier', 'Embroidery Works', '+92-300-9055555', 'embroidery@supplier.com', '500 Craft Ave', 'Lahore', 'Pakistan', 0, 250000, true, p_user_id),
        (p_company_id, p_branch_id, 'supplier', 'Beads & Stones Co', '+92-300-9066666', 'beads@supplier.com', '600 Jewelry Rd', 'Karachi', 'Pakistan', 0, 150000, true, p_user_id)
    ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- 5. PURCHASES (5 purchases with inventory increase)
    -- ========================================================================
    -- Purchase 1
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-001' LIMIT 1;
    SELECT id INTO v_supplier_id FROM contacts WHERE company_id = p_company_id AND type = 'supplier' AND name = 'Fabric Suppliers Ltd' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Red Bridal Dress - Premium',
            'sku', 'BRD-001',
            'quantity', 3,
            'unit', 'piece',
            'unit_price', 50000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 150000
        )
    );
    
    SELECT create_purchase_with_accounting(
        p_company_id, p_branch_id, v_supplier_id, 'Fabric Suppliers Ltd',
        (CURRENT_DATE - INTERVAL '30 days')::DATE, 'received'::purchase_status, 150000, 0, 0, 0, 150000, 150000, 'Initial stock purchase', p_user_id, v_items
    ) INTO v_result;

    -- Purchase 2
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-002' LIMIT 1;
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Red Bridal Dress - Standard',
            'sku', 'BRD-002',
            'quantity', 5,
            'unit', 'piece',
            'unit_price', 35000,
            'discount_percentage', 5,
            'discount_amount', 8750,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 166250
        )
    );
    
    SELECT create_purchase_with_accounting(
        p_company_id, p_branch_id, v_supplier_id, 'Fabric Suppliers Ltd',
        (CURRENT_DATE - INTERVAL '25 days')::DATE, 'received'::purchase_status, 175000, 8750, 0, 0, 166250, 0, 'Stock purchase', p_user_id, v_items
    ) INTO v_result;

    -- Purchase 3
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-003' LIMIT 1;
    SELECT id INTO v_supplier_id FROM contacts WHERE company_id = p_company_id AND type = 'supplier' AND name = 'Design House Inc' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Maroon Bridal Dress',
            'sku', 'BRD-003',
            'quantity', 4,
            'unit', 'piece',
            'unit_price', 45000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 180000
        )
    );
    
    SELECT create_purchase_with_accounting(
        p_company_id, p_branch_id, v_supplier_id, 'Design House Inc',
        (CURRENT_DATE - INTERVAL '20 days')::DATE, 'received'::purchase_status, 180000, 0, 0, 0, 180000, 180000, 'Purchase order', p_user_id, v_items
    ) INTO v_result;

    -- Purchase 4
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-004' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Gold Bridal Dress',
            'sku', 'BRD-004',
            'quantity', 2,
            'unit', 'piece',
            'unit_price', 60000,
            'discount_percentage', 10,
            'discount_amount', 12000,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 108000
        )
    );
    
    SELECT create_purchase_with_accounting(
        p_company_id, p_branch_id, v_supplier_id, 'Design House Inc',
        (CURRENT_DATE - INTERVAL '15 days')::DATE, 'received'::purchase_status, 120000, 12000, 0, 0, 108000, 108000, 'Premium purchase', p_user_id, v_items
    ) INTO v_result;

    -- Purchase 5
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-005' LIMIT 1;
    SELECT id INTO v_supplier_id FROM contacts WHERE company_id = p_company_id AND type = 'supplier' AND name = 'Accessories World' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Pink Bridal Dress',
            'sku', 'BRD-005',
            'quantity', 6,
            'unit', 'piece',
            'unit_price', 40000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 240000
        )
    );
    
    SELECT create_purchase_with_accounting(
        p_company_id, p_branch_id, v_supplier_id, 'Accessories World',
        (CURRENT_DATE - INTERVAL '10 days')::DATE, 'received'::purchase_status, 240000, 0, 0, 0, 240000, 0, 'Bulk purchase', p_user_id, v_items
    ) INTO v_result;

    -- ========================================================================
    -- 6. SALES (8-10 sales with partial + full payments)
    -- ========================================================================
    -- Sale 1 - Full payment
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-001' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Fatima Khan' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Red Bridal Dress - Premium',
            'sku', 'BRD-001',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 75000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 75000
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Fatima Khan',
        CURRENT_DATE - INTERVAL '28 days', 'invoice', 'final', 75000, 0, 0, 0, 75000, 75000, 'cash', 'Sale to Fatima', p_user_id, v_items
    ) INTO v_result;

    -- Sale 2 - Partial payment
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-002' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Ayesha Ali' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Red Bridal Dress - Standard',
            'sku', 'BRD-002',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 50000,
            'discount_percentage', 5,
            'discount_amount', 2500,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 47500
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Ayesha Ali',
        (CURRENT_DATE - INTERVAL '25 days')::DATE, 'invoice'::sale_type, 'final'::sale_status, 50000, 2500, 0, 0, 47500, 20000, 'cash'::payment_method_enum, 'Partial payment sale', p_user_id, v_items
    ) INTO v_result;

    -- Sale 3 - Full payment
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-003' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Sana Ahmed' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Maroon Bridal Dress',
            'sku', 'BRD-003',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 65000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 65000
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Sana Ahmed',
        (CURRENT_DATE - INTERVAL '22 days')::DATE, 'invoice'::sale_type, 'final'::sale_status, 65000, 0, 0, 0, 65000, 65000, 'bank'::payment_method_enum, 'Full payment sale', p_user_id, v_items
    ) INTO v_result;

    -- Sale 4 - Partial payment
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-004' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Zainab Hassan' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Gold Bridal Dress',
            'sku', 'BRD-004',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 85000,
            'discount_percentage', 10,
            'discount_amount', 8500,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 76500
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Zainab Hassan',
        (CURRENT_DATE - INTERVAL '20 days')::DATE, 'invoice'::sale_type, 'final'::sale_status, 85000, 8500, 0, 0, 76500, 40000, 'cash'::payment_method_enum, 'Partial payment', p_user_id, v_items
    ) INTO v_result;

    -- Sale 5 - Full payment
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-005' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Maryam Sheikh' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Pink Bridal Dress',
            'sku', 'BRD-005',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 60000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 60000
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Maryam Sheikh',
        (CURRENT_DATE - INTERVAL '18 days')::DATE, 'invoice'::sale_type, 'final'::sale_status, 60000, 0, 0, 0, 60000, 60000, 'cash'::payment_method_enum, 'Sale', p_user_id, v_items
    ) INTO v_result;

    -- Sale 6 - Full payment
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-006' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Hira Malik' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Blue Bridal Dress',
            'sku', 'BRD-006',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 62000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 62000
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Hira Malik',
        (CURRENT_DATE - INTERVAL '15 days')::DATE, 'invoice'::sale_type, 'final'::sale_status, 62000, 0, 0, 0, 62000, 62000, 'bank'::payment_method_enum, 'Sale', p_user_id, v_items
    ) INTO v_result;

    -- Sale 7 - Partial payment
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-007' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Amina Raza' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Green Bridal Dress',
            'sku', 'BRD-007',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 58000,
            'discount_percentage', 5,
            'discount_amount', 2900,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 55100
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Amina Raza',
        (CURRENT_DATE - INTERVAL '12 days')::DATE, 'invoice'::sale_type, 'final'::sale_status, 58000, 2900, 0, 0, 55100, 30000, 'cash'::payment_method_enum, 'Partial payment', p_user_id, v_items
    ) INTO v_result;

    -- Sale 8 - Full payment
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-008' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Sara Iqbal' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Purple Bridal Dress',
            'sku', 'BRD-008',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 70000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 70000
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Sara Iqbal',
        (CURRENT_DATE - INTERVAL '10 days')::DATE, 'invoice'::sale_type, 'final'::sale_status, 70000, 0, 0, 0, 70000, 70000, 'bank'::payment_method_enum, 'Sale', p_user_id, v_items
    ) INTO v_result;

    -- Sale 9 - Quotation (not invoiced)
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-009' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Fatima Khan' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'White Bridal Dress',
            'sku', 'BRD-009',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 80000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 80000
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Fatima Khan',
        (CURRENT_DATE - INTERVAL '5 days')::DATE, 'quotation'::sale_type, 'quotation'::sale_status, 80000, 0, 0, 0, 80000, 0, NULL::payment_method_enum, 'Quotation', p_user_id, v_items
    ) INTO v_result;

    -- Sale 10 - Full payment
    SELECT id INTO v_product_id FROM products WHERE company_id = p_company_id AND sku = 'BRD-010' LIMIT 1;
    SELECT id INTO v_customer_id FROM contacts WHERE company_id = p_company_id AND type = 'customer' AND name = 'Ayesha Ali' LIMIT 1;
    
    v_items := jsonb_build_array(
        jsonb_build_object(
            'product_id', v_product_id,
            'product_name', 'Orange Bridal Dress',
            'sku', 'BRD-010',
            'quantity', 1,
            'unit', 'piece',
            'unit_price', 59000,
            'discount_percentage', 0,
            'discount_amount', 0,
            'tax_percentage', 0,
            'tax_amount', 0,
            'total', 59000
        )
    );
    
    SELECT create_sale_with_accounting(
        p_company_id, p_branch_id, v_customer_id, 'Ayesha Ali',
        (CURRENT_DATE - INTERVAL '3 days')::DATE, 'invoice'::sale_type, 'final'::sale_status, 59000, 0, 0, 0, 59000, 59000, 'cash'::payment_method_enum, 'Sale', p_user_id, v_items
    ) INTO v_result;

    -- ========================================================================
    -- 7. EXPENSES (3-5 expenses)
    -- ========================================================================
    SELECT create_expense_with_accounting(
        p_company_id, p_branch_id, 'Rent', 50000, (CURRENT_DATE - INTERVAL '20 days')::DATE, 'bank'::payment_method_enum, true, 'Monthly rent payment', p_user_id
    ) INTO v_result;

    SELECT create_expense_with_accounting(
        p_company_id, p_branch_id, 'Utilities', 15000, (CURRENT_DATE - INTERVAL '15 days')::DATE, 'cash'::payment_method_enum, true, 'Electricity and water bills', p_user_id
    ) INTO v_result;

    SELECT create_expense_with_accounting(
        p_company_id, p_branch_id, 'Marketing', 25000, (CURRENT_DATE - INTERVAL '10 days')::DATE, 'bank'::payment_method_enum, true, 'Social media advertising', p_user_id
    ) INTO v_result;

    SELECT create_expense_with_accounting(
        p_company_id, p_branch_id, 'Staff Salary', 80000, (CURRENT_DATE - INTERVAL '5 days')::DATE, 'bank'::payment_method_enum, true, 'Monthly staff salaries', p_user_id
    ) INTO v_result;

    SELECT create_expense_with_accounting(
        p_company_id, p_branch_id, 'Maintenance', 10000, (CURRENT_DATE - INTERVAL '2 days')::DATE, 'cash'::payment_method_enum, true, 'Equipment maintenance', p_user_id
    ) INTO v_result;

    RETURN json_build_object(
        'success', true,
        'message', 'Demo data seeded successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed demo data for demo company
DO $$
DECLARE
    v_company_id UUID;
    v_branch_id UUID;
    v_user_id UUID;
    result JSON;
BEGIN
    -- Get demo company details
    SELECT id INTO v_company_id FROM companies WHERE is_demo = true LIMIT 1;
    SELECT id INTO v_branch_id FROM branches WHERE company_id = v_company_id AND is_default = true LIMIT 1;
    SELECT id INTO v_user_id FROM users WHERE company_id = v_company_id AND role = 'admin' LIMIT 1;
    
    IF v_company_id IS NOT NULL AND v_branch_id IS NOT NULL AND v_user_id IS NOT NULL THEN
        SELECT seed_demo_data(v_company_id, v_branch_id, v_user_id) INTO result;
        RAISE NOTICE 'Demo data seeding result: %', result;
    ELSE
        RAISE NOTICE 'Demo company not found. Please create demo company first.';
    END IF;
END $$;
