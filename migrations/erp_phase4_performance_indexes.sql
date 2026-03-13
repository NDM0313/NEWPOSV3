-- Phase 4 Performance: Required indexes per Master roadmap.
-- stock_movements(company_id, product_id), stock_movements(company_id, variation_id),
-- sales(company_id, created_at), purchases(company_id, created_at), journal_entries(company_id, created_at)

-- Stock movements: dashboard and inventory by company + product/variation
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_product
  ON stock_movements (company_id, product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_company_variation
  ON stock_movements (company_id, variation_id) WHERE variation_id IS NOT NULL;

-- Sales: recent list and dashboard by company + created_at
CREATE INDEX IF NOT EXISTS idx_sales_company_created_at
  ON sales (company_id, created_at DESC);

-- Purchases: recent list and dashboard by company + created_at
CREATE INDEX IF NOT EXISTS idx_purchases_company_created_at
  ON purchases (company_id, created_at DESC);

-- Journal entries: report and ledger by company + created_at
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_created_at
  ON journal_entries (company_id, created_at DESC);
