-- Add packing_details column to purchase_return_items table
-- This allows purchase returns to include packing information (boxes, pieces, meters)

ALTER TABLE purchase_return_items 
ADD COLUMN IF NOT EXISTS packing_details JSONB;

COMMENT ON COLUMN purchase_return_items.packing_details IS 'Packing details for returned items (boxes, pieces, meters) - JSONB format matching purchase_items.packing_details';
