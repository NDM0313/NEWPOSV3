-- ============================================================================
-- Studio Orders Tables (Legacy) - Create if not exist
-- ============================================================================
-- Run in Supabase SQL Editor if Studio Dashboard shows "Loading..." or empty.
-- These tables are optional; Studio Dashboard also loads from sales (STD-*) 
-- via studio_productions. This migration ensures studio_orders path works.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE studio_status AS ENUM ('pending', 'in_progress', 'ready', 'delivered', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS studio_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  order_no VARCHAR(50) NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  customer_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  order_type VARCHAR(50),
  total_cost DECIMAL(15,2) DEFAULT 0,
  advance_paid DECIMAL(15,2) DEFAULT 0,
  balance_due DECIMAL(15,2) DEFAULT 0,
  delivery_date DATE,
  actual_delivery_date DATE,
  measurements JSONB,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS job_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_order_id UUID NOT NULL REFERENCES studio_orders(id) ON DELETE CASCADE,
  task_type VARCHAR(50),
  assigned_worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending',
  start_date DATE,
  end_date DATE,
  payment_amount DECIMAL(15,2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_orders_company ON studio_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_studio_orders_customer ON studio_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_studio_orders_status ON studio_orders(status);
CREATE INDEX IF NOT EXISTS idx_job_cards_order ON job_cards(studio_order_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_worker ON job_cards(assigned_worker_id);
