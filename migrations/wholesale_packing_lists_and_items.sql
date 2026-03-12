-- ============================================================================
-- WHOLESALE: packing_lists + packing_list_items (Step 5 — Packing List Workflow)
-- ============================================================================
-- Flow: Sale → Generate Packing List → packing_lists row + packing_list_items
-- Print via UnifiedPackingListView.
-- Safe to run multiple times.
-- ============================================================================

-- packing_lists
CREATE TABLE IF NOT EXISTS packing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft | confirmed | shipped
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_packing_lists_company ON packing_lists(company_id);
CREATE INDEX IF NOT EXISTS idx_packing_lists_sale ON packing_lists(sale_id);
CREATE INDEX IF NOT EXISTS idx_packing_lists_status ON packing_lists(status);
COMMENT ON TABLE packing_lists IS 'Wholesale: packing list per sale. Print via UnifiedPackingListView.';

-- packing_list_items
CREATE TABLE IF NOT EXISTS packing_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_list_id UUID NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(500),  -- denormalized for display/print
  sku VARCHAR(255),
  pieces NUMERIC(15,2) NOT NULL DEFAULT 0,
  cartons NUMERIC(15,2) NOT NULL DEFAULT 0,
  weight VARCHAR(100),  -- e.g. "12.5 kg" or "0.5"
  sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_packing_list_items_packing_list ON packing_list_items(packing_list_id);
COMMENT ON TABLE packing_list_items IS 'Line items for a packing list (product, pieces, cartons, weight).';

-- RLS
ALTER TABLE packing_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS packing_lists_select ON packing_lists;
CREATE POLICY packing_lists_select ON packing_lists FOR SELECT
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS packing_lists_insert ON packing_lists;
CREATE POLICY packing_lists_insert ON packing_lists FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS packing_lists_update ON packing_lists;
CREATE POLICY packing_lists_update ON packing_lists FOR UPDATE
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS packing_lists_delete ON packing_lists;
CREATE POLICY packing_lists_delete ON packing_lists FOR DELETE
  USING (company_id = get_user_company_id());

-- packing_list_items: access via packing_list's company
ALTER TABLE packing_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS packing_list_items_select ON packing_list_items;
CREATE POLICY packing_list_items_select ON packing_list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM packing_lists pl
      WHERE pl.id = packing_list_items.packing_list_id
        AND pl.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS packing_list_items_insert ON packing_list_items;
CREATE POLICY packing_list_items_insert ON packing_list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM packing_lists pl
      WHERE pl.id = packing_list_items.packing_list_id
        AND pl.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS packing_list_items_update ON packing_list_items;
CREATE POLICY packing_list_items_update ON packing_list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM packing_lists pl
      WHERE pl.id = packing_list_items.packing_list_id
        AND pl.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS packing_list_items_delete ON packing_list_items;
CREATE POLICY packing_list_items_delete ON packing_list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM packing_lists pl
      WHERE pl.id = packing_list_items.packing_list_id
        AND pl.company_id = get_user_company_id()
    )
  );
