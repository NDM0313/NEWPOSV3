-- Store date + time for purchases and sales (was DATE, now TIMESTAMPTZ so time is preserved).
-- Run after 03_frontend_driven_schema. Existing DATE values become midnight in server time zone.

-- Purchases: po_date
ALTER TABLE purchases
  ALTER COLUMN po_date TYPE TIMESTAMPTZ
  USING (po_date::timestamp AT TIME ZONE 'UTC');

-- Sales: invoice_date
ALTER TABLE sales
  ALTER COLUMN invoice_date TYPE TIMESTAMPTZ
  USING (invoice_date::timestamp AT TIME ZONE 'UTC');
