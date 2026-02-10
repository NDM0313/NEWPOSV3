-- ============================================================================
-- MIGRATION: Add return_packing_details to sale_return_items and purchase_return_items
-- ============================================================================
-- Purpose: Store piece-level return packing selection separately from original packing
-- This allows users to explicitly select which pieces are returned
-- Original packing_details remains unchanged (reference only)

-- Add return_packing_details to sale_return_items
ALTER TABLE sale_return_items 
ADD COLUMN IF NOT EXISTS return_packing_details JSONB;

COMMENT ON COLUMN sale_return_items.return_packing_details IS 'Piece-level return packing selection (JSONB): { returned_pieces: [{ box_no, piece_no, meters }], returned_boxes, returned_pieces_count, returned_total_meters } - separate from original packing_details';

-- Add return_packing_details to purchase_return_items
ALTER TABLE purchase_return_items 
ADD COLUMN IF NOT EXISTS return_packing_details JSONB;

COMMENT ON COLUMN purchase_return_items.return_packing_details IS 'Piece-level return packing selection (JSONB): { returned_pieces: [{ box_no, piece_no, meters }], returned_boxes, returned_pieces_count, returned_total_meters } - separate from original packing_details';
