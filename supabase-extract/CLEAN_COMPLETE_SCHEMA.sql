-- ============================================================================
-- DIN COLLECTION ERP - CLEAN COMPLETE DATABASE SCHEMA
-- Version: 2.0.0 (CLEAN RESET)
-- Date: January 2026
-- Description: Complete, production-ready schema with all required tables
-- ============================================================================
-- 
-- IMPORTANT: This is a CLEAN schema. Use this to RESET your development database.
-- 
-- EXECUTION ORDER:
-- 1. Drop all existing tables (if resetting)
-- 2. Run this schema
-- 3. Run RLS policies
-- 4. Run functions/triggers
-- 5. Seed initial data (optional)
--
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- User roles
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'accountant', 'salesperson', 'inventory_clerk', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Contact types
DO $$ BEGIN
  CREATE TYPE contact_type AS ENUM ('customer', 'supplier', 'both', 'worker');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Transaction statuses
DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('draft', 'quotation', 'ordered', 'received', 'final', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Payment statuses
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'unpaid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Payment methods
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'card', 'wallet', 'cheque', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Account types
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Account sub-types
DO $$ BEGIN
  CREATE TYPE account_subtype AS ENUM (
    'cash', 'bank', 'mobile_wallet', 'accounts_receivable', 'accounts_payable',
    'inventory', 'fixed_asset', 'current_asset', 'current_liability', 'long_term_liability',
    'owner_capital', 'retained_earnings', 'sales_revenue', 'rental_revenue', 'studio_revenue',
    'cost_of_goods_sold', 'operating_expense', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Stock movement types
DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM (
    'purchase', 'sale', 'rental_out', 'rental_return', 'adjustment',
    'transfer_in', 'transfer_out', 'damage', 'loss', 'return'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Rental statuses
DO $$ BEGIN
  CREATE TYPE rental_status AS ENUM ('booked', 'picked_up', 'active', 'returned', 'overdue', 'closed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Studio order statuses
DO $$ BEGIN
  CREATE TYPE studio_status AS ENUM ('pending', 'in_progress', 'ready', 'delivered', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Expense categories
DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM (
    'rent', 'utilities', 'salaries', 'marketing', 'travel',
    'office_supplies', 'repairs', 'professional_fees', 'insurance',
    'taxes', 'miscellaneous'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 1. COMPANIES & BRANCHES
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Pakistan',
  postal_code VARCHAR(20),
  tax_number VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'PKR',
  financial_year_start DATE DEFAULT '2024-01-01',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  manager_id UUID, -- References users table (added later)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================================
-- 2. USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role user_role DEFAULT 'viewer',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb, -- Store module permissions as JSONB
  is_system BOOLEAN DEFAULT false, -- System roles can't be deleted
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  module VARCHAR(100) NOT NULL, -- 'sales', 'purchases', 'products', etc.
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module)
);

-- ============================================================================
-- 3. CONTACTS (Customers & Suppliers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type contact_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  cnic VARCHAR(50),
  ntn VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Pakistan',
  postal_code VARCHAR(20),
  opening_balance DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 0, -- Days
  tax_number VARCHAR(100),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. PRODUCTS & INVENTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),
  description TEXT,
  unit VARCHAR(50) DEFAULT 'piece', -- piece, meter, kg, etc.
  
  -- Pricing
  cost_price DECIMAL(15,2) DEFAULT 0,
  retail_price DECIMAL(15,2) DEFAULT 0,
  wholesale_price DECIMAL(15,2) DEFAULT 0,
  rental_price_daily DECIMAL(15,2) DEFAULT 0,
  rental_price_weekly DECIMAL(15,2) DEFAULT 0,
  rental_price_monthly DECIMAL(15,2) DEFAULT 0,
  
  -- Stock
  current_stock DECIMAL(15,2) DEFAULT 0,
  min_stock DECIMAL(15,2) DEFAULT 0,
  max_stock DECIMAL(15,2) DEFAULT 0,
  reorder_point DECIMAL(15,2) DEFAULT 0,
  
  -- Variations support
  has_variations BOOLEAN DEFAULT false,
  
  -- Images
  image_url TEXT,
  gallery_urls JSONB DEFAULT '[]'::jsonb,
  
  -- Flags
  is_rentable BOOLEAN DEFAULT false,
  is_sellable BOOLEAN DEFAULT true,
  is_purchasable BOOLEAN DEFAULT true,
  track_stock BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sku)
);

-- Product variations (Size, Color, etc.)
CREATE TABLE IF NOT EXISTS product_variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g., "Size: Large, Color: Red"
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),
  attributes JSONB NOT NULL, -- {"size": "Large", "color": "Red"}
  
  -- Pricing (can override parent)
  cost_price DECIMAL(15,2),
  retail_price DECIMAL(15,2),
  wholesale_price DECIMAL(15,2),
  
  -- Stock
  current_stock DECIMAL(15,2) DEFAULT 0,
  
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, sku)
);

-- Product packings (Fabric/Wholesale packing information)
CREATE TABLE IF NOT EXISTS product_packings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  packing_type VARCHAR(50) NOT NULL, -- 'fabric', 'wholesale', 'retail', etc.
  packing_name VARCHAR(255) NOT NULL, -- e.g., "Box 1", "Thaan 1"
  quantity_per_pack DECIMAL(15,2) NOT NULL,
  unit VARCHAR(50) NOT NULL, -- 'meters', 'boxes', 'pieces', etc.
  total_quantity DECIMAL(15,2) NOT NULL, -- Total quantity in this packing
  details JSONB DEFAULT '{}'::jsonb, -- Additional packing details (boxes, meters, thaans, etc.)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock movements/ledger (inventory_movements)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  
  type stock_movement_type NOT NULL,
  quantity DECIMAL(15,2) NOT NULL,
  unit_cost DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  
  -- Balance after this movement
  balance_qty DECIMAL(15,2) NOT NULL,
  
  -- Reference to source transaction
  reference_type VARCHAR(50), -- 'sale', 'purchase', 'rental', 'adjustment'
  reference_id UUID,
  
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. SALES MODULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  
  invoice_no VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL, -- Denormalized for performance
  
  status transaction_status DEFAULT 'draft',
  payment_status payment_status DEFAULT 'unpaid',
  
  -- Amounts
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  shipping_charges DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  due_amount DECIMAL(15,2) DEFAULT 0,
  
  -- Additional info
  sale_type VARCHAR(50) DEFAULT 'regular', -- 'regular', 'studio', 'rental'
  delivery_date DATE,
  notes TEXT,
  terms_conditions TEXT,
  
  -- Accounting reference
  journal_entry_id UUID, -- Reference to accounting entry
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  
  quantity DECIMAL(15,2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'piece',
  unit_price DECIMAL(15,2) NOT NULL,
  
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  
  total DECIMAL(15,2) NOT NULL,
  
  -- PACKING COLUMNS (REQUIRED)
  packing_type VARCHAR(50),
  packing_quantity DECIMAL(15,2),
  packing_unit VARCHAR(50),
  packing_details JSONB,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. PURCHASES MODULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  
  po_no VARCHAR(50) NOT NULL,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  supplier_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255) NOT NULL,
  
  status transaction_status DEFAULT 'draft',
  payment_status payment_status DEFAULT 'unpaid',
  
  -- Amounts
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  due_amount DECIMAL(15,2) DEFAULT 0,
  
  expected_delivery_date DATE,
  received_date DATE,
  notes TEXT,
  
  -- Accounting reference
  journal_entry_id UUID,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, po_no)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  
  quantity DECIMAL(15,2) NOT NULL,
  received_qty DECIMAL(15,2) DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'piece',
  unit_price DECIMAL(15,2) NOT NULL,
  
  discount DECIMAL(15,2) DEFAULT 0,
  tax DECIMAL(15,2) DEFAULT 0,
  
  total DECIMAL(15,2) NOT NULL,
  
  -- PACKING COLUMNS (REQUIRED)
  packing_type VARCHAR(50),
  packing_quantity DECIMAL(15,2),
  packing_unit VARCHAR(50),
  packing_details JSONB,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. RENTALS MODULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  
  booking_no VARCHAR(50) NOT NULL,
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  customer_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  customer_name VARCHAR(255) NOT NULL,
  
  status rental_status DEFAULT 'booked',
  
  -- Dates
  pickup_date DATE NOT NULL,
  return_date DATE NOT NULL,
  actual_return_date DATE,
  duration_days INTEGER NOT NULL,
  
  -- Amounts
  rental_charges DECIMAL(15,2) DEFAULT 0,
  security_deposit DECIMAL(15,2) DEFAULT 0,
  late_fee DECIMAL(15,2) DEFAULT 0,
  damage_charges DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  refund_amount DECIMAL(15,2) DEFAULT 0,
  
  notes TEXT,
  
  -- Accounting reference
  journal_entry_id UUID,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, booking_no)
);

CREATE TABLE IF NOT EXISTS rental_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  
  quantity DECIMAL(15,2) NOT NULL,
  rate_per_day DECIMAL(15,2) NOT NULL,
  duration_days INTEGER NOT NULL,
  total DECIMAL(15,2) NOT NULL,
  
  -- Return info
  returned_quantity DECIMAL(15,2) DEFAULT 0,
  condition_on_return VARCHAR(50), -- 'good', 'damaged', 'lost'
  damage_amount DECIMAL(15,2) DEFAULT 0,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. STUDIO PRODUCTION MODULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  
  order_no VARCHAR(50) NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  customer_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  customer_name VARCHAR(255) NOT NULL,
  
  status studio_status DEFAULT 'pending',
  
  order_type VARCHAR(50), -- 'stitching', 'alteration', 'design'
  
  -- Amounts
  total_cost DECIMAL(15,2) DEFAULT 0,
  advance_paid DECIMAL(15,2) DEFAULT 0,
  balance_due DECIMAL(15,2) DEFAULT 0,
  
  delivery_date DATE,
  actual_delivery_date DATE,
  
  measurements JSONB, -- Store customer measurements
  notes TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, order_no)
);

CREATE TABLE IF NOT EXISTS studio_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_order_id UUID NOT NULL REFERENCES studio_orders(id) ON DELETE CASCADE,
  
  item_description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  total DECIMAL(15,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  cnic VARCHAR(50),
  address TEXT,
  
  worker_type VARCHAR(50), -- 'tailor', 'cutter', 'finisher', 'embroidery'
  
  -- Payment info
  payment_type VARCHAR(50), -- 'per_piece', 'daily', 'monthly'
  rate DECIMAL(15,2) DEFAULT 0,
  
  current_balance DECIMAL(15,2) DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_order_id UUID NOT NULL REFERENCES studio_orders(id) ON DELETE CASCADE,
  
  task_type VARCHAR(50), -- 'cutting', 'stitching', 'finishing', 'embroidery'
  assigned_worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  
  start_date DATE,
  end_date DATE,
  
  payment_amount DECIMAL(15,2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. EXPENSES MODULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  
  expense_no VARCHAR(50) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  
  amount DECIMAL(15,2) NOT NULL,
  
  vendor_name VARCHAR(255),
  vendor_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  payment_method payment_method,
  payment_account_id UUID, -- References accounts table
  
  receipt_url TEXT,
  
  status VARCHAR(50) DEFAULT 'submitted', -- 'draft', 'submitted', 'approved', 'rejected', 'paid'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  notes TEXT,
  
  -- Accounting reference
  journal_entry_id UUID,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, expense_no)
);

-- ============================================================================
-- 10. ACCOUNTING MODULE (Double-Entry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  type account_type NOT NULL,
  subtype account_subtype NOT NULL,
  
  parent_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  
  -- Balances
  opening_balance DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  
  description TEXT,
  
  is_system BOOLEAN DEFAULT false, -- System accounts can't be deleted
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  
  entry_no VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  description TEXT NOT NULL,
  
  -- Reference to source transaction
  reference_type VARCHAR(50), -- 'sale', 'purchase', 'expense', 'rental', 'manual'
  reference_id UUID,
  
  total_debit DECIMAL(15,2) NOT NULL,
  total_credit DECIMAL(15,2) NOT NULL,
  
  is_posted BOOLEAN DEFAULT false,
  posted_at TIMESTAMPTZ,
  
  is_manual BOOLEAN DEFAULT false, -- Manual entries can be edited/deleted
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Validation: Debit must equal Credit
  CONSTRAINT debit_credit_balance CHECK (total_debit = total_credit),
  UNIQUE(company_id, entry_no)
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  account_name VARCHAR(255) NOT NULL, -- Denormalized
  
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Either debit or credit, not both
  CONSTRAINT debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
  )
);

-- ============================================================================
-- 11. PAYMENTS & RECEIPTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  
  payment_no VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  payment_type VARCHAR(50) NOT NULL, -- 'received', 'paid'
  
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name VARCHAR(255),
  
  amount DECIMAL(15,2) NOT NULL,
  
  payment_method payment_method NOT NULL,
  payment_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  
  -- Reference to transaction
  reference_type VARCHAR(50), -- 'sale', 'purchase', 'rental', 'expense', 'other'
  reference_id UUID,
  
  notes TEXT,
  
  -- Accounting reference
  journal_entry_id UUID,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, payment_no)
);

-- ============================================================================
-- 12. SETTINGS & CONFIGURATIONS (CRITICAL - MUST PERSIST)
-- ============================================================================

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  
  category VARCHAR(100), -- 'general', 'accounting', 'sales', 'purchases', 'pos', etc.
  description TEXT,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, key)
);

CREATE TABLE IF NOT EXISTS modules_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  module_name VARCHAR(100) NOT NULL, -- 'rentals', 'studio', 'accounting', 'expenses', etc.
  is_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, module_name)
);

CREATE TABLE IF NOT EXISTS document_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  
  document_type VARCHAR(50) NOT NULL, -- 'invoice', 'quotation', 'purchase', 'expense', etc.
  prefix VARCHAR(20) NOT NULL,
  current_number INTEGER DEFAULT 0,
  padding INTEGER DEFAULT 4, -- Number of digits (0001, 0002, etc.)
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, branch_id, document_type)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Companies & Branches
CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_branches_user ON user_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_default ON user_branches(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_roles_company ON roles(company_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role_id);

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_active ON contacts(company_id, is_active) WHERE is_active = true;

-- Products
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(company_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_variations_product ON product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_packings_product ON product_packings(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_no ON sales(company_id, invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- Purchases
CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_branch ON purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_po_no ON purchases(company_id, po_no);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(po_date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);

-- Rentals
CREATE INDEX IF NOT EXISTS idx_rentals_company ON rentals(company_id);
CREATE INDEX IF NOT EXISTS idx_rentals_customer ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_dates ON rentals(pickup_date, return_date);
CREATE INDEX IF NOT EXISTS idx_rental_items_rental ON rental_items(rental_id);

-- Studio
CREATE INDEX IF NOT EXISTS idx_studio_orders_company ON studio_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_studio_orders_customer ON studio_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_studio_orders_status ON studio_orders(status);
CREATE INDEX IF NOT EXISTS idx_job_cards_order ON job_cards(studio_order_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_worker ON job_cards(assigned_worker_id);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- Accounting
CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(company_id, code);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);

-- Settings
CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(company_id, category);
CREATE INDEX IF NOT EXISTS idx_modules_config_company ON modules_config(company_id);
CREATE INDEX IF NOT EXISTS idx_document_sequences_company ON document_sequences(company_id, document_type);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_branches_updated_at ON branches;
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_variations_updated_at ON product_variations;
CREATE TRIGGER update_product_variations_updated_at BEFORE UPDATE ON product_variations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_packings_updated_at ON product_packings;
CREATE TRIGGER update_product_packings_updated_at BEFORE UPDATE ON product_packings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchases_updated_at ON purchases;
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rentals_updated_at ON rentals;
CREATE TRIGGER update_rentals_updated_at BEFORE UPDATE ON rentals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_studio_orders_updated_at ON studio_orders;
CREATE TRIGGER update_studio_orders_updated_at BEFORE UPDATE ON studio_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workers_updated_at ON workers;
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_modules_config_updated_at ON modules_config;
CREATE TRIGGER update_modules_config_updated_at BEFORE UPDATE ON modules_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_sequences_updated_at ON document_sequences;
CREATE TRIGGER update_document_sequences_updated_at BEFORE UPDATE ON document_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE settings IS 'Key-value store for company settings. Values stored as JSONB for flexibility.';
COMMENT ON TABLE modules_config IS 'Module enable/disable configuration per company.';
COMMENT ON TABLE document_sequences IS 'Auto-numbering sequences for invoices, POs, expenses, etc.';
COMMENT ON COLUMN sale_items.packing_type IS 'Type of packing (e.g., "fabric", "wholesale")';
COMMENT ON COLUMN sale_items.packing_quantity IS 'Total quantity in packing unit (e.g., meters)';
COMMENT ON COLUMN sale_items.packing_unit IS 'Unit of packing (e.g., "meters", "boxes")';
COMMENT ON COLUMN sale_items.packing_details IS 'Detailed packing information (JSONB: boxes, meters, thaans, etc.)';
COMMENT ON COLUMN purchase_items.packing_type IS 'Type of packing (e.g., "fabric", "wholesale")';
COMMENT ON COLUMN purchase_items.packing_quantity IS 'Total quantity in packing unit (e.g., meters)';
COMMENT ON COLUMN purchase_items.packing_unit IS 'Unit of packing (e.g., "meters", "boxes")';
COMMENT ON COLUMN purchase_items.packing_details IS 'Detailed packing information (JSONB: boxes, meters, thaans, etc.)';

-- ============================================================================
-- END OF CLEAN SCHEMA
-- ============================================================================

COMMENT ON SCHEMA public IS 'Din Collection ERP - Clean Complete Database Schema v2.0.0';
