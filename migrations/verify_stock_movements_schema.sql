-- PART 7: Verify/Update stock_movements table schema
-- This migration ensures the stock_movements table has all required columns
-- Run this in Supabase SQL Editor to verify/update the schema

-- Check if table exists, create if not
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  branch_id UUID,
  location_id UUID,
  product_id UUID NOT NULL,
  variation_id UUID,
  movement_type TEXT CHECK (
    movement_type IN ('PURCHASE','SALE','RETURN','ADJUSTMENT','TRANSFER','SELL_RETURN','PURCHASE_RETURN','RENTAL_OUT','RENTAL_RETURN')
  ),
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_id ON stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_id ON stock_movements(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_variation_id ON stock_movements(variation_id) WHERE variation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE stock_movements IS 'Tracks all stock movements (purchases, sales, returns, adjustments, transfers)';
COMMENT ON COLUMN stock_movements.movement_type IS 'Type of movement: PURCHASE, SALE, RETURN, ADJUSTMENT, TRANSFER, etc.';
COMMENT ON COLUMN stock_movements.quantity IS 'Quantity change (positive for IN, negative for OUT)';
COMMENT ON COLUMN stock_movements.reference_type IS 'Type of reference (sale, purchase, adjustment, etc.)';
COMMENT ON COLUMN stock_movements.reference_id IS 'ID of the reference record (sale_id, purchase_id, etc.)';

-- Verify table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'stock_movements'
ORDER BY ordinal_position;
