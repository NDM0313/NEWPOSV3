-- Add packing_type, packing_quantity, packing_unit to purchase_return_items
-- (packing_details was added in 32; service expects all packing columns like sale_return_items)

ALTER TABLE purchase_return_items 
ADD COLUMN IF NOT EXISTS packing_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_quantity DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS packing_unit VARCHAR(50);

COMMENT ON COLUMN purchase_return_items.packing_type IS 'Type of packing - preserved from original purchase item';
COMMENT ON COLUMN purchase_return_items.packing_quantity IS 'Total quantity in packing unit (e.g., meters) - preserved from original purchase';
COMMENT ON COLUMN purchase_return_items.packing_unit IS 'Unit of packing (e.g., "meters", "boxes") - preserved from original purchase';
