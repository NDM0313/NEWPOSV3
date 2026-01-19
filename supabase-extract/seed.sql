-- ============================================================================
-- DIN COLLECTION ERP - SEED DATA
-- Version: 1.0.0
-- Date: January 18, 2026
-- Description: Initial data for testing and demo
-- ============================================================================

-- ============================================================================
-- 1. DEMO COMPANY
-- ============================================================================

INSERT INTO companies (id, name, email, phone, address, city, state, country, tax_number)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Din Collection',
  'info@dincollection.com',
  '+92-300-1234567',
  '123 Main Street, Saddar',
  'Karachi',
  'Sindh',
  'Pakistan',
  'NTN-123456789'
);

-- ============================================================================
-- 2. BRANCHES
-- ============================================================================

INSERT INTO branches (id, company_id, name, code, phone, address, city, is_active)
VALUES
  (
    '00000000-0000-0000-0000-000000000011'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Main Branch (HQ)',
    'HQ',
    '+92-300-1234567',
    '123 Main Street, Saddar',
    'Karachi',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000012'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'DHA Branch',
    'DHA',
    '+92-300-7654321',
    '456 DHA Phase 5',
    'Karachi',
    true
  );

-- ============================================================================
-- 3. CHART OF ACCOUNTS (DEFAULT)
-- ============================================================================

-- ASSETS
INSERT INTO accounts (id, company_id, code, name, type, subtype, opening_balance, current_balance, is_system, is_active)
VALUES
  -- Cash Accounts
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1001', 'Main Cash Counter', 'asset', 'cash', 50000, 50000, true, true),
  ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1002', 'Shop Till', 'asset', 'cash', 20000, 20000, true, true),
  ('10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1003', 'Petty Cash', 'asset', 'cash', 5000, 5000, true, true),
  
  -- Bank Accounts
  ('10000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1011', 'Meezan Bank - Current', 'asset', 'bank', 500000, 500000, true, true),
  ('10000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1012', 'HBL - Current', 'asset', 'bank', 300000, 300000, true, true),
  ('10000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1013', 'UBL - Savings', 'asset', 'bank', 200000, 200000, true, true),
  
  -- Mobile Wallets
  ('10000000-0000-0000-0000-000000000020'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1021', 'JazzCash', 'asset', 'mobile_wallet', 10000, 10000, true, true),
  ('10000000-0000-0000-0000-000000000021'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1022', 'EasyPaisa', 'asset', 'mobile_wallet', 8000, 8000, true, true),
  
  -- Accounts Receivable
  ('10000000-0000-0000-0000-000000000030'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1031', 'Accounts Receivable - Customers', 'asset', 'accounts_receivable', 0, 0, true, true),
  
  -- Inventory
  ('10000000-0000-0000-0000-000000000040'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1041', 'Inventory - Bridal Dresses', 'asset', 'inventory', 0, 0, true, true),
  ('10000000-0000-0000-0000-000000000041'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1042', 'Inventory - Accessories', 'asset', 'inventory', 0, 0, true, true);

-- LIABILITIES
INSERT INTO accounts (id, company_id, code, name, type, subtype, opening_balance, current_balance, is_system, is_active)
VALUES
  -- Accounts Payable
  ('20000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '2001', 'Accounts Payable - Suppliers', 'liability', 'accounts_payable', 0, 0, true, true),
  
  -- Security Deposits (Rental)
  ('20000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '2011', 'Customer Security Deposits', 'liability', 'current_liability', 0, 0, true, true);

-- EQUITY
INSERT INTO accounts (id, company_id, code, name, type, subtype, opening_balance, current_balance, is_system, is_active)
VALUES
  ('30000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '3001', 'Owner Capital', 'equity', 'owner_capital', 1000000, 1000000, true, true),
  ('30000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '3002', 'Retained Earnings', 'equity', 'retained_earnings', 0, 0, true, true);

-- REVENUE
INSERT INTO accounts (id, company_id, code, name, type, subtype, opening_balance, current_balance, is_system, is_active)
VALUES
  ('40000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '4001', 'Sales Revenue', 'revenue', 'sales_revenue', 0, 0, true, true),
  ('40000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '4002', 'Rental Revenue', 'revenue', 'rental_revenue', 0, 0, true, true),
  ('40000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '4003', 'Studio Revenue', 'revenue', 'studio_revenue', 0, 0, true, true);

-- EXPENSES
INSERT INTO accounts (id, company_id, code, name, type, subtype, opening_balance, current_balance, is_system, is_active)
VALUES
  ('50000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '5001', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 0, 0, true, true),
  ('50000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '5002', 'Rent Expense', 'expense', 'operating_expense', 0, 0, true, true),
  ('50000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '5003', 'Utilities Expense', 'expense', 'operating_expense', 0, 0, true, true),
  ('50000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '5004', 'Salaries Expense', 'expense', 'operating_expense', 0, 0, true, true),
  ('50000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '5005', 'Marketing Expense', 'expense', 'operating_expense', 0, 0, true, true);

-- ============================================================================
-- 4. MODULE CONFIGURATIONS
-- ============================================================================

INSERT INTO modules_config (company_id, module_name, is_enabled, config)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'rentals', true, '{"security_deposit_percentage": 50}'::jsonb),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'studio', true, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'accounting', true, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'manufacturing', false, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'loyalty', false, '{}'::jsonb);

-- ============================================================================
-- 5. SETTINGS (DEFAULT)
-- ============================================================================

INSERT INTO settings (company_id, key, value, category)
VALUES
  -- General
  ('00000000-0000-0000-0000-000000000001'::uuid, 'default_currency', '"PKR"'::jsonb, 'general'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'date_format', '"DD/MM/YYYY"'::jsonb, 'general'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'time_zone', '"Asia/Karachi"'::jsonb, 'general'),
  
  -- Accounting
  ('00000000-0000-0000-0000-000000000001'::uuid, 'default_cash_account', '"10000000-0000-0000-0000-000000000001"'::jsonb, 'accounting'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'default_bank_account', '"10000000-0000-0000-0000-000000000010"'::jsonb, 'accounting'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'default_sales_account', '"40000000-0000-0000-0000-000000000001"'::jsonb, 'accounting'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'default_cogs_account', '"50000000-0000-0000-0000-000000000001"'::jsonb, 'accounting'),
  
  -- Sales
  ('00000000-0000-0000-0000-000000000001'::uuid, 'allow_credit_sales', 'true'::jsonb, 'sales'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'default_tax_rate', '0'::jsonb, 'sales'),
  
  -- Inventory
  ('00000000-0000-0000-0000-000000000001'::uuid, 'allow_negative_stock', 'false'::jsonb, 'inventory'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'stock_valuation_method', '"fifo"'::jsonb, 'inventory');

-- ============================================================================
-- 6. PRODUCT CATEGORIES
-- ============================================================================

INSERT INTO product_categories (id, company_id, name, description)
VALUES
  ('c0000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Bridal Dresses', 'Wedding and bridal wear'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Dupattas', 'Dupattas and shawls'),
  ('c0000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Jewelry', 'Bridal jewelry and accessories'),
  ('c0000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Shoes', 'Bridal footwear'),
  ('c0000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Accessories', 'Other accessories');

-- ============================================================================
-- 7. SAMPLE PRODUCTS
-- ============================================================================

INSERT INTO products (id, company_id, category_id, name, sku, description, retail_price, wholesale_price, rental_price_daily, current_stock, min_stock, is_rentable, is_sellable, has_variations)
VALUES
  (
    'p0000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'c0000000-0000-0000-0000-000000000001'::uuid,
    'Bridal Dress - Red Embroidered',
    'BD-RED-001',
    'Beautiful red bridal dress with heavy embroidery',
    150000,
    120000,
    5000,
    5,
    2,
    true,
    true,
    true
  ),
  (
    'p0000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'c0000000-0000-0000-0000-000000000002'::uuid,
    'Dupatta - Gold Net',
    'DUP-GOLD-001',
    'Gold net dupatta with lace border',
    15000,
    12000,
    1000,
    10,
    3,
    true,
    true,
    false
  ),
  (
    'p0000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'c0000000-0000-0000-0000-000000000003'::uuid,
    'Jewelry Set - Complete Bridal',
    'JWL-BRIDAL-001',
    'Complete bridal jewelry set with necklace, earrings, tikka',
    80000,
    70000,
    3000,
    3,
    1,
    true,
    true,
    false
  );

-- Sample product variation (for Bridal Dress)
INSERT INTO product_variations (product_id, name, sku, attributes, retail_price, current_stock)
VALUES
  (
    'p0000000-0000-0000-0000-000000000001'::uuid,
    'Bridal Dress - Red Embroidered (Small)',
    'BD-RED-001-S',
    '{"size": "Small"}'::jsonb,
    150000,
    2
  ),
  (
    'p0000000-0000-0000-0000-000000000001'::uuid,
    'Bridal Dress - Red Embroidered (Medium)',
    'BD-RED-001-M',
    '{"size": "Medium"}'::jsonb,
    150000,
    2
  ),
  (
    'p0000000-0000-0000-0000-000000000001'::uuid,
    'Bridal Dress - Red Embroidered (Large)',
    'BD-RED-001-L',
    '{"size": "Large"}'::jsonb,
    150000,
    1
  );

-- ============================================================================
-- 8. SAMPLE CONTACTS
-- ============================================================================

INSERT INTO contacts (id, company_id, type, name, phone, email, address, city, opening_balance, current_balance)
VALUES
  -- Customers
  (
    'ct000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'customer',
    'Ayesha Khan',
    '+92-300-1111111',
    'ayesha@example.com',
    'House 123, Block A, Gulshan-e-Iqbal',
    'Karachi',
    0,
    0
  ),
  (
    'ct000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'customer',
    'Sara Ahmed',
    '+92-300-2222222',
    'sara@example.com',
    'Flat 456, DHA Phase 5',
    'Karachi',
    0,
    0
  ),
  
  -- Suppliers
  (
    'ct000000-0000-0000-0000-000000000011'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'supplier',
    'Fashion Fabrics Ltd',
    '+92-300-3333333',
    'info@fashionfabrics.com',
    'Shop 789, Cloth Market',
    'Karachi',
    0,
    0
  ),
  (
    'ct000000-0000-0000-0000-000000000012'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'supplier',
    'Embroidery House',
    '+92-300-4444444',
    'contact@embroideryhouse.com',
    'Plaza ABC, Saddar',
    'Karachi',
    0,
    0
  ),
  
  -- Walk-in customer (default)
  (
    'ct000000-0000-0000-0000-000000000099'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'customer',
    'Walk-in Customer',
    NULL,
    NULL,
    NULL,
    NULL,
    0,
    0
  );

-- ============================================================================
-- 9. SAMPLE WORKERS (Studio)
-- ============================================================================

INSERT INTO workers (id, company_id, name, phone, worker_type, payment_type, rate, current_balance)
VALUES
  (
    'w0000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Ali (Master Tailor)',
    '+92-300-5555555',
    'tailor',
    'per_piece',
    1500,
    0
  ),
  (
    'w0000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Hassan (Cutter)',
    '+92-300-6666666',
    'cutter',
    'per_piece',
    800,
    0
  ),
  (
    'w0000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Fatima (Embroidery)',
    '+92-300-7777777',
    'embroidery',
    'per_piece',
    2000,
    0
  );

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Seed data inserted successfully!';
  RAISE NOTICE '📊 Company: Din Collection';
  RAISE NOTICE '🏢 Branches: 2';
  RAISE NOTICE '💰 Accounts: 23';
  RAISE NOTICE '📦 Products: 3';
  RAISE NOTICE '👥 Contacts: 5';
  RAISE NOTICE '👷 Workers: 3';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Ready to use!';
END $$;
