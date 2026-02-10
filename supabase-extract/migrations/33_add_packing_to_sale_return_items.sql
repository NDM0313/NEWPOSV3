-- ============================================================================
-- MIGRATION: Add Packing Columns to sale_return_items
-- ============================================================================
-- Purpose: Preserve unit/packing structure from original sale items
-- This ensures returns maintain the same box/piece breakdown as the original sale

-- Add packing columns to sale_return_items
ALTER TABLE sale_return_items 
ADD COLUMN IF NOT EXISTS packing_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_quantity DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS packing_unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_details JSONB;

-- Add comments for documentation
COMMENT ON COLUMN sale_return_items.packing_type IS 'Type of packing (e.g., "fabric", "wholesale") - preserved from original sale';
COMMENT ON COLUMN sale_return_items.packing_quantity IS 'Total quantity in packing unit (e.g., meters) - preserved from original sale';
COMMENT ON COLUMN sale_return_items.packing_unit IS 'Unit of packing (e.g., "meters", "boxes") - preserved from original sale';
COMMENT ON COLUMN sale_return_items.packing_details IS 'Detailed packing information (JSONB: boxes, pieces, meters) - preserved from original sale';
