-- ============================================
-- 🎯 DIN COLLECTION ERP - DEMO DATA
-- ============================================
-- Complete demo data matching the application mock data
-- PostgreSQL/Supabase compatible
-- Created: 2026-01-18

-- ============================================
-- 1. BRANCHES DATA
-- ============================================
INSERT INTO branches (id, code, name, address, phone, email, is_active, is_default) VALUES
('00000000-0000-0000-0000-000000000001', 'MB', 'Main Branch (HQ)', 'Main Branch, Lahore, Pakistan', '+92 300 1234567', 'main@dincollection.com', true, true),
('00000000-0000-0000-0000-000000000002', 'MO', 'Mall Outlet', 'Mall Outlet, Lahore, Pakistan', '+92 321 9876543', 'mall@dincollection.com', true, false),
('00000000-0000-0000-0000-000000000003', 'WH', 'Warehouse', 'Warehouse, Lahore, Pakistan', '+92 333 5555555', 'warehouse@dincollection.com', true, false)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. ACCOUNTS DATA
-- ============================================
INSERT INTO accounts (id, name, type, account_type, balance, branch_id, branch_name, is_active) VALUES
-- Cash Accounts
('10000000-0000-0000-0000-000000000001', 'Cash - Main Counter', 'Cash', 'Cash', 150000.00, '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true),
('10000000-0000-0000-0000-000000000002', 'Cash - Petty Cash', 'Cash', 'Cash', 25000.00, '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true),
('10000000-0000-0000-0000-000000000003', 'Cash - Mall Outlet', 'Cash', 'Cash', 75000.00, '00000000-0000-0000-0000-000000000002', 'Mall Outlet', true),

-- Bank Accounts
('20000000-0000-0000-0000-000000000001', 'HBL - Business Account', 'Bank', 'Bank', 2500000.00, '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true),
('20000000-0000-0000-0000-000000000002', 'MCB - Current Account', 'Bank', 'Bank', 1800000.00, '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true),
('20000000-0000-0000-0000-000000000003', 'Meezan Bank - Islamic', 'Bank', 'Bank', 950000.00, '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true),
('20000000-0000-0000-0000-000000000004', 'Allied Bank - Outlet', 'Bank', 'Bank', 450000.00, '00000000-0000-0000-0000-000000000002', 'Mall Outlet', true),

-- Mobile Wallet Accounts
('30000000-0000-0000-0000-000000000001', 'JazzCash - Business', 'Mobile Wallet', 'Mobile Wallet', 45000.00, '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true),
('30000000-0000-0000-0000-000000000002', 'Easypaisa - Store', 'Mobile Wallet', 'Mobile Wallet', 32000.00, '00000000-0000-0000-0000-000000000002', 'Mall Outlet', true),
('30000000-0000-0000-0000-000000000003', 'SadaPay - Digital', 'Mobile Wallet', 'Mobile Wallet', 18000.00, '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. CONTACTS DATA
-- ============================================
INSERT INTO contacts (id, code, name, type, email, phone, address, branch_id, branch_name, receivables, payables, net_balance, status) VALUES
-- Suppliers
('40000000-0000-0000-0000-000000000001', 'SUP-001', 'Bilal Fabrics', 'supplier', 'bilal@example.com', '+92 300 1234567', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 0, 15000, -15000, 'active'),
('40000000-0000-0000-0000-000000000002', 'SUP-003', 'ChenOne', 'supplier', 'purchase@chenone.com', '+92 42 111 222', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000002', 'Mall Outlet', 0, 120000, -120000, 'onhold'),
('40000000-0000-0000-0000-000000000003', 'SUP-005', 'Sapphire Mills', 'supplier', 'accounts@sapphire.com', '+92 300 9876543', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000003', 'Warehouse', 5000, 45000, -40000, 'active'),
('40000000-0000-0000-0000-000000000004', 'SUP-006', 'Premium Dyeing', 'supplier', 'info@premiumdyeing.com', '+92 322 8899001', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000003', 'Warehouse', 0, 25000, -25000, 'inactive'),

-- Customers
('50000000-0000-0000-0000-000000000001', 'CUS-002', 'Ahmed Retailers', 'customer', 'ahmed@example.com', '+92 321 7654321', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 45000, 0, 45000, 'active'),
('50000000-0000-0000-0000-000000000002', 'CUS-004', 'Walk-in Customer', 'customer', '-', '-', '-', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 0, 0, 0, 'active'),
('50000000-0000-0000-0000-000000000003', 'CUS-007', 'Fashion House Ltd', 'customer', 'orders@fashionhouse.com', '+92 300 5566778', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000002', 'Mall Outlet', 85000, 0, 85000, 'active'),

-- Workers
('60000000-0000-0000-0000-000000000001', 'WRK-001', 'Ali Tailor', 'worker', 'ali.tailor@example.com', '+92 333 1122334', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 0, 8000, -8000, 'active'),
('60000000-0000-0000-0000-000000000002', 'WRK-002', 'Hassan Embroidery', 'worker', 'hassan@example.com', '+92 345 9988776', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 0, 12000, -12000, 'active'),
('60000000-0000-0000-0000-000000000003', 'WRK-003', 'Zubair Cutter', 'worker', '-', '+92 301 4455667', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 0, 3500, -3500, 'active'),
('60000000-0000-0000-0000-000000000004', 'WRK-004', 'Imran Helper', 'worker', '-', '+92 340 2233445', 'Lahore, Pakistan', '00000000-0000-0000-0000-000000000002', 'Mall Outlet', 0, 1500, -1500, 'active')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 4. PRODUCTS DATA
-- ============================================
INSERT INTO products (id, sku, name, type, category, brand, purchase_price, selling_price, stock, unit, low_stock_threshold, status, branch_id, branch_name) VALUES
('70000000-0000-0000-0000-000000000001', 'PRD-0001', 'Premium Bridal Lehenga - Red', 'simple', 'Bridal', 'Din Collection', 15000, 25000, 5, 'Piece', 2, 'active', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)'),
('70000000-0000-0000-0000-000000000002', 'PRD-0002', 'Designer Embroidered Suit', 'variable', 'Party Wear', 'Din Collection', 8000, 14000, 12, 'Piece', 5, 'active', '00000000-0000-0000-0000-000000000002', 'Mall Outlet'),
('70000000-0000-0000-0000-000000000003', 'PRD-0003', 'Casual Lawn Collection', 'simple', 'Casual', 'Sapphire', 2500, 4500, 0, 'Piece', 10, 'active', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)'),
('70000000-0000-0000-0000-000000000004', 'PRD-0004', 'Wedding Sherwani - Gold', 'simple', 'Bridal', 'Din Collection', 18000, 30000, 3, 'Piece', 2, 'active', '00000000-0000-0000-0000-000000000003', 'Warehouse'),
('70000000-0000-0000-0000-000000000005', 'PRD-0005', 'Silk Dupatta - Peach', 'simple', 'Accessories', 'ChenOne', 1200, 2200, 25, 'Piece', 5, 'active', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)'),
('70000000-0000-0000-0000-000000000006', 'PRD-0006', 'Cotton Kurta Set', 'variable', 'Casual', 'Khaadi', 1500, 2800, 8, 'Piece', 5, 'active', '00000000-0000-0000-0000-000000000002', 'Mall Outlet'),
('70000000-0000-0000-0000-000000000007', 'PRD-0007', 'Formal Trouser - Black', 'simple', 'Formal', 'Bonanza', 800, 1500, 1, 'Piece', 3, 'active', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)'),
('70000000-0000-0000-0000-000000000008', 'PRD-0008', 'Evening Gown - Navy Blue', 'simple', 'Party Wear', 'Din Collection', 12000, 20000, 4, 'Piece', 2, 'active', '00000000-0000-0000-0000-000000000002', 'Mall Outlet'),
('70000000-0000-0000-0000-000000000009', 'PRD-0009', 'Embroidery Thread Set', 'simple', 'Raw Material', 'Madeira', 500, 900, 50, 'Box', 10, 'active', '00000000-0000-0000-0000-000000000003', 'Warehouse'),
('70000000-0000-0000-0000-000000000010', 'PRD-0010', 'Sequin Work Fabric', 'simple', 'Raw Material', 'Local', 350, 650, 120, 'Meter', 20, 'active', '00000000-0000-0000-0000-000000000003', 'Warehouse')
ON CONFLICT (sku) DO NOTHING;

-- ============================================
-- 5. SALES DATA
-- ============================================
INSERT INTO sales (id, invoice_no, type, customer_id, customer, customer_name, contact_number, sale_date, location, branch_id, items_count, subtotal, expenses, total, paid_amount, due_amount, payment_status, payment_method, shipping_status) VALUES
('80000000-0000-0000-0000-000000000001', 'INV-001', 'invoice', '50000000-0000-0000-0000-000000000001', 'Ahmed Retailers', 'Ahmed Ali', '+92-300-1234567', '2024-01-15', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 12, 45000, 500, 45500, 45500, 0, 'paid', 'Cash', 'delivered'),
('80000000-0000-0000-0000-000000000002', 'INV-002', 'invoice', '50000000-0000-0000-0000-000000000002', 'Walk-in Customer', 'Sara Khan', '+92-321-9876543', '2024-01-15', 'Mall Outlet', '00000000-0000-0000-0000-000000000002', 3, 8000, 200, 8200, 5000, 3200, 'partial', 'Card', 'pending'),
('80000000-0000-0000-0000-000000000003', 'INV-003', 'invoice', NULL, 'Local Store', 'Bilal Ahmed', '+92-333-5555555', '2024-01-14', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 24, 98000, 1200, 99200, 0, 99200, 'unpaid', 'Credit', 'processing'),
('80000000-0000-0000-0000-000000000004', 'INV-004', 'invoice', '50000000-0000-0000-0000-000000000003', 'Fashion House Ltd', 'Usman Malik', '+92-345-7777777', '2024-01-14', 'Mall Outlet', '00000000-0000-0000-0000-000000000002', 8, 32000, 800, 32800, 32800, 0, 'paid', 'Bank Transfer', 'delivered'),
('80000000-0000-0000-0000-000000000005', 'INV-005', 'invoice', NULL, 'Premium Boutique', 'Fatima Sheikh', '+92-300-8888888', '2024-01-13', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 15, 67000, 900, 67900, 40000, 27900, 'partial', 'Cash', 'processing')
ON CONFLICT (invoice_no) DO NOTHING;

-- ============================================
-- 6. SALE ITEMS DATA
-- ============================================
INSERT INTO sale_items (sale_id, product_id, product_name, sku, quantity, price, discount, tax, total) VALUES
('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Premium Bridal Lehenga - Red', 'PRD-0001', 2, 25000, 0, 0, 50000),
('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'Designer Embroidered Suit', 'PRD-0002', 1, 14000, 0, 0, 14000),
('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'Casual Lawn Collection', 'PRD-0003', 10, 4500, 0, 0, 45000)
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. PURCHASES DATA
-- ============================================
INSERT INTO purchases (id, purchase_no, supplier_id, supplier, supplier_name, contact_number, purchase_date, location, branch_id, items_count, subtotal, total, paid_amount, due_amount, payment_status, status, added_by) VALUES
('90000000-0000-0000-0000-000000000001', 'PO-001', '40000000-0000-0000-0000-000000000001', 'Bilal Fabrics', 'Bilal Fabrics', '+92-300-1234567', '2024-01-15', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 24, 15000, 15000, 10000, 5000, 'partial', 'received', 'Ahmad Khan'),
('90000000-0000-0000-0000-000000000002', 'PO-002', '40000000-0000-0000-0000-000000000002', 'ChenOne', 'ChenOne', '+92-42-111-222', '2024-01-14', 'Warehouse', '00000000-0000-0000-0000-000000000003', 50, 120000, 120000, 0, 120000, 'unpaid', 'received', 'Sara Ali'),
('90000000-0000-0000-0000-000000000003', 'PO-003', '40000000-0000-0000-0000-000000000003', 'Sapphire Mills', 'Sapphire Mills', '+92-300-9876543', '2024-01-13', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 12, 45000, 45000, 0, 45000, 'unpaid', 'ordered', 'Bilal Ahmed'),
('90000000-0000-0000-0000-000000000004', 'PO-004', NULL, 'Premium Fabrics Ltd', 'Premium Fabrics Ltd', '+92-321-5555555', '2024-01-12', 'Mall Outlet', '00000000-0000-0000-0000-000000000002', 30, 85000, 85000, 85000, 0, 'paid', 'received', 'Ahmad Khan'),
('90000000-0000-0000-0000-000000000005', 'PO-005', NULL, 'Local Supplier', 'Local Supplier', '+92-333-7777777', '2024-01-11', 'Warehouse', '00000000-0000-0000-0000-000000000003', 18, 32000, 32000, 17000, 15000, 'partial', 'received', 'Sara Ali')
ON CONFLICT (purchase_no) DO NOTHING;

-- ============================================
-- 8. PURCHASE ITEMS DATA
-- ============================================
INSERT INTO purchase_items (purchase_id, product_id, product_name, sku, quantity, received_qty, price, discount, tax, total) VALUES
('90000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000009', 'Embroidery Thread Set', 'PRD-0009', 20, 20, 500, 0, 0, 10000),
('90000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000010', 'Sequin Work Fabric', 'PRD-0010', 100, 100, 350, 0, 0, 35000)
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. EXPENSES DATA
-- ============================================
INSERT INTO expenses (id, expense_no, category, description, amount, expense_date, payment_method, payee_name, location, branch_id, status, submitted_by, approved_by, approved_date, receipt_attached) VALUES
('a0000000-0000-0000-0000-000000000001', 'EXP-0001', 'Rent', 'Monthly shop rent - January 2024', 50000, '2024-01-01', 'Bank Transfer', 'Property Owner', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 'paid', 'Admin User', 'Manager', '2024-01-01', true),
('a0000000-0000-0000-0000-000000000002', 'EXP-0002', 'Utilities', 'Monthly utilities - Electricity and gas bills', 25000, '2024-01-15', 'Bank', 'Utility Company', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 'paid', 'Admin User', 'Manager', '2024-01-15', true),
('a0000000-0000-0000-0000-000000000003', 'EXP-0003', 'Office Supplies', 'Stationery, printing materials', 8500, '2024-01-15', 'Cash', 'Office Supply Store', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 'paid', 'Admin User', 'Manager', '2024-01-15', false),
('a0000000-0000-0000-0000-000000000004', 'EXP-0004', 'Salaries', 'Monthly salaries - January 2024', 150000, '2024-01-01', 'Bank Transfer', 'Staff', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 'paid', 'Admin User', 'Manager', '2024-01-01', true),
('a0000000-0000-0000-0000-000000000005', 'EXP-0005', 'Marketing', 'Social media advertising campaign', 15000, '2024-01-10', 'Bank', 'Marketing Agency', 'Main Branch (HQ)', '00000000-0000-0000-0000-000000000001', 'approved', 'Admin User', 'Manager', '2024-01-10', true)
ON CONFLICT (expense_no) DO NOTHING;

-- ============================================
-- 10. RENTALS DATA
-- ============================================
INSERT INTO rentals (id, rental_number, booking_number, status, customer_id, customer_name, customer_phone, customer_cnic, booking_date, rental_start_date, rental_end_date, duration_days, rental_amount, security_deposit, advance_amount, total_amount, paid_amount, balance_due, payment_status, payment_method, event_type, event_date, branch_id, branch_name) VALUES
('b0000000-0000-0000-0000-000000000001', 'RNT-001', 'BOOK-001', 'confirmed', '50000000-0000-0000-0000-000000000001', 'Ahmed Ali', '+92-300-1234567', '42101-1234567-8', '2024-01-16', '2024-02-01', '2024-02-05', 5, 35000, 25000, 15000, 75000, 50000, 25000, 'partial', 'Cash', 'wedding', '2024-02-05', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)')
ON CONFLICT (rental_number) DO NOTHING;

-- ============================================
-- 11. STUDIO SALES DATA
-- ============================================
INSERT INTO studio_sales (id, invoice_no, customer_id, customer_name, customer_phone, product_name, product_code, fabric_summary, meters, sale_date, delivery_deadline, total_amount, paid_amount, balance_due, production_status, payment_status, payment_method, branch_id, branch_name) VALUES
('c0000000-0000-0000-0000-000000000001', 'STUDIO-001', '50000000-0000-0000-0000-000000000003', 'Zara Ahmed', '+92-300-1111111', 'Custom Bridal Dress', 'STD-001', 'Silk Lawn - Red', 5, '2024-01-14', '2024-01-20', 125000, 125000, 0, 'In Progress', 'paid', 'Mobile Wallet', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)'),
('c0000000-0000-0000-0000-000000000002', 'STUDIO-002', NULL, 'Ayesha Khan', '+92-321-2222222', 'Designer Lehenga', 'STD-002', 'Premium Fabric - Gold', 6, '2024-01-15', '2024-01-25', 150000, 75000, 75000, 'Not Started', 'partial', 'Bank', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)')
ON CONFLICT (invoice_no) DO NOTHING;

-- ============================================
-- 12. ACCOUNTING ENTRIES DATA
-- ============================================
INSERT INTO accounting_entries (id, entry_date, source, reference_no, debit_account, credit_account, amount, description, module, created_by, metadata) VALUES
('d0000000-0000-0000-0000-000000000001', '2024-01-18', 'Sale', 'INV-001', 'Cash', 'Sales Income', 45500, 'Sale to Ahmed Ali - Wedding Dress Collection - Full Payment', 'Sales', 'Admin', '{"customerName": "Ahmed Ali", "invoiceId": "INV-001"}'::jsonb),
('d0000000-0000-0000-0000-000000000002', '2024-01-18', 'Sale', 'INV-002', 'Accounts Receivable', 'Sales Income', 78000, 'Sale to Sara Khan - Premium Bridal Dress - Credit Sale', 'Sales', 'Admin', '{"customerName": "Sara Khan", "invoiceId": "INV-002"}'::jsonb),
('d0000000-0000-0000-0000-000000000003', '2024-01-17', 'Purchase', 'PO-001', 'Inventory', 'Accounts Payable', 150000, 'Purchase from Bilal Fabrics - Raw Materials - Credit', 'Purchases', 'Admin', '{"supplierName": "Bilal Fabrics", "purchaseId": "PO-001"}'::jsonb),
('d0000000-0000-0000-0000-000000000004', '2024-01-17', 'Payment', 'PAY-001', 'Accounts Payable', 'Bank', 50000, 'Partial payment to Bilal Fabrics via HBL Bank', 'Purchases', 'Admin', '{"supplierName": "Bilal Fabrics", "purchaseId": "PO-001"}'::jsonb),
('d0000000-0000-0000-0000-000000000005', '2024-01-16', 'Rental', 'RENT-001', 'Cash', 'Rental Advance', 15000, 'Rental booking advance - Ayesha Malik - Wedding on Feb 5', 'Rental', 'Admin', '{"customerName": "Ayesha Malik", "bookingId": "RENT-001"}'::jsonb),
('d0000000-0000-0000-0000-000000000006', '2024-01-16', 'Rental', 'RENT-001', 'Cash', 'Security Deposit', 25000, 'Security deposit collected - Ayesha Malik rental', 'Rental', 'Admin', '{"customerName": "Ayesha Malik", "bookingId": "RENT-001"}'::jsonb),
('d0000000-0000-0000-0000-000000000007', '2024-01-15', 'Expense', 'EXP-001', 'Expense', 'Cash', 8500, 'Office supplies - Stationery, printing materials', 'Expenses', 'Admin', '{}'::jsonb),
('d0000000-0000-0000-0000-000000000008', '2024-01-15', 'Expense', 'EXP-002', 'Expense', 'Bank', 25000, 'Monthly utilities - Electricity and gas bills', 'Expenses', 'Admin', '{}'::jsonb),
('d0000000-0000-0000-0000-000000000009', '2024-01-14', 'Studio', 'STUDIO-001', 'Mobile Wallet', 'Studio Sales Income', 125000, 'Custom bridal dress order - Zara Ahmed - JazzCash payment', 'Studio', 'Admin', '{"customerName": "Zara Ahmed"}'::jsonb),
('d0000000-0000-0000-0000-000000000010', '2024-01-14', 'Studio', 'JOB-001', 'Cost of Production', 'Worker Payable', 35000, 'Embroidery work completed - Master Khalid - Job STUDIO-001', 'Studio', 'Admin', '{"workerName": "Master Khalid", "stage": "Embroidery"}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================
-- 13. PAYMENTS DATA
-- ============================================
INSERT INTO payments (id, payment_no, payment_date, amount, payment_method, account_id, entity_type, entity_id, entity_name, reference_type, reference_id, reference_no, description, branch_id, branch_name, created_by) VALUES
('e0000000-0000-0000-0000-000000000001', 'PAY-001', '2024-01-17', 50000, 'Bank', '20000000-0000-0000-0000-000000000001', 'supplier', '40000000-0000-0000-0000-000000000001', 'Bilal Fabrics', 'purchase', '90000000-0000-0000-0000-000000000001', 'PO-001', 'Partial payment to Bilal Fabrics', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 'Admin'),
('e0000000-0000-0000-0000-000000000002', 'PAY-002', '2024-01-12', 40000, 'Bank', '20000000-0000-0000-0000-000000000001', 'customer', '50000000-0000-0000-0000-000000000001', 'Ahmed Ali', 'sale', '80000000-0000-0000-0000-000000000003', 'INV-002', 'Partial payment received from Sara Khan', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 'Admin'),
('e0000000-0000-0000-0000-000000000003', 'PAY-003', '2024-01-13', 35000, 'Cash', '10000000-0000-0000-0000-000000000001', 'worker', '60000000-0000-0000-0000-000000000001', 'Ali Tailor', 'studio', 'c0000000-0000-0000-0000-000000000001', 'JOB-001', 'Payment to Master Khalid - Embroidery work', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 'Admin')
ON CONFLICT (payment_no) DO NOTHING;

-- ============================================
-- 14. STOCK MOVEMENTS DATA
-- ============================================
INSERT INTO stock_movements (id, product_id, movement_type, quantity, previous_stock, new_stock, reference_type, reference_id, reference_no, branch_id, branch_name, created_by) VALUES
('f0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000009', 'purchase', 20, 30, 50, 'purchase', '90000000-0000-0000-0000-000000000001', 'PO-001', '00000000-0000-0000-0000-000000000003', 'Warehouse', 'Admin'),
('f0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'sale', -2, 7, 5, 'sale', '80000000-0000-0000-0000-000000000001', 'INV-001', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', 'Admin'),
('f0000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000010', 'purchase', 100, 20, 120, 'purchase', '90000000-0000-0000-0000-000000000002', 'PO-002', '00000000-0000-0000-0000-000000000003', 'Warehouse', 'Admin')
ON CONFLICT DO NOTHING;

-- ============================================
-- 15. NUMBERING RULES DATA
-- ============================================
INSERT INTO numbering_rules (id, module, prefix, next_number, padding) VALUES
('00000000-0000-0000-0000-000000000011', 'sale', 'INV-', 1001, 4),
('00000000-0000-0000-0000-000000000012', 'purchase', 'PO-', 5001, 4),
('00000000-0000-0000-0000-000000000013', 'rental', 'RNT-', 3001, 4),
('00000000-0000-0000-0000-000000000014', 'expense', 'EXP-', 2001, 4),
('00000000-0000-0000-0000-000000000015', 'product', 'PRD-', 1001, 4),
('00000000-0000-0000-0000-000000000016', 'studio', 'STD-', 4001, 4),
('00000000-0000-0000-0000-000000000017', 'pos', 'POS-', 6001, 4),
('00000000-0000-0000-0000-000000000018', 'quotation', 'QUO-', 1001, 4)
ON CONFLICT (module) DO NOTHING;

-- ============================================
-- 16. SETTINGS DATA
-- ============================================
INSERT INTO settings (id, key, value, category, description) VALUES
('00000000-0000-0000-0000-000000000021', 'company.name', '"Din Collection"'::jsonb, 'company', 'Business name'),
('00000000-0000-0000-0000-000000000022', 'company.address', '"Main Branch, Lahore, Pakistan"'::jsonb, 'company', 'Business address'),
('00000000-0000-0000-0000-000000000023', 'company.phone', '"+92 300 1234567"'::jsonb, 'company', 'Business phone'),
('00000000-0000-0000-0000-000000000024', 'company.email', '"contact@dincollection.com"'::jsonb, 'company', 'Business email'),
('00000000-0000-0000-0000-000000000025', 'pos.default_cash_account', '"Cash - Main Counter"'::jsonb, 'pos', 'Default cash account for POS'),
('00000000-0000-0000-0000-000000000026', 'pos.credit_sale_allowed', 'true'::jsonb, 'pos', 'Allow credit sales in POS'),
('00000000-0000-0000-0000-000000000027', 'pos.auto_print_receipt', 'true'::jsonb, 'pos', 'Auto print receipt after sale'),
('00000000-0000-0000-0000-000000000028', 'sales.default_payment_method', '"Cash"'::jsonb, 'sales', 'Default payment method for sales'),
('00000000-0000-0000-0000-000000000029', 'sales.partial_payment_allowed', 'true'::jsonb, 'sales', 'Allow partial payments'),
('00000000-0000-0000-0000-000000000030', 'inventory.low_stock_threshold', '10'::jsonb, 'inventory', 'Low stock alert threshold')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 17. USERS DATA
-- ============================================
INSERT INTO users (id, email, name, role, branch_id, branch_name, is_active, permissions) VALUES
('00000000-0000-0000-0000-000000000031', 'admin@dincollection.com', 'Admin User', 'Admin', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true, '{"canCreateSale": true, "canEditSale": true, "canDeleteSale": true, "canViewReports": true, "canManageSettings": true, "canManageUsers": true, "canAccessAccounting": true}'::jsonb),
('00000000-0000-0000-0000-000000000032', 'manager@dincollection.com', 'Manager User', 'Manager', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true, '{"canCreateSale": true, "canEditSale": true, "canDeleteSale": false, "canViewReports": true, "canManageSettings": false, "canManageUsers": false, "canAccessAccounting": true}'::jsonb),
('00000000-0000-0000-0000-000000000033', 'staff@dincollection.com', 'Staff User', 'Staff', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true, '{"canCreateSale": true, "canEditSale": false, "canDeleteSale": false, "canViewReports": false, "canManageSettings": false, "canManageUsers": false, "canAccessAccounting": false}'::jsonb)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- UPDATE BRANCHES WITH ACCOUNT REFERENCES
-- ============================================
UPDATE branches SET 
    cash_account_id = '10000000-0000-0000-0000-000000000001',
    bank_account_id = '20000000-0000-0000-0000-000000000003'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify data:
-- SELECT COUNT(*) FROM branches; -- Should be 3
-- SELECT COUNT(*) FROM accounts; -- Should be 10
-- SELECT COUNT(*) FROM contacts; -- Should be 11
-- SELECT COUNT(*) FROM products; -- Should be 10
-- SELECT COUNT(*) FROM sales; -- Should be 5
-- SELECT COUNT(*) FROM purchases; -- Should be 5
-- SELECT COUNT(*) FROM expenses; -- Should be 5
-- SELECT COUNT(*) FROM rentals; -- Should be 1
-- SELECT COUNT(*) FROM studio_sales; -- Should be 2
-- SELECT COUNT(*) FROM accounting_entries; -- Should be 10
-- SELECT COUNT(*) FROM payments; -- Should be 3
-- SELECT COUNT(*) FROM stock_movements; -- Should be 3
-- SELECT COUNT(*) FROM numbering_rules; -- Should be 8
-- SELECT COUNT(*) FROM settings; -- Should be 10
-- SELECT COUNT(*) FROM users; -- Should be 3
