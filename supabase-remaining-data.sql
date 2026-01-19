-- ============================================
-- REMAINING DATA: SETTINGS AND USERS
-- ============================================

-- Settings
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

-- Users
INSERT INTO users (id, email, name, role, branch_id, branch_name, is_active, permissions) VALUES
('00000000-0000-0000-0000-000000000031', 'admin@dincollection.com', 'Admin User', 'Admin', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true, '{"canCreateSale": true, "canEditSale": true, "canDeleteSale": true, "canViewReports": true, "canManageSettings": true, "canManageUsers": true, "canAccessAccounting": true}'::jsonb),
('00000000-0000-0000-0000-000000000032', 'manager@dincollection.com', 'Manager User', 'Manager', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true, '{"canCreateSale": true, "canEditSale": true, "canDeleteSale": false, "canViewReports": true, "canManageSettings": false, "canManageUsers": false, "canAccessAccounting": true}'::jsonb),
('00000000-0000-0000-0000-000000000033', 'staff@dincollection.com', 'Staff User', 'Staff', '00000000-0000-0000-0000-000000000001', 'Main Branch (HQ)', true, '{"canCreateSale": true, "canEditSale": false, "canDeleteSale": false, "canViewReports": false, "canManageSettings": false, "canManageUsers": false, "canAccessAccounting": false}'::jsonb)
ON CONFLICT (email) DO NOTHING;
