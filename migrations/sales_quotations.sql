-- ============================================================================
-- SALES: quotations + quotation_items (Step 6 — Quotation & Proforma)
-- ============================================================================
-- Flow: Create Quotation → Approve → Convert to Sale. Proforma = quotation in invoice format.
-- Safe to run multiple times.
-- ============================================================================

-- quotations
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  customer_name VARCHAR(500) NOT NULL,
  quotation_no VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft | sent | approved | rejected | converted
  valid_until DATE,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  converted_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_company_quotation_no ON quotations(company_id, quotation_no);
CREATE INDEX IF NOT EXISTS idx_quotations_company ON quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
COMMENT ON TABLE quotations IS 'Step 6: Quotations. Convert to sale when approved.';

-- quotation_items
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(500),
  sku VARCHAR(255),
  quantity NUMERIC(15,2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'pcs',
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);
COMMENT ON TABLE quotation_items IS 'Line items for a quotation.';

-- RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotations_select ON quotations;
CREATE POLICY quotations_select ON quotations FOR SELECT
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS quotations_insert ON quotations;
CREATE POLICY quotations_insert ON quotations FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS quotations_update ON quotations;
CREATE POLICY quotations_update ON quotations FOR UPDATE
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS quotations_delete ON quotations;
CREATE POLICY quotations_delete ON quotations FOR DELETE
  USING (company_id = get_user_company_id());

ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotation_items_select ON quotation_items;
CREATE POLICY quotation_items_select ON quotation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_items.quotation_id
        AND q.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS quotation_items_insert ON quotation_items;
CREATE POLICY quotation_items_insert ON quotation_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_items.quotation_id
        AND q.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS quotation_items_update ON quotation_items;
CREATE POLICY quotation_items_update ON quotation_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_items.quotation_id
        AND q.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS quotation_items_delete ON quotation_items;
CREATE POLICY quotation_items_delete ON quotation_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_items.quotation_id
        AND q.company_id = get_user_company_id()
    )
  );
