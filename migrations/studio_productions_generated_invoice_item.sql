-- ============================================================================
-- STUDIO PRODUCTIONS: track generated product and invoice item
-- ============================================================================
-- When the studio invoice line is generated (e.g. Create Product + Add to Sale),
-- store generated_product_id and generated_invoice_item_id so pricing sync
-- updates ONLY that item, never the original fabric/product line.
-- ============================================================================

-- Add columns to studio_productions (V2)
ALTER TABLE studio_productions
  ADD COLUMN IF NOT EXISTS generated_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE studio_productions
  ADD COLUMN IF NOT EXISTS generated_invoice_item_id UUID;

COMMENT ON COLUMN studio_productions.generated_product_id IS 'Product created for this studio order (invoice line product).';
COMMENT ON COLUMN studio_productions.generated_invoice_item_id IS 'sales_items.id of the generated studio line. Pricing sync updates only this item.';
