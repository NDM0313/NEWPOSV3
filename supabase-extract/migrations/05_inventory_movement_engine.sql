-- ============================================================================
-- TASK 2: INVENTORY MOVEMENT ENGINE
-- ============================================================================
-- Purpose: Track all inventory movements with accounting integration
-- ============================================================================

-- Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL, -- 'purchase', 'sale', 'adjustment', 'transfer', 'return'
    quantity DECIMAL(15,2) NOT NULL, -- Positive for IN, Negative for OUT
    unit_cost DECIMAL(15,2) DEFAULT 0, -- Cost per unit at time of movement
    total_cost DECIMAL(15,2) DEFAULT 0, -- quantity * unit_cost
    reference_type VARCHAR(50), -- 'purchase', 'sale', 'expense', 'adjustment'
    reference_id UUID, -- ID of purchase/sale/adjustment
    source_location UUID REFERENCES branches(id) ON DELETE SET NULL,
    destination_location UUID REFERENCES branches(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for stock movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- ============================================================================
-- FUNCTION: Update Product Stock from Movement
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_stock_from_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Update product current_stock based on movement
    UPDATE products
    SET 
        current_stock = current_stock + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update product stock
DROP TRIGGER IF EXISTS trigger_update_stock_from_movement ON stock_movements;
CREATE TRIGGER trigger_update_stock_from_movement
    AFTER INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock_from_movement();

-- ============================================================================
-- FUNCTION: Get Product Stock Balance
-- ============================================================================

CREATE OR REPLACE FUNCTION get_product_stock_balance(
    p_product_id UUID,
    p_company_id UUID
)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_balance DECIMAL(15,2);
BEGIN
    SELECT COALESCE(SUM(quantity), 0) INTO v_balance
    FROM stock_movements
    WHERE product_id = p_product_id
    AND company_id = p_company_id;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;
