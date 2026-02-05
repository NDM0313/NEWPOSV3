-- ============================================================================
-- INVENTORY MASTERS: Units, Brands (Phase 1)
-- Categories/Sub-Categories = product_categories (parent_id NULL = Category, set = Sub-Category)
-- Products get optional brand_id, optional unit_id (required in UI later).
-- ============================================================================

-- 1. Units (global per company: Piece, Meter, Yard, Kg, etc.)
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_units_company ON units(company_id);
CREATE INDEX IF NOT EXISTS idx_units_active ON units(company_id, is_active) WHERE is_active = true;

COMMENT ON TABLE units IS 'Inventory units per company (Piece, Meter, Yard, Kg).';

-- 2. Brands (independent: Nike, Local, Studio Brand)
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_brands_company ON brands(company_id);
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(company_id, is_active) WHERE is_active = true;

COMMENT ON TABLE brands IS 'Product brands per company.';

-- 3. product_categories: ensure parent_id exists (Category = parent_id NULL, Sub-Category = parent_id = category.id)
-- Already in schema; ensure column exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_categories' AND column_name = 'parent_id') THEN
    ALTER TABLE product_categories ADD COLUMN parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. products: add brand_id, unit_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'brand_id') THEN
    ALTER TABLE products ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'unit_id') THEN
    ALTER TABLE products ADD COLUMN unit_id UUID REFERENCES units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS (allow authenticated users in same company)
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "units_company" ON units;
CREATE POLICY "units_company" ON units FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "brands_company" ON brands;
CREATE POLICY "brands_company" ON brands FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);
