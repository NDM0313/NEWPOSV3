-- ============================================================================
-- PURCHASE RETURNS MODULE (Mirror of Sale Returns – FINAL when saved)
-- ============================================================================
-- Purpose: Purchase Return as its own document. On finalize: stock OUT,
--          supplier ledger CREDIT (reduces payable). No edits after creation.
-- ============================================================================

-- Purchase Returns header
CREATE TABLE IF NOT EXISTS purchase_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    original_purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
    return_no VARCHAR(100),
    return_date DATE NOT NULL,
    supplier_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) NOT NULL DEFAULT 0,
    reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_company ON purchase_returns(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_original_purchase ON purchase_returns(original_purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_status ON purchase_returns(status);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON purchase_returns(return_date DESC);

-- Purchase Return Items
CREATE TABLE IF NOT EXISTS purchase_return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    purchase_item_id UUID REFERENCES purchase_items(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    quantity DECIMAL(15,2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'pcs',
    unit_price DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(purchase_return_id);

-- Prevent deletion of a final purchase if any purchase return exists for it
CREATE OR REPLACE FUNCTION prevent_purchase_delete_if_returns_exist()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM purchase_returns WHERE original_purchase_id = OLD.id AND status = 'final') THEN
        RAISE EXCEPTION 'Cannot delete purchase: it has finalized purchase return(s). Remove returns first.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_purchase_delete_if_returns ON purchases;
CREATE TRIGGER trigger_prevent_purchase_delete_if_returns
    BEFORE DELETE ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION prevent_purchase_delete_if_returns_exist();
