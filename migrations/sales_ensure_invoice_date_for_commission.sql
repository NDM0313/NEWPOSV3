-- Ensure sales has invoice_date for commission report and other modules.
-- If only sale_date exists, add invoice_date and backfill; then use invoice_date everywhere.
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'invoice_date'
  ) THEN
    ALTER TABLE sales ADD COLUMN invoice_date DATE;
    UPDATE sales SET invoice_date = sale_date WHERE sale_date IS NOT NULL;
    UPDATE sales SET invoice_date = created_at::date WHERE invoice_date IS NULL AND created_at IS NOT NULL;
    UPDATE sales SET invoice_date = CURRENT_DATE WHERE invoice_date IS NULL;
    CREATE INDEX IF NOT EXISTS idx_sales_invoice_date ON sales(invoice_date);
    COMMENT ON COLUMN sales.invoice_date IS 'Invoice/sale date; used by commission report and filters. Synced from sale_date if added by migration.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'sale_date'
  ) THEN
    -- Backfill invoice_date from sale_date where null
    UPDATE sales SET invoice_date = sale_date WHERE invoice_date IS NULL AND sale_date IS NOT NULL;
  END IF;
END $$;
