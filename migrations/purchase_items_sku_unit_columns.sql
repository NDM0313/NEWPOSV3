-- Ensure purchase_items has sku and unit (some schemas only have product_name, quantity, unit_price, discount, tax, total, packing_*, notes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_items' AND column_name = 'sku') THEN
    ALTER TABLE public.purchase_items ADD COLUMN sku VARCHAR(100) DEFAULT 'N/A';
    RAISE NOTICE 'Added purchase_items.sku.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_items' AND column_name = 'unit') THEN
    ALTER TABLE public.purchase_items ADD COLUMN unit VARCHAR(50) DEFAULT 'pcs';
    RAISE NOTICE 'Added purchase_items.unit.';
  END IF;
END $$;
