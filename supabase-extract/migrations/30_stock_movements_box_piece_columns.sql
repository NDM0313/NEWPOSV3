-- ============================================================================
-- Stock movements: box_change, piece_change for packing (real calculated boxes/pieces)
-- Inventory overview will SUM these per product/variation.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'box_change') THEN
    ALTER TABLE stock_movements ADD COLUMN box_change DECIMAL(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'piece_change') THEN
    ALTER TABLE stock_movements ADD COLUMN piece_change DECIMAL(15,2) DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN stock_movements.box_change IS 'Packing: net boxes from this movement (positive purchase, negative sale).';
COMMENT ON COLUMN stock_movements.piece_change IS 'Packing: net pieces from this movement (positive purchase, negative sale).';
