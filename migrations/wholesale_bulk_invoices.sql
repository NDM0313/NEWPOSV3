-- ============================================================================
-- WHOLESALE: bulk_invoices + bulk_invoice_items (Step 5 — Bulk Invoice)
-- ============================================================================
-- Flow: Select multiple packing lists → Generate Bulk Invoice → one invoice.
-- bulk_invoice_packing_lists links which packing lists are included.
-- Print via UnifiedSalesInvoiceView (invoice document built from bulk_invoice + items).
-- Safe to run multiple times.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bulk_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  customer_name VARCHAR(500) NOT NULL,
  invoice_no VARCHAR(100) NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft | final
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bulk_invoices_company_invoice_no ON bulk_invoices(company_id, invoice_no);
CREATE INDEX IF NOT EXISTS idx_bulk_invoices_company ON bulk_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_bulk_invoices_customer ON bulk_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_bulk_invoices_status ON bulk_invoices(status);
COMMENT ON TABLE bulk_invoices IS 'Wholesale: single invoice aggregating multiple packing lists. Print via UnifiedSalesInvoiceView.';

-- Which packing lists are included in this bulk invoice
CREATE TABLE IF NOT EXISTS bulk_invoice_packing_lists (
  bulk_invoice_id UUID NOT NULL REFERENCES bulk_invoices(id) ON DELETE CASCADE,
  packing_list_id UUID NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
  PRIMARY KEY (bulk_invoice_id, packing_list_id)
);

CREATE INDEX IF NOT EXISTS idx_bulk_invoice_pl_bi ON bulk_invoice_packing_lists(bulk_invoice_id);
CREATE INDEX IF NOT EXISTS idx_bulk_invoice_pl_pl ON bulk_invoice_packing_lists(packing_list_id);

-- Line items (from packing list items; prices from original sale when generating)
CREATE TABLE IF NOT EXISTS bulk_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_invoice_id UUID NOT NULL REFERENCES bulk_invoices(id) ON DELETE CASCADE,
  packing_list_id UUID NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_bulk_invoice_items_bulk_invoice ON bulk_invoice_items(bulk_invoice_id);
CREATE INDEX IF NOT EXISTS idx_bulk_invoice_items_packing_list ON bulk_invoice_items(packing_list_id);
COMMENT ON TABLE bulk_invoice_items IS 'Line items for bulk invoice (from packing lists; prices from sale at generation).';

-- RLS
ALTER TABLE bulk_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bulk_invoices_select ON bulk_invoices;
CREATE POLICY bulk_invoices_select ON bulk_invoices FOR SELECT
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS bulk_invoices_insert ON bulk_invoices;
CREATE POLICY bulk_invoices_insert ON bulk_invoices FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS bulk_invoices_update ON bulk_invoices;
CREATE POLICY bulk_invoices_update ON bulk_invoices FOR UPDATE
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS bulk_invoices_delete ON bulk_invoices;
CREATE POLICY bulk_invoices_delete ON bulk_invoices FOR DELETE
  USING (company_id = get_user_company_id());

ALTER TABLE bulk_invoice_packing_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bulk_invoice_pl_select ON bulk_invoice_packing_lists;
CREATE POLICY bulk_invoice_pl_select ON bulk_invoice_packing_lists FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM bulk_invoices bi WHERE bi.id = bulk_invoice_packing_lists.bulk_invoice_id AND bi.company_id = get_user_company_id())
  );

DROP POLICY IF EXISTS bulk_invoice_pl_insert ON bulk_invoice_packing_lists;
CREATE POLICY bulk_invoice_pl_insert ON bulk_invoice_packing_lists FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM bulk_invoices bi WHERE bi.id = bulk_invoice_packing_lists.bulk_invoice_id AND bi.company_id = get_user_company_id())
  );

DROP POLICY IF EXISTS bulk_invoice_pl_delete ON bulk_invoice_packing_lists;
CREATE POLICY bulk_invoice_pl_delete ON bulk_invoice_packing_lists FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM bulk_invoices bi WHERE bi.id = bulk_invoice_packing_lists.bulk_invoice_id AND bi.company_id = get_user_company_id())
  );

ALTER TABLE bulk_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bulk_invoice_items_select ON bulk_invoice_items;
CREATE POLICY bulk_invoice_items_select ON bulk_invoice_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM bulk_invoices bi WHERE bi.id = bulk_invoice_items.bulk_invoice_id AND bi.company_id = get_user_company_id())
  );

DROP POLICY IF EXISTS bulk_invoice_items_insert ON bulk_invoice_items;
CREATE POLICY bulk_invoice_items_insert ON bulk_invoice_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM bulk_invoices bi WHERE bi.id = bulk_invoice_items.bulk_invoice_id AND bi.company_id = get_user_company_id())
  );

DROP POLICY IF EXISTS bulk_invoice_items_update ON bulk_invoice_items;
CREATE POLICY bulk_invoice_items_update ON bulk_invoice_items FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM bulk_invoices bi WHERE bi.id = bulk_invoice_items.bulk_invoice_id AND bi.company_id = get_user_company_id())
  );

DROP POLICY IF EXISTS bulk_invoice_items_delete ON bulk_invoice_items;
CREATE POLICY bulk_invoice_items_delete ON bulk_invoice_items FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM bulk_invoices bi WHERE bi.id = bulk_invoice_items.bulk_invoice_id AND bi.company_id = get_user_company_id())
  );
