-- ============================================================================
-- Add variation_id to stock_movements and FK to product_variations
-- So Supabase schema cache has the relationship for embedded selects (optional).
-- App already fetches variations separately if this FK is missing.
-- ============================================================================

-- Add column if not present (e.g. tables created from 05_inventory_movement_engine)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'variation_id'
  ) THEN
    ALTER TABLE stock_movements
    ADD COLUMN variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_movements_variation ON stock_movements(variation_id) WHERE variation_id IS NOT NULL;
