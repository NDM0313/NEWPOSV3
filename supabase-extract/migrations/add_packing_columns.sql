-- ============================================================================
-- MIGRATION: Add Packing Columns to sale_items and purchase_items
-- ============================================================================
-- Date: January 2026
-- Purpose: Enable packing data persistence for Sales and Purchases
--
-- This migration adds packing-related columns to sale_items and purchase_items
-- tables to support fabric/wholesale packing information (thaans, meters, etc.)

-- Add packing columns to sale_items
ALTER TABLE sale_items 
ADD COLUMN IF NOT EXISTS packing_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_quantity DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS packing_unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_details JSONB;

-- Add packing columns to purchase_items
ALTER TABLE purchase_items 
ADD COLUMN IF NOT EXISTS packing_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_quantity DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS packing_unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_details JSONB;

-- Add comments for documentation
COMMENT ON COLUMN sale_items.packing_type IS 'Type of packing (e.g., "fabric", "wholesale")';
COMMENT ON COLUMN sale_items.packing_quantity IS 'Total quantity in packing unit (e.g., meters)';
COMMENT ON COLUMN sale_items.packing_unit IS 'Unit of packing (e.g., "meters", "boxes")';
COMMENT ON COLUMN sale_items.packing_details IS 'Detailed packing information (JSONB: boxes, meters, thaans, etc.)';

COMMENT ON COLUMN purchase_items.packing_type IS 'Type of packing (e.g., "fabric", "wholesale")';
COMMENT ON COLUMN purchase_items.packing_quantity IS 'Total quantity in packing unit (e.g., meters)';
COMMENT ON COLUMN purchase_items.packing_unit IS 'Unit of packing (e.g., "meters", "boxes")';
COMMENT ON COLUMN purchase_items.packing_details IS 'Detailed packing information (JSONB: boxes, meters, thaans, etc.)';
