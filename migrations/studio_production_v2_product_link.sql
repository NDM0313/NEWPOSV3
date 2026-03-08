-- ============================================================================
-- STUDIO PRODUCTION V2 – MANUFACTURED PRODUCT LINK (Job Order → Product → SL)
-- ============================================================================
-- STD = Customer Order (no accounting). PRD = Production. Product = manufactured item. SL = Invoice.
-- Link production order to a product when "Create Product" is used; SL invoice then uses this product.
-- Run after: studio_production_v2_customer_invoice.sql
-- ============================================================================

ALTER TABLE studio_production_orders_v2
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_studio_production_orders_v2_product
  ON studio_production_orders_v2(product_id) WHERE product_id IS NOT NULL;

COMMENT ON COLUMN studio_production_orders_v2.product_id IS 'Manufactured product created from this production (Create Product). Used as line item when generating SL invoice.';
