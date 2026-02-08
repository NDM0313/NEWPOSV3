-- ============================================================================
-- PRODUCT COMBOS TABLES
-- ============================================================================
-- Purpose: Support product bundles/combos (virtual bundles)
-- Model: Virtual Bundle - Combo product does NOT hold stock
-- Stock: Deducted from component products on sale
-- ============================================================================

-- ============================================================================
-- 1. PRODUCT_COMBOS TABLE
-- ============================================================================
-- Stores combo/bundle definitions
-- combo_product_id = the product that acts as the bundle/combo
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_combos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  combo_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  combo_name TEXT NOT NULL,
  combo_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT product_combos_company_id_check CHECK (company_id IS NOT NULL),
  CONSTRAINT product_combos_combo_product_id_check CHECK (combo_product_id IS NOT NULL),
  CONSTRAINT product_combos_combo_name_check CHECK (combo_name IS NOT NULL AND combo_name != ''),
  CONSTRAINT product_combos_combo_price_check CHECK (combo_price >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_combos_company_id ON product_combos(company_id);
CREATE INDEX IF NOT EXISTS idx_product_combos_combo_product_id ON product_combos(combo_product_id);
CREATE INDEX IF NOT EXISTS idx_product_combos_is_active ON product_combos(is_active);

-- ============================================================================
-- 2. PRODUCT_COMBO_ITEMS TABLE
-- ============================================================================
-- Stores items/components within each combo
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_combo_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  combo_id UUID NOT NULL REFERENCES product_combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  qty DECIMAL(15,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2), -- Optional: for costing breakdown/display
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT product_combo_items_company_id_check CHECK (company_id IS NOT NULL),
  CONSTRAINT product_combo_items_combo_id_check CHECK (combo_id IS NOT NULL),
  CONSTRAINT product_combo_items_product_id_check CHECK (product_id IS NOT NULL),
  CONSTRAINT product_combo_items_qty_check CHECK (qty > 0),
  CONSTRAINT product_combo_items_unit_price_check CHECK (unit_price IS NULL OR unit_price >= 0),
  
  -- Unique constraint: prevent duplicate items in same combo
  CONSTRAINT product_combo_items_unique UNIQUE (combo_id, product_id, variation_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_combo_items_company_id ON product_combo_items(company_id);
CREATE INDEX IF NOT EXISTS idx_product_combo_items_combo_id ON product_combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_product_combo_items_product_id ON product_combo_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_combo_items_variation_id ON product_combo_items(variation_id);

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_combo_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_combos
CREATE POLICY "Users can view combos for their company"
  ON product_combos FOR SELECT
  USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert combos for their company"
  ON product_combos FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update combos for their company"
  ON product_combos FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete combos for their company"
  ON product_combos FOR DELETE
  USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- RLS Policies for product_combo_items
CREATE POLICY "Users can view combo items for their company"
  ON product_combo_items FOR SELECT
  USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert combo items for their company"
  ON product_combo_items FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update combo items for their company"
  ON product_combo_items FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete combo items for their company"
  ON product_combo_items FOR DELETE
  USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_combos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_combos_updated_at
  BEFORE UPDATE ON product_combos
  FOR EACH ROW
  EXECUTE FUNCTION update_product_combos_updated_at();

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to get combo items with product details
CREATE OR REPLACE FUNCTION get_combo_items(p_combo_id UUID)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  product_name TEXT,
  variation_id UUID,
  variation_sku TEXT,
  qty DECIMAL(15,2),
  unit_price DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pci.id,
    pci.product_id,
    p.name AS product_name,
    pci.variation_id,
    pv.sku AS variation_sku,
    pci.qty,
    pci.unit_price
  FROM product_combo_items pci
  JOIN products p ON p.id = pci.product_id
  LEFT JOIN product_variations pv ON pv.id = pci.variation_id
  WHERE pci.combo_id = p_combo_id
  ORDER BY p.name, pv.sku;
END;
$$ LANGUAGE plpgsql;

-- Function to check if product is a combo
CREATE OR REPLACE FUNCTION is_combo_product(p_product_id UUID, p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM product_combos
    WHERE combo_product_id = p_product_id
    AND company_id = p_company_id
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get combo_id for a product
CREATE OR REPLACE FUNCTION get_combo_id_for_product(p_product_id UUID, p_company_id UUID)
RETURNS UUID AS $$
DECLARE
  v_combo_id UUID;
BEGIN
  SELECT id INTO v_combo_id
  FROM product_combos
  WHERE combo_product_id = p_product_id
  AND company_id = p_company_id
  AND is_active = true
  LIMIT 1;
  
  RETURN v_combo_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE product_combos IS 'Product combo/bundle definitions. Combo product acts as virtual bundle - does NOT hold stock.';
COMMENT ON TABLE product_combo_items IS 'Items/components within each combo. Stock is deducted from these products on sale.';
COMMENT ON COLUMN product_combos.combo_product_id IS 'The product that acts as the bundle/combo (virtual - no stock)';
COMMENT ON COLUMN product_combo_items.qty IS 'Quantity of this component product in the combo';
COMMENT ON COLUMN product_combo_items.unit_price IS 'Optional: unit price for costing breakdown/display';
