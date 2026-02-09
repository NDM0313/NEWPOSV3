-- ============================================================================
-- ERP CORE: Products unit_id FK + Units table columns (single source of truth)
-- Rule: Product unit = unit_id (FK). Purchase/Sale item unit = short code from product or saved value.
-- ============================================================================

-- 1. Ensure units table exists (idempotent; may already exist from create_business or inventory_masters)
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  short_code VARCHAR(20),
  symbol VARCHAR(20),
  allow_decimal BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- 2. Add missing columns to units if table existed with older schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'short_code') THEN
    ALTER TABLE units ADD COLUMN short_code VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'allow_decimal') THEN
    ALTER TABLE units ADD COLUMN allow_decimal BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'is_default') THEN
    ALTER TABLE units ADD COLUMN is_default BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 3. products.unit_id FK (single source for product unit – edit dropdown maps here)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'unit_id') THEN
    ALTER TABLE products ADD COLUMN unit_id UUID REFERENCES units(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_units_company ON units(company_id);
CREATE INDEX IF NOT EXISTS idx_products_unit_id ON products(unit_id) WHERE unit_id IS NOT NULL;

COMMENT ON COLUMN products.unit_id IS 'FK to units – single source for Inventory/Purchase/Sale unit display (short_code).';
