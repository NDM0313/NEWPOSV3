-- Final Web ERP: performance indexes for dashboard and list/detail queries.
-- Run after manufacturing, shipping, report_performance_indexes.
-- All CREATE INDEX IF NOT EXISTS are idempotent.

-- sales_items: join by sale_id (sale detail, invoice document, dashboard aggregates)
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id
  ON sales_items (sale_id);

-- sales: compound for dashboard "recent sales by company" (invoice_date is primary filter)
-- idx_sales_company_date already in shipping_accounting_full_integration.sql; ensure exists
CREATE INDEX IF NOT EXISTS idx_sales_company_date
  ON sales (company_id, invoice_date DESC);

-- production_orders: list by company and status (manufacturing dashboard)
-- Only create if table exists (manufacturing_bom_production_orders_steps.sql may not be applied yet).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'production_orders'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_production_orders_company_status
      ON production_orders (company_id, status);
  END IF;
END $$;
