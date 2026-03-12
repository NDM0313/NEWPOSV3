-- ============================================================================
-- STUDIO PRODUCTION V2 – MANUFACTURED PRODUCT LINK (Job Order → Product → SL)
-- ============================================================================
-- Safe when studio_production_orders_v2 does not exist yet (runs before studio_production_v2_tables).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_orders_v2') THEN
    ALTER TABLE studio_production_orders_v2
      ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v2_product
      ON studio_production_orders_v2(product_id) WHERE product_id IS NOT NULL;
    COMMENT ON COLUMN studio_production_orders_v2.product_id IS 'Manufactured product created from this production (Create Product). Used as line item when generating SL invoice.';
  END IF;
END $$;
