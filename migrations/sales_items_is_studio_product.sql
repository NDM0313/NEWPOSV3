-- sales_items.is_studio_product: marks the auto-generated studio product line.
-- Material items (fabric, lace, lining, etc.) = false or null.
-- Exactly one line per studio sale must have is_studio_product = true for pricing sync.

ALTER TABLE sales_items
  ADD COLUMN IF NOT EXISTS is_studio_product BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN sales_items.is_studio_product IS 'True only for the generated studio product line (Studio – STD-xxxx). Sync updates only this line; material lines are never updated.';

-- Optional: add to sale_items if that table is still used for backward compatibility
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'is_studio_product') THEN
      ALTER TABLE sale_items ADD COLUMN is_studio_product BOOLEAN NOT NULL DEFAULT false;
    END IF;
  END IF;
END $$;
