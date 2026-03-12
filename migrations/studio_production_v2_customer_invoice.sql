-- ============================================================================
-- STUDIO PRODUCTION V2 – CUSTOMER INVOICE (Safe Zone)
-- ============================================================================
-- Extend V2 orders with customer billing. Link generated sale to production.
-- Optional: add source/source_id on sales for traceability.
-- Safe when studio_production_orders_v2 does not exist yet (runs before studio_production_v2_tables).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_orders_v2') THEN
    ALTER TABLE studio_production_orders_v2
      ADD COLUMN IF NOT EXISTS customer_invoice_generated BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE studio_production_orders_v2
      ADD COLUMN IF NOT EXISTS generated_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v2_generated_sale
      ON studio_production_orders_v2(generated_sale_id) WHERE generated_sale_id IS NOT NULL;
    COMMENT ON COLUMN studio_production_orders_v2.customer_invoice_generated IS 'True when a customer sale invoice has been generated from this production.';
    COMMENT ON COLUMN studio_production_orders_v2.generated_sale_id IS 'Sale (invoice) created from this production for customer billing.';
  END IF;
END $$;

-- 2. Sales: optional source tracking (for studio_production generated invoices)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS source VARCHAR(50);

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE INDEX IF NOT EXISTS idx_sales_source ON sales(source, source_id) WHERE source IS NOT NULL;

COMMENT ON COLUMN sales.source IS 'Origin e.g. studio_production, pos. Null = regular sale.';
COMMENT ON COLUMN sales.source_id IS 'ID of source record (e.g. studio_production_orders_v2.id).';
