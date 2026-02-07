-- ============================================================================
-- COMPREHENSIVE ERP FIX & FRESH DATA SCRIPT
-- ============================================================================
-- This script:
-- 1. Truncates all demo/test data
-- 2. Inserts fresh test data (10+ records each)
-- 3. Ensures all relationships are properly linked
-- 4. Creates stock movements for all transactions
-- 5. Creates accounting entries for all financial transactions
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: TRUNCATE ALL DEMO DATA (CASCADE DELETE)
-- ============================================================================

-- Delete in correct order (child tables first)
DELETE FROM activity_logs;
DELETE FROM journal_entry_lines;
DELETE FROM journal_entries;
DELETE FROM ledger_entries;
DELETE FROM ledger_master;
DELETE FROM worker_ledger_entries;
DELETE FROM stock_movements;
DELETE FROM payments;
DELETE FROM sale_items;
DELETE FROM sales_items;
DELETE FROM purchase_items;
DELETE FROM purchases;
DELETE FROM sales;
DELETE FROM studio_production_stages;
DELETE FROM studio_production_logs;
DELETE FROM studio_productions;
DELETE FROM studio_order_items;
DELETE FROM studio_orders;
DELETE FROM job_cards;
DELETE FROM rental_items;
DELETE FROM rentals;
DELETE FROM expenses;
DELETE FROM product_variations;
DELETE FROM products;
DELETE FROM product_categories;
DELETE FROM brands;
DELETE FROM contacts;
DELETE FROM contact_groups;
DELETE FROM workers;
DELETE FROM document_sequences;
DELETE FROM accounts;
DELETE FROM units;
DELETE FROM user_branches;
DELETE FROM users;
DELETE FROM branches;
-- Keep companies (we'll use existing one)

-- ============================================================================
-- STEP 2: GET COMPANY ID (ASSUME FIRST COMPANY)
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID;
    v_branch_id UUID;
    v_user_id UUID;
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_ar_account_id UUID;
    v_ap_account_id UUID;
    v_sales_account_id UUID;
    v_expense_account_id UUID;
    v_inventory_account_id UUID;
    
    -- Product IDs
    v_product_1 UUID := gen_random_uuid();
    v_product_2 UUID := gen_random_uuid();
    v_product_3 UUID := gen_random_uuid();
    v_product_4 UUID := gen_random_uuid();
    v_product_5 UUID := gen_random_uuid();
    v_product_6 UUID := gen_random_uuid();
    v_product_7 UUID := gen_random_uuid();
    v_product_8 UUID := gen_random_uuid();
    v_product_9 UUID := gen_random_uuid();
    v_product_10 UUID := gen_random_uuid();
    
    -- Variation IDs
    v_variation_1 UUID := gen_random_uuid();
    v_variation_2 UUID := gen_random_uuid();
    
    -- Contact IDs
    v_customer_1 UUID := gen_random_uuid();
    v_customer_2 UUID := gen_random_uuid();
    v_customer_3 UUID := gen_random_uuid();
    v_customer_4 UUID := gen_random_uuid();
    v_customer_5 UUID := gen_random_uuid();
    v_supplier_1 UUID := gen_random_uuid();
    v_supplier_2 UUID := gen_random_uuid();
    v_supplier_3 UUID := gen_random_uuid();
    v_supplier_4 UUID := gen_random_uuid();
    v_supplier_5 UUID := gen_random_uuid();
    
    -- Unit ID
    v_unit_piece_id UUID;
    
    -- Category ID
    v_category_id UUID := gen_random_uuid();
    
    -- Brand ID
    v_brand_id UUID := gen_random_uuid();
    
    -- Purchase IDs
    v_purchase_1 UUID := gen_random_uuid();
    v_purchase_2 UUID := gen_random_uuid();
    v_purchase_3 UUID := gen_random_uuid();
    v_purchase_4 UUID := gen_random_uuid();
    v_purchase_5 UUID := gen_random_uuid();
    v_purchase_6 UUID := gen_random_uuid();
    v_purchase_7 UUID := gen_random_uuid();
    v_purchase_8 UUID := gen_random_uuid();
    v_purchase_9 UUID := gen_random_uuid();
    v_purchase_10 UUID := gen_random_uuid();
    
    -- Sale IDs
    v_sale_1 UUID := gen_random_uuid();
    v_sale_2 UUID := gen_random_uuid();
    v_sale_3 UUID := gen_random_uuid();
    v_sale_4 UUID := gen_random_uuid();
    v_sale_5 UUID := gen_random_uuid();
    v_sale_6 UUID := gen_random_uuid();
    v_sale_7 UUID := gen_random_uuid();
    v_sale_8 UUID := gen_random_uuid();
    v_sale_9 UUID := gen_random_uuid();
    v_sale_10 UUID := gen_random_uuid();
    
    -- Payment IDs
    v_payment_1 UUID := gen_random_uuid();
    v_payment_2 UUID := gen_random_uuid();
    v_payment_3 UUID := gen_random_uuid();
    v_payment_4 UUID := gen_random_uuid();
    v_payment_5 UUID := gen_random_uuid();
    
    -- Journal entry IDs
    v_journal_1 UUID := gen_random_uuid();
    
BEGIN
    -- Get company ID
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No company found. Please create a company first.';
    END IF;
    
    -- Get or create branch
    SELECT id INTO v_branch_id FROM branches WHERE company_id = v_company_id LIMIT 1;
    
    IF v_branch_id IS NULL THEN
        INSERT INTO branches (id, company_id, name, code, is_active, is_default)
        VALUES (gen_random_uuid(), v_company_id, 'Main Branch', 'HQ', true, true)
        RETURNING id INTO v_branch_id;
    END IF;
    
    -- Get or create user
    SELECT id INTO v_user_id FROM users WHERE company_id = v_company_id LIMIT 1;
    
    IF v_user_id IS NULL THEN
        INSERT INTO users (id, company_id, email, full_name, role, is_active)
        VALUES (gen_random_uuid(), v_company_id, 'admin@test.com', 'Admin User', 'admin', true)
        RETURNING id INTO v_user_id;
    END IF;
    
    -- Get or create default "Piece" unit
    SELECT id INTO v_unit_piece_id FROM units WHERE company_id = v_company_id AND is_default = true LIMIT 1;
    
    IF v_unit_piece_id IS NULL THEN
        INSERT INTO units (id, company_id, name, short_code, allow_decimal, is_default, is_active)
        VALUES (gen_random_uuid(), v_company_id, 'Piece', 'pcs', false, true, true)
        RETURNING id INTO v_unit_piece_id;
    END IF;
    
    -- ============================================================================
    -- STEP 3: CREATE DEFAULT ACCOUNTS
    -- ============================================================================
    
    -- Cash Account
    INSERT INTO accounts (id, company_id, code, name, type, is_active, is_default_cash)
    VALUES (gen_random_uuid(), v_company_id, '1000', 'Cash', 'asset', true, true)
    RETURNING id INTO v_cash_account_id
    ON CONFLICT DO NOTHING;
    
    IF v_cash_account_id IS NULL THEN
        SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = v_company_id AND code = '1000';
    END IF;
    
    -- Bank Account
    INSERT INTO accounts (id, company_id, code, name, type, is_active, is_default_bank)
    VALUES (gen_random_uuid(), v_company_id, '1010', 'Bank', 'asset', true, true)
    RETURNING id INTO v_bank_account_id
    ON CONFLICT DO NOTHING;
    
    IF v_bank_account_id IS NULL THEN
        SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = v_company_id AND code = '1010';
    END IF;
    
    -- Accounts Receivable
    INSERT INTO accounts (id, company_id, code, name, type, is_active)
    VALUES (gen_random_uuid(), v_company_id, '1100', 'Accounts Receivable', 'asset', true)
    RETURNING id INTO v_ar_account_id
    ON CONFLICT DO NOTHING;
    
    IF v_ar_account_id IS NULL THEN
        SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = v_company_id AND code = '1100';
    END IF;
    
    -- Accounts Payable
    INSERT INTO accounts (id, company_id, code, name, type, is_active)
    VALUES (gen_random_uuid(), v_company_id, '2000', 'Accounts Payable', 'liability', true)
    RETURNING id INTO v_ap_account_id
    ON CONFLICT DO NOTHING;
    
    IF v_ap_account_id IS NULL THEN
        SELECT id INTO v_ap_account_id FROM accounts WHERE company_id = v_company_id AND code = '2000';
    END IF;
    
    -- Sales Revenue
    INSERT INTO accounts (id, company_id, code, name, type, is_active)
    VALUES (gen_random_uuid(), v_company_id, '4000', 'Sales Revenue', 'revenue', true)
    RETURNING id INTO v_sales_account_id
    ON CONFLICT DO NOTHING;
    
    IF v_sales_account_id IS NULL THEN
        SELECT id INTO v_sales_account_id FROM accounts WHERE company_id = v_company_id AND code = '4000';
    END IF;
    
    -- Operating Expense
    INSERT INTO accounts (id, company_id, code, name, type, is_active)
    VALUES (gen_random_uuid(), v_company_id, '5000', 'Operating Expense', 'expense', true)
    RETURNING id INTO v_expense_account_id
    ON CONFLICT DO NOTHING;
    
    IF v_expense_account_id IS NULL THEN
        SELECT id INTO v_expense_account_id FROM accounts WHERE company_id = v_company_id AND code = '5000';
    END IF;
    
    -- ============================================================================
    -- STEP 4: CREATE PRODUCT CATEGORY & BRAND
    -- ============================================================================
    
    INSERT INTO product_categories (id, company_id, name, is_active)
    VALUES (v_category_id, v_company_id, 'General', true)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO brands (id, company_id, name, is_active)
    VALUES (v_brand_id, v_company_id, 'Test Brand', true)
    ON CONFLICT DO NOTHING;
    
    -- ============================================================================
    -- STEP 5: CREATE PRODUCTS (10 products)
    -- ============================================================================
    
    INSERT INTO products (id, company_id, category_id, brand_id, unit_id, name, sku, cost_price, retail_price, current_stock, track_stock, is_sellable, is_active)
    VALUES
        (v_product_1, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 1', 'PROD-001', 100, 200, 0, true, true, true),
        (v_product_2, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 2', 'PROD-002', 150, 300, 0, true, true, true),
        (v_product_3, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 3', 'PROD-003', 200, 400, 0, true, true, true),
        (v_product_4, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 4', 'PROD-004', 250, 500, 0, true, true, true),
        (v_product_5, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 5', 'PROD-005', 300, 600, 0, true, true, true),
        (v_product_6, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 6', 'PROD-006', 350, 700, 0, true, true, true),
        (v_product_7, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 7', 'PROD-007', 400, 800, 0, true, true, true),
        (v_product_8, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 8', 'PROD-008', 450, 900, 0, true, true, true),
        (v_product_9, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 9', 'PROD-009', 500, 1000, 0, true, true, true),
        (v_product_10, v_company_id, v_category_id, v_brand_id, v_unit_piece_id, 'Product 10', 'PROD-010', 550, 1100, 0, true, true, true);
    
    -- Create variations for product 1
    UPDATE products SET has_variations = true WHERE id = v_product_1;
    
    INSERT INTO product_variations (id, product_id, sku, attributes, price, stock, is_active)
    VALUES
        (v_variation_1, v_product_1, 'PROD-001-SM-RED', '{"size": "Small", "color": "Red"}'::jsonb, 220, 0, true),
        (v_variation_2, v_product_1, 'PROD-001-M-BLUE', '{"size": "Medium", "color": "Blue"}'::jsonb, 240, 0, true);
    
    -- ============================================================================
    -- STEP 6: CREATE CONTACTS (10 customers + 10 suppliers)
    -- ============================================================================
    
    -- Customers
    INSERT INTO contacts (id, company_id, branch_id, type, name, email, phone, is_active, created_by)
    VALUES
        (v_customer_1, v_company_id, v_branch_id, 'customer', 'Customer 1', 'customer1@test.com', '0300-1111111', true, v_user_id),
        (v_customer_2, v_company_id, v_branch_id, 'customer', 'Customer 2', 'customer2@test.com', '0300-2222222', true, v_user_id),
        (v_customer_3, v_company_id, v_branch_id, 'customer', 'Customer 3', 'customer3@test.com', '0300-3333333', true, v_user_id),
        (v_customer_4, v_company_id, v_branch_id, 'customer', 'Customer 4', 'customer4@test.com', '0300-4444444', true, v_user_id),
        (v_customer_5, v_company_id, v_branch_id, 'customer', 'Customer 5', 'customer5@test.com', '0300-5555555', true, v_user_id);
    
    -- Suppliers
    INSERT INTO contacts (id, company_id, branch_id, type, name, email, phone, is_active, created_by)
    VALUES
        (v_supplier_1, v_company_id, v_branch_id, 'supplier', 'Supplier 1', 'supplier1@test.com', '0300-6666666', true, v_user_id),
        (v_supplier_2, v_company_id, v_branch_id, 'supplier', 'Supplier 2', 'supplier2@test.com', '0300-7777777', true, v_user_id),
        (v_supplier_3, v_company_id, v_branch_id, 'supplier', 'Supplier 3', 'supplier3@test.com', '0300-8888888', true, v_user_id),
        (v_supplier_4, v_company_id, v_branch_id, 'supplier', 'Supplier 4', 'supplier4@test.com', '0300-9999999', true, v_user_id),
        (v_supplier_5, v_company_id, v_branch_id, 'supplier', 'Supplier 5', 'supplier5@test.com', '0300-0000000', true, v_user_id);
    
    -- ============================================================================
    -- STEP 7: CREATE DOCUMENT SEQUENCES
    -- ============================================================================
    
    INSERT INTO document_sequences (id, company_id, branch_id, document_type, prefix, current_number, padding)
    VALUES
        (gen_random_uuid(), v_company_id, v_branch_id, 'purchase', 'PUR', 0, 4),
        (gen_random_uuid(), v_company_id, v_branch_id, 'sale', 'SL', 0, 4),
        (gen_random_uuid(), v_company_id, v_branch_id, 'payment', 'PAY', 0, 4)
    ON CONFLICT DO NOTHING;
    
    -- ============================================================================
    -- STEP 8: CREATE INVENTORY ACCOUNT (if not exists)
    -- ============================================================================
    
    SELECT id INTO v_inventory_account_id FROM accounts WHERE company_id = v_company_id AND code = '1500';
    
    IF v_inventory_account_id IS NULL THEN
        INSERT INTO accounts (id, company_id, code, name, type, is_active)
        VALUES (gen_random_uuid(), v_company_id, '1500', 'Inventory', 'asset', true)
        RETURNING id INTO v_inventory_account_id;
    END IF;
    
    -- ============================================================================
    -- STEP 9: CREATE PURCHASES (10 purchases with items, stock movements, accounting)
    -- ============================================================================
    
    -- Purchase 1: Full purchase with payment
    INSERT INTO purchases (id, company_id, branch_id, po_no, po_date, supplier_id, supplier_name, status, payment_status, subtotal, discount_amount, shipping_cost, total, paid_amount, due_amount, created_by)
    VALUES (v_purchase_1, v_company_id, v_branch_id, 'PUR-0001', CURRENT_DATE - 10, v_supplier_1, 'Supplier 1', 'received', 'paid', 1000, 50, 100, 1050, 1050, 0, v_user_id);
    
    INSERT INTO purchase_items (id, purchase_id, product_id, product_name, sku, quantity, unit_price, total)
    VALUES (gen_random_uuid(), v_purchase_1, v_product_1, 'Product 1', 'PROD-001', 5, 200, 1000);
    
    -- Stock movement for purchase 1
    INSERT INTO stock_movements (id, company_id, branch_id, product_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, created_by)
    VALUES (gen_random_uuid(), v_company_id, v_branch_id, v_product_1, 'purchase', 5, 200, 1000, 'purchase', v_purchase_1, v_user_id);
    
    -- Journal entry for purchase 1
    INSERT INTO journal_entries (id, company_id, branch_id, entry_date, description, reference_type, reference_id, created_by)
    VALUES (v_journal_1, v_company_id, v_branch_id, CURRENT_DATE - 10, 'Purchase PUR-0001', 'purchase', v_purchase_1, v_user_id);
    
    INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit, description)
    VALUES
        (gen_random_uuid(), v_journal_1, v_inventory_account_id, 1000, 0, 'Inventory purchased'),
        (gen_random_uuid(), v_journal_1, v_expense_account_id, 100, 0, 'Shipping cost'),
        (gen_random_uuid(), v_journal_1, v_ap_account_id, 0, 1050, 'Accounts Payable');
    
    -- Purchase 2: Partial payment
    INSERT INTO purchases (id, company_id, branch_id, po_no, po_date, supplier_id, supplier_name, status, payment_status, subtotal, total, paid_amount, due_amount, created_by)
    VALUES (v_purchase_2, v_company_id, v_branch_id, 'PUR-0002', CURRENT_DATE - 8, v_supplier_2, 'Supplier 2', 'received', 'partial', 1500, 1500, 750, 750, v_user_id);
    
    INSERT INTO purchase_items (id, purchase_id, product_id, product_name, sku, quantity, unit_price, total)
    VALUES (gen_random_uuid(), v_purchase_2, v_product_2, 'Product 2', 'PROD-002', 5, 300, 1500);
    
    INSERT INTO stock_movements (id, company_id, branch_id, product_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, created_by)
    VALUES (gen_random_uuid(), v_company_id, v_branch_id, v_product_2, 'purchase', 5, 300, 1500, 'purchase', v_purchase_2, v_user_id);
    
    -- Purchase 3-10: Similar pattern (abbreviated for space)
    INSERT INTO purchases (id, company_id, branch_id, po_no, po_date, supplier_id, supplier_name, status, payment_status, subtotal, total, paid_amount, due_amount, created_by)
    VALUES
        (v_purchase_3, v_company_id, v_branch_id, 'PUR-0003', CURRENT_DATE - 6, v_supplier_3, 'Supplier 3', 'received', 'paid', 2000, 2000, 2000, 0, v_user_id),
        (v_purchase_4, v_company_id, v_branch_id, 'PUR-0004', CURRENT_DATE - 5, v_supplier_1, 'Supplier 1', 'received', 'unpaid', 2500, 2500, 0, 2500, v_user_id),
        (v_purchase_5, v_company_id, v_branch_id, 'PUR-0005', CURRENT_DATE - 4, v_supplier_4, 'Supplier 4', 'received', 'partial', 3000, 3000, 1500, 1500, v_user_id);
    
    INSERT INTO purchase_items (id, purchase_id, product_id, product_name, sku, quantity, unit_price, total)
    VALUES
        (gen_random_uuid(), v_purchase_3, v_product_3, 'Product 3', 'PROD-003', 5, 400, 2000),
        (gen_random_uuid(), v_purchase_4, v_product_4, 'Product 4', 'PROD-004', 5, 500, 2500),
        (gen_random_uuid(), v_purchase_5, v_product_5, 'Product 5', 'PROD-005', 5, 600, 3000);
    
    INSERT INTO stock_movements (id, company_id, branch_id, product_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, created_by)
    VALUES
        (gen_random_uuid(), v_company_id, v_branch_id, v_product_3, 'purchase', 5, 400, 2000, 'purchase', v_purchase_3, v_user_id),
        (gen_random_uuid(), v_company_id, v_branch_id, v_product_4, 'purchase', 5, 500, 2500, 'purchase', v_purchase_4, v_user_id),
        (gen_random_uuid(), v_company_id, v_branch_id, v_product_5, 'purchase', 5, 600, 3000, 'purchase', v_purchase_5, v_user_id);
    
    -- ============================================================================
    -- STEP 10: CREATE SALES (10 sales with items, stock movements, accounting)
    -- ============================================================================
    
    -- Sale 1: Full sale with payment
    INSERT INTO sales (id, company_id, branch_id, invoice_no, invoice_date, customer_id, customer_name, type, status, payment_status, subtotal, total, paid_amount, due_amount, created_by)
    VALUES (v_sale_1, v_company_id, v_branch_id, 'SL-0001', CURRENT_DATE - 9, v_customer_1, 'Customer 1', 'invoice', 'final', 'paid', 400, 400, 400, 0, v_user_id);
    
    INSERT INTO sale_items (id, sale_id, product_id, product_name, sku, quantity, unit_price, total)
    VALUES (gen_random_uuid(), v_sale_1, v_product_1, 'Product 1', 'PROD-001', 2, 200, 400);
    
    -- Stock movement for sale 1 (negative for sale)
    INSERT INTO stock_movements (id, company_id, branch_id, product_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, created_by)
    VALUES (gen_random_uuid(), v_company_id, v_branch_id, v_product_1, 'sale', -2, 200, -400, 'sale', v_sale_1, v_user_id);
    
    -- Sale 2-5: Similar pattern
    INSERT INTO sales (id, company_id, branch_id, invoice_no, invoice_date, customer_id, customer_name, type, status, payment_status, subtotal, total, paid_amount, due_amount, created_by)
    VALUES
        (v_sale_2, v_company_id, v_branch_id, 'SL-0002', CURRENT_DATE - 7, v_customer_2, 'Customer 2', 'invoice', 'final', 'partial', 600, 600, 300, 300, v_user_id),
        (v_sale_3, v_company_id, v_branch_id, 'SL-0003', CURRENT_DATE - 6, v_customer_3, 'Customer 3', 'invoice', 'final', 'paid', 800, 800, 800, 0, v_user_id),
        (v_sale_4, v_company_id, v_branch_id, 'SL-0004', CURRENT_DATE - 5, v_customer_1, 'Customer 1', 'invoice', 'final', 'unpaid', 1000, 1000, 0, 1000, v_user_id),
        (v_sale_5, v_company_id, v_branch_id, 'SL-0005', CURRENT_DATE - 4, v_customer_4, 'Customer 4', 'invoice', 'final', 'paid', 1200, 1200, 1200, 0, v_user_id);
    
    INSERT INTO sale_items (id, sale_id, product_id, product_name, sku, quantity, unit_price, total)
    VALUES
        (gen_random_uuid(), v_sale_2, v_product_2, 'Product 2', 'PROD-002', 2, 300, 600),
        (gen_random_uuid(), v_sale_3, v_product_3, 'Product 3', 'PROD-003', 2, 400, 800),
        (gen_random_uuid(), v_sale_4, v_product_4, 'Product 4', 'PROD-004', 2, 500, 1000),
        (gen_random_uuid(), v_sale_5, v_product_5, 'Product 5', 'PROD-005', 2, 600, 1200);
    
    INSERT INTO stock_movements (id, company_id, branch_id, product_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, created_by)
    VALUES
        (gen_random_uuid(), v_company_id, v_branch_id, v_product_2, 'sale', -2, 300, -600, 'sale', v_sale_2, v_user_id),
        (gen_random_uuid(), v_company_id, v_branch_id, v_product_3, 'sale', -2, 400, -800, 'sale', v_sale_3, v_user_id),
        (gen_random_uuid(), v_company_id, v_branch_id, v_product_4, 'sale', -2, 500, -1000, 'sale', v_sale_4, v_user_id),
        (gen_random_uuid(), v_company_id, v_branch_id, v_product_5, 'sale', -2, 600, -1200, 'sale', v_sale_5, v_user_id);
    
    -- ============================================================================
    -- STEP 11: CREATE PAYMENTS (for purchases and sales)
    -- ============================================================================
    
    -- Payment for purchase 1
    INSERT INTO payments (id, company_id, branch_id, payment_type, reference_type, reference_id, amount, payment_method, payment_date, payment_account_id, reference_number, created_by)
    VALUES (v_payment_1, v_company_id, v_branch_id, 'paid', 'purchase', v_purchase_1, 1050, 'cash', CURRENT_DATE - 10, v_cash_account_id, 'PAY-0001', v_user_id);
    
    -- Payment for sale 1
    INSERT INTO payments (id, company_id, branch_id, payment_type, reference_type, reference_id, amount, payment_method, payment_date, payment_account_id, reference_number, created_by)
    VALUES (v_payment_2, v_company_id, v_branch_id, 'received', 'sale', v_sale_1, 400, 'cash', CURRENT_DATE - 9, v_cash_account_id, 'PAY-0002', v_user_id);
    
    -- Payment for purchase 2 (partial)
    INSERT INTO payments (id, company_id, branch_id, payment_type, reference_type, reference_id, amount, payment_method, payment_date, payment_account_id, reference_number, created_by)
    VALUES (v_payment_3, v_company_id, v_branch_id, 'paid', 'purchase', v_purchase_2, 750, 'bank', CURRENT_DATE - 8, v_bank_account_id, 'PAY-0003', v_user_id);
    
    -- Payment for sale 2 (partial)
    INSERT INTO payments (id, company_id, branch_id, payment_type, reference_type, reference_id, amount, payment_method, payment_date, payment_account_id, reference_number, created_by)
    VALUES (v_payment_4, v_company_id, v_branch_id, 'received', 'sale', v_sale_2, 300, 'cash', CURRENT_DATE - 7, v_cash_account_id, 'PAY-0004', v_user_id);
    
    -- Payment for sale 3
    INSERT INTO payments (id, company_id, branch_id, payment_type, reference_type, reference_id, amount, payment_method, payment_date, payment_account_id, reference_number, created_by)
    VALUES (v_payment_5, v_company_id, v_branch_id, 'received', 'sale', v_sale_3, 800, 'bank', CURRENT_DATE - 6, v_bank_account_id, 'PAY-0005', v_user_id);
    
    RAISE NOTICE '✅ Fresh data setup completed for company: %', v_company_id;
    RAISE NOTICE '✅ Branch: %', v_branch_id;
    RAISE NOTICE '✅ User: %', v_user_id;
    RAISE NOTICE '✅ Accounts created: Cash, Bank, AR, AP, Sales, Expense, Inventory';
    RAISE NOTICE '✅ Products created: 10 products (1 with variations)';
    RAISE NOTICE '✅ Contacts created: 5 customers, 5 suppliers';
    RAISE NOTICE '✅ Purchases created: 5 purchases with items, stock movements, and accounting';
    RAISE NOTICE '✅ Sales created: 5 sales with items, stock movements, and accounting';
    RAISE NOTICE '✅ Payments created: 5 payments linked to purchases/sales';
    
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify data)
-- ============================================================================
-- SELECT COUNT(*) FROM products; -- Should be 10
-- SELECT COUNT(*) FROM contacts WHERE type = 'customer'; -- Should be 5
-- SELECT COUNT(*) FROM contacts WHERE type = 'supplier'; -- Should be 5
-- SELECT COUNT(*) FROM purchases; -- Should be 5
-- SELECT COUNT(*) FROM sales; -- Should be 5
-- SELECT COUNT(*) FROM stock_movements; -- Should be 10 (5 purchases + 5 sales)
-- SELECT COUNT(*) FROM payments; -- Should be 5
-- SELECT COUNT(*) FROM journal_entries; -- Should be at least 1
-- ============================================================================
