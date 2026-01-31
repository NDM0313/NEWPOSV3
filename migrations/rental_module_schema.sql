-- ============================================================================
-- RENTAL MODULE – FULL ERP SCHEMA (Sale/Purchase Standard)
-- ============================================================================
-- Tables: rentals, rental_items, rental_payments
-- rental_no: AUTO SEQUENCE (trigger), never manual
-- Status: draft | rented | returned | overdue | cancelled
-- Inventory: stock_movements movement_type = 'rental_out' | 'rental_in'
-- ============================================================================

-- Sequence for rental_no (global; optional: per-company via table)
CREATE SEQUENCE IF NOT EXISTS rental_no_seq START 1;

-- ----------------------------------------------------------------------------
-- 1. rentals
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  rental_no VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  expected_return_date DATE NOT NULL,
  actual_return_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'rented', 'returned', 'overdue', 'cancelled')),
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  due_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentals_company ON rentals(company_id);
CREATE INDEX IF NOT EXISTS idx_rentals_branch ON rentals(branch_id);
CREATE INDEX IF NOT EXISTS idx_rentals_customer ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_dates ON rentals(start_date, expected_return_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rentals_rental_no ON rentals(rental_no);

COMMENT ON TABLE rentals IS 'Rental orders. rental_no is set by trigger (AUTO).';
COMMENT ON COLUMN rentals.status IS 'draft | rented | returned | overdue | cancelled';

-- Trigger: set rental_no on INSERT if null (AUTO SEQUENCE – never manual)
CREATE OR REPLACE FUNCTION set_rental_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rental_no IS NULL OR NEW.rental_no = '' THEN
    NEW.rental_no := 'RN-' || LPAD(nextval('rental_no_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_rental_no ON rentals;
CREATE TRIGGER trigger_set_rental_no
  BEFORE INSERT ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION set_rental_no();

-- updated_at trigger (use existing helper if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_rentals_updated_at ON rentals;
    CREATE TRIGGER update_rentals_updated_at BEFORE UPDATE ON rentals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. rental_items
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rental_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255),
  sku VARCHAR(100),
  quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
  unit VARCHAR(50) DEFAULT 'piece',
  boxes DECIMAL(15,2),
  pieces DECIMAL(15,2),
  packing_details JSONB,
  rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_items_rental ON rental_items(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_items_product ON rental_items(product_id);

COMMENT ON COLUMN rental_items.rate IS 'Rental rate per day or per unit as per business rule.';

-- ----------------------------------------------------------------------------
-- 3. rental_payments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rental_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  method VARCHAR(50) DEFAULT 'cash',
  reference VARCHAR(255),
  payment_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_payments_rental ON rental_payments(rental_id);

-- ----------------------------------------------------------------------------
-- 4. stock_movements – rental_out / rental_in (no schema change; movement_type is VARCHAR(50))
-- Use movement_type = 'rental_out' (quantity negative) and 'rental_in' (quantity positive).
-- Application layer must insert these when status → rented and status → returned.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 5. activity_logs – entity_type = 'rental' (if activity_logs table exists)
-- Ensure activity_log service accepts module = 'rental'. No schema change here.
-- ----------------------------------------------------------------------------
