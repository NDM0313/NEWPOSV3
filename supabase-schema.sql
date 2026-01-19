-- ============================================
-- 🎯 DIN COLLECTION ERP - SUPABASE SCHEMA
-- ============================================
-- Complete database schema for Din Collection ERP System
-- PostgreSQL/Supabase compatible
-- Created: 2026-01-18

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- ============================================
-- 1. BRANCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    cash_account_id UUID,
    bank_account_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. ACCOUNTS TABLE (Accounting)
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'Cash', 'Bank', 'Mobile Wallet'
    account_type VARCHAR(50) NOT NULL, -- 'Cash', 'Bank', 'Accounts Receivable', etc.
    balance DECIMAL(15, 2) DEFAULT 0,
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. CONTACTS TABLE (Customers, Suppliers, Workers)
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'customer', 'supplier', 'worker'
    worker_role VARCHAR(50), -- 'tailor', 'stitching-master', 'cutter', etc.
    email VARCHAR(255),
    phone VARCHAR(20),
    cnic VARCHAR(20),
    address TEXT,
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    receivables DECIMAL(15, 2) DEFAULT 0,
    payables DECIMAL(15, 2) DEFAULT 0,
    net_balance DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'onhold'
    last_transaction_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contacts_type ON contacts(type);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_branch ON contacts(branch_id);

-- ============================================
-- 4. PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'simple', -- 'simple', 'variable'
    category VARCHAR(100),
    subcategory VARCHAR(100),
    brand VARCHAR(100),
    description TEXT,
    
    -- Pricing
    purchase_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    wholesale_price DECIMAL(15, 2),
    rental_price DECIMAL(15, 2),
    
    -- Stock Management
    stock DECIMAL(10, 2) DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'Piece',
    low_stock_threshold DECIMAL(10, 2) DEFAULT 0,
    reorder_point DECIMAL(10, 2) DEFAULT 0,
    
    -- Attributes
    color VARCHAR(50),
    size VARCHAR(50),
    material VARCHAR(100),
    weight DECIMAL(10, 2),
    dimensions VARCHAR(100),
    
    -- Flags
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive'
    is_rental BOOLEAN DEFAULT false,
    has_variations BOOLEAN DEFAULT false,
    needs_packing BOOLEAN DEFAULT false,
    
    -- Images
    images JSONB, -- Array of image URLs
    thumbnail VARCHAR(500),
    
    -- Supplier Info
    supplier_id UUID REFERENCES contacts(id),
    supplier_name VARCHAR(255),
    supplier_sku VARCHAR(100),
    
    -- Branch
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    
    -- Dates
    last_purchase_date DATE,
    last_sale_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_branch ON products(branch_id);

-- ============================================
-- 5. SALES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_no VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(20) DEFAULT 'invoice', -- 'invoice', 'quotation'
    
    -- Customer Info
    customer_id UUID REFERENCES contacts(id),
    customer VARCHAR(255),
    customer_name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20),
    customer_email VARCHAR(255),
    customer_address TEXT,
    
    -- Transaction Details
    sale_date DATE NOT NULL,
    due_date DATE,
    location VARCHAR(255),
    branch_id UUID REFERENCES branches(id),
    
    -- Items Summary
    items_count INTEGER DEFAULT 0,
    
    -- Pricing
    subtotal DECIMAL(15, 2) DEFAULT 0,
    discount DECIMAL(15, 2) DEFAULT 0,
    discount_type VARCHAR(20), -- 'percentage', 'fixed'
    tax DECIMAL(15, 2) DEFAULT 0,
    expenses DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) DEFAULT 0,
    
    -- Payment
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'paid', 'partial', 'unpaid'
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    due_amount DECIMAL(15, 2) DEFAULT 0,
    return_due DECIMAL(15, 2) DEFAULT 0,
    payment_method VARCHAR(50), -- 'Cash', 'Bank', 'Mobile Wallet'
    
    -- Shipping
    shipping_status VARCHAR(20) DEFAULT 'pending', -- 'delivered', 'processing', 'pending', 'cancelled'
    shipping_address TEXT,
    tracking_number VARCHAR(100),
    
    -- Notes
    notes TEXT,
    internal_notes TEXT,
    
    -- User Info
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sales_invoice_no ON sales(invoice_no);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);
CREATE INDEX idx_sales_branch ON sales(branch_id);

-- ============================================
-- 6. SALE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    quantity DECIMAL(10, 2) NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    discount DECIMAL(15, 2) DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL,
    
    -- Variations
    size VARCHAR(50),
    color VARCHAR(50),
    
    -- Packing (for wholesale)
    thaans INTEGER,
    meters DECIMAL(10, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- ============================================
-- 7. PURCHASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_no VARCHAR(100) UNIQUE NOT NULL,
    reference VARCHAR(100),
    
    -- Supplier Info
    supplier_id UUID REFERENCES contacts(id),
    supplier VARCHAR(255),
    supplier_name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20),
    
    -- Transaction Details
    purchase_date DATE NOT NULL,
    expected_delivery DATE,
    location VARCHAR(255),
    branch_id UUID REFERENCES branches(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'ordered', 'received', 'completed', 'cancelled'
    
    -- Items Summary
    items_count INTEGER DEFAULT 0,
    
    -- Pricing
    subtotal DECIMAL(15, 2) DEFAULT 0,
    discount DECIMAL(15, 2) DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    shipping_cost DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) DEFAULT 0,
    
    -- Payment
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'paid', 'partial', 'unpaid'
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    due_amount DECIMAL(15, 2) DEFAULT 0,
    payment_method VARCHAR(50),
    
    -- Notes
    notes TEXT,
    
    -- User Info
    added_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_purchases_purchase_no ON purchases(purchase_no);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchases_date ON purchases(purchase_date);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_branch ON purchases(branch_id);

-- ============================================
-- 8. PURCHASE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    quantity DECIMAL(10, 2) NOT NULL,
    received_qty DECIMAL(10, 2) DEFAULT 0,
    price DECIMAL(15, 2) NOT NULL,
    discount DECIMAL(15, 2) DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);

-- ============================================
-- 9. EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_no VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Rent', 'Utilities', 'Salaries', etc.
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payee_name VARCHAR(255),
    location VARCHAR(255),
    branch_id UUID REFERENCES branches(id),
    
    -- Status Workflow
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'submitted', 'approved', 'rejected', 'paid'
    submitted_by VARCHAR(255),
    approved_by VARCHAR(255),
    approved_date DATE,
    receipt_attached BOOLEAN DEFAULT false,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_expenses_expense_no ON expenses(expense_no);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_branch ON expenses(branch_id);

-- ============================================
-- 10. RENTALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_number VARCHAR(100) UNIQUE NOT NULL,
    booking_number VARCHAR(100),
    
    -- Status
    status VARCHAR(20) DEFAULT 'booked', -- 'booked', 'confirmed', 'ongoing', 'returned', 'cancelled'
    
    -- Customer Info
    customer_id UUID REFERENCES contacts(id),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_cnic VARCHAR(20),
    customer_address TEXT,
    
    -- Rental Period
    booking_date DATE NOT NULL,
    rental_start_date DATE NOT NULL,
    rental_end_date DATE NOT NULL,
    return_date DATE,
    duration_days INTEGER,
    
    -- Pricing
    rental_amount DECIMAL(15, 2) DEFAULT 0,
    security_deposit DECIMAL(15, 2) DEFAULT 0,
    advance_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    
    -- Payment
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'paid', 'partial', 'pending'
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    balance_due DECIMAL(15, 2) DEFAULT 0,
    payment_method VARCHAR(50),
    
    -- Return Status
    damage_charges DECIMAL(15, 2) DEFAULT 0,
    late_charges DECIMAL(15, 2) DEFAULT 0,
    refund_amount DECIMAL(15, 2) DEFAULT 0,
    
    -- Event Info
    event_type VARCHAR(50), -- 'wedding', 'party', 'photoshoot', 'other'
    event_date DATE,
    delivery_required BOOLEAN DEFAULT false,
    delivery_address TEXT,
    
    -- Branch & Salesman
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    salesman_id UUID,
    salesman_name VARCHAR(255),
    
    -- Notes
    notes TEXT,
    special_instructions TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rentals_rental_number ON rentals(rental_number);
CREATE INDEX idx_rentals_customer ON rentals(customer_id);
CREATE INDEX idx_rentals_status ON rentals(status);
CREATE INDEX idx_rentals_dates ON rentals(rental_start_date, rental_end_date);

-- ============================================
-- 11. RENTAL ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rental_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    daily_rate DECIMAL(15, 2) NOT NULL,
    duration_days INTEGER NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    
    -- Condition Tracking
    condition_out VARCHAR(20), -- 'excellent', 'good', 'fair'
    condition_in VARCHAR(20), -- 'excellent', 'good', 'fair', 'damaged'
    damage_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rental_items_rental ON rental_items(rental_id);
CREATE INDEX idx_rental_items_product ON rental_items(product_id);

-- ============================================
-- 12. STUDIO SALES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS studio_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_no VARCHAR(100) UNIQUE NOT NULL,
    
    -- Customer Info
    customer_id UUID REFERENCES contacts(id),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_address TEXT,
    
    -- Product Info
    product_name VARCHAR(255),
    product_code VARCHAR(100),
    fabric_summary TEXT,
    meters DECIMAL(10, 2),
    
    -- Dates
    sale_date DATE NOT NULL,
    delivery_deadline DATE,
    
    -- Pricing
    total_amount DECIMAL(15, 2) DEFAULT 0,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    balance_due DECIMAL(15, 2) DEFAULT 0,
    fabric_purchase_cost DECIMAL(15, 2) DEFAULT 0,
    
    -- Production Status
    production_status VARCHAR(50) DEFAULT 'Not Started', -- 'Not Started', 'In Progress', 'Completed'
    
    -- Workflow Steps
    workflow_steps JSONB, -- Array of workflow steps
    
    -- Payment
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    payment_method VARCHAR(50),
    
    -- Branch
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_studio_sales_invoice ON studio_sales(invoice_no);
CREATE INDEX idx_studio_sales_customer ON studio_sales(customer_id);
CREATE INDEX idx_studio_sales_status ON studio_sales(production_status);

-- ============================================
-- 13. ACCOUNTING ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date DATE NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'Sale', 'Rental', 'Studio', 'Expense', 'Payment', 'Purchase', 'Manual'
    reference_no VARCHAR(100) NOT NULL,
    debit_account VARCHAR(50) NOT NULL,
    credit_account VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    module VARCHAR(50),
    created_by VARCHAR(255),
    
    -- Metadata (JSON for flexibility)
    metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_accounting_entries_reference ON accounting_entries(reference_no);
CREATE INDEX idx_accounting_entries_source ON accounting_entries(source);
CREATE INDEX idx_accounting_entries_date ON accounting_entries(entry_date);

-- ============================================
-- 14. PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_no VARCHAR(100) UNIQUE NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 'Cash', 'Bank', 'Mobile Wallet'
    account_id UUID REFERENCES accounts(id),
    
    -- Entity Info (flexible for different types)
    entity_type VARCHAR(50), -- 'customer', 'supplier', 'worker'
    entity_id UUID,
    entity_name VARCHAR(255),
    
    -- Reference
    reference_type VARCHAR(50), -- 'sale', 'purchase', 'expense', 'rental', 'studio'
    reference_id UUID,
    reference_no VARCHAR(100),
    
    -- Description
    description TEXT,
    notes TEXT,
    
    -- Branch
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_payment_no ON payments(payment_no);
CREATE INDEX idx_payments_entity ON payments(entity_type, entity_id);
CREATE INDEX idx_payments_reference ON payments(reference_type, reference_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- ============================================
-- 15. STOCK MOVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id),
    movement_type VARCHAR(50) NOT NULL, -- 'purchase', 'sale', 'return', 'adjustment', 'transfer'
    quantity DECIMAL(10, 2) NOT NULL,
    previous_stock DECIMAL(10, 2),
    new_stock DECIMAL(10, 2),
    
    -- Reference
    reference_type VARCHAR(50), -- 'purchase', 'sale', 'adjustment'
    reference_id UUID,
    reference_no VARCHAR(100),
    
    -- Branch
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    
    notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(created_at);

-- ============================================
-- 16. SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    category VARCHAR(50), -- 'company', 'pos', 'sales', 'purchase', 'inventory', 'rental', 'accounting'
    description TEXT,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_settings_key ON settings(key);
CREATE INDEX idx_settings_category ON settings(category);

-- ============================================
-- 17. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'Staff', -- 'Admin', 'Manager', 'Staff'
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    permissions JSONB, -- Flexible permissions object
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_branch ON users(branch_id);

-- ============================================
-- 18. NUMBERING RULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS numbering_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module VARCHAR(50) UNIQUE NOT NULL, -- 'sale', 'purchase', 'rental', 'expense', 'product', 'studio', 'pos'
    prefix VARCHAR(20) NOT NULL,
    next_number INTEGER NOT NULL DEFAULT 1,
    padding INTEGER DEFAULT 4,
    format VARCHAR(100), -- Custom format pattern
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_numbering_rules_module ON numbering_rules(module);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rentals_updated_at BEFORE UPDATE ON rentals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_studio_sales_updated_at BEFORE UPDATE ON studio_sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_numbering_rules_updated_at BEFORE UPDATE ON numbering_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Enable for Supabase
-- ============================================
-- Note: Enable RLS policies based on your authentication requirements
-- ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
-- ... (enable for all tables as needed)

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE branches IS 'Store branches/locations';
COMMENT ON TABLE accounts IS 'Accounting accounts (Cash, Bank, etc.)';
COMMENT ON TABLE contacts IS 'Customers, Suppliers, and Workers';
COMMENT ON TABLE products IS 'Product catalog with inventory';
COMMENT ON TABLE sales IS 'Sales invoices and quotations';
COMMENT ON TABLE sale_items IS 'Items in each sale';
COMMENT ON TABLE purchases IS 'Purchase orders from suppliers';
COMMENT ON TABLE purchase_items IS 'Items in each purchase';
COMMENT ON TABLE expenses IS 'Business expenses';
COMMENT ON TABLE rentals IS 'Rental bookings';
COMMENT ON TABLE rental_items IS 'Items in each rental';
COMMENT ON TABLE studio_sales IS 'Studio custom orders';
COMMENT ON TABLE accounting_entries IS 'Double-entry accounting transactions';
COMMENT ON TABLE payments IS 'Payment records';
COMMENT ON TABLE stock_movements IS 'Inventory stock movement history';
COMMENT ON TABLE settings IS 'System settings and configuration';
COMMENT ON TABLE users IS 'System users';
COMMENT ON TABLE numbering_rules IS 'Auto-numbering rules for documents';
