-- ============================================================================
-- SALE RETURNS MODULE (Separate entity — never modify original sale)
-- ============================================================================
-- Purpose: Sale Return as its own document. On finalize: stock IN + reversing
--          journal. Original sale is never edited. Audit safe.
-- ============================================================================

-- Sale Returns header
CREATE TABLE IF NOT EXISTS sale_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    original_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    return_no VARCHAR(100),
    return_date DATE NOT NULL,
    customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_sale_returns_company ON sale_returns(company_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_original_sale ON sale_returns(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_status ON sale_returns(status);
CREATE INDEX IF NOT EXISTS idx_sale_returns_date ON sale_returns(return_date DESC);

-- Sale Return Items (per-product, per-line return qty)
CREATE TABLE IF NOT EXISTS sale_return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_return_id UUID NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    sale_item_id UUID REFERENCES sale_items(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    quantity DECIMAL(15,2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'piece',
    unit_price DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items(sale_return_id);

-- Prevent deletion of a final sale if any sale return exists for it
CREATE OR REPLACE FUNCTION prevent_sale_delete_if_returns_exist()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM sale_returns WHERE original_sale_id = OLD.id AND status = 'final') THEN
        RAISE EXCEPTION 'Cannot delete sale: it has finalized sale return(s). Unfinal or remove returns first.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_sale_delete_if_returns ON sales;
CREATE TRIGGER trigger_prevent_sale_delete_if_returns
    BEFORE DELETE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION prevent_sale_delete_if_returns_exist();

-- ============================================================================
-- FUNCTION: Finalize Sale Return (stock IN + reversing journal entry)
-- ============================================================================
-- Validates: original sale is final; return qty per product ≤ sold qty.
-- Creates: stock_movements (positive qty, movement_type = 'sale_return'),
--          journal_entry (Dr Sales Return, Cr AR/Cash).
-- ============================================================================
CREATE OR REPLACE FUNCTION finalize_sale_return(
    p_sale_return_id UUID,
    p_company_id UUID,
    p_created_by UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_sale RECORD;
    v_item RECORD;
    v_sold_qty DECIMAL(15,2);
    v_returned_so_far DECIMAL(15,2);
    v_ar_account_id UUID;
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_sales_return_account_id UUID;
    v_payment_account_id UUID;
    v_journal_entry_id UUID;
    v_total_return_amount DECIMAL(15,2) := 0;
BEGIN
    SELECT * INTO v_return FROM sale_returns WHERE id = p_sale_return_id AND company_id = p_company_id;
    IF v_return.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Sale return not found');
    END IF;
    IF v_return.status = 'final' THEN
        RETURN json_build_object('success', false, 'error', 'Sale return already finalized');
    END IF;

    SELECT * INTO v_sale FROM sales WHERE id = v_return.original_sale_id AND company_id = p_company_id;
    IF v_sale.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Original sale not found');
    END IF;
    IF v_sale.status != 'final' THEN
        RETURN json_build_object('success', false, 'error', 'Sale return allowed only for final invoices. Original sale is not final.');
    END IF;

    -- Validate return qty ≤ sold qty per product (sum of sale_items for product)
    FOR v_item IN SELECT * FROM sale_return_items WHERE sale_return_id = p_sale_return_id
    LOOP
        SELECT COALESCE(SUM(quantity), 0) INTO v_sold_qty
        FROM sale_items
        WHERE sale_id = v_return.original_sale_id AND product_id = v_item.product_id
          AND (variation_id IS NOT DISTINCT FROM v_item.variation_id);
        IF v_item.quantity > v_sold_qty THEN
            RETURN json_build_object('success', false, 'error',
                format('Return qty (%s) exceeds sold qty (%s) for product %s', v_item.quantity, v_sold_qty, v_item.product_name));
        END IF;
        -- Optional: check total returned so far (from other finalized returns) + this return ≤ sold
        SELECT COALESCE(SUM(sri.quantity), 0) INTO v_returned_so_far
        FROM sale_return_items sri
        JOIN sale_returns sr ON sr.id = sri.sale_return_id AND sr.status = 'final'
        WHERE sr.original_sale_id = v_return.original_sale_id
          AND sri.product_id = v_item.product_id
          AND (sri.variation_id IS NOT DISTINCT FROM v_item.variation_id);
        IF v_returned_so_far + v_item.quantity > v_sold_qty THEN
            RETURN json_build_object('success', false, 'error',
                format('Total return qty would exceed sold qty for product %s', v_item.product_name));
        END IF;
    END LOOP;

    -- Accounts (Sales Return = often same as 4000 or a dedicated 4010; use 4000 if no 4010)
    SELECT id INTO v_sales_return_account_id FROM accounts WHERE company_id = p_company_id AND code = '4010' LIMIT 1;
    IF v_sales_return_account_id IS NULL THEN
        SELECT id INTO v_sales_return_account_id FROM accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1;
    END IF;
    SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = p_company_id AND code = '1010' LIMIT 1;

    -- 1) Stock movements: positive qty (stock IN), reference_type = 'sale_return'
    FOR v_item IN SELECT * FROM sale_return_items WHERE sale_return_id = p_sale_return_id
    LOOP
        INSERT INTO stock_movements (
            company_id, branch_id, product_id, movement_type, quantity,
            unit_cost, total_cost, reference_type, reference_id, notes, created_by
        )
        VALUES (
            p_company_id, v_return.branch_id, v_item.product_id,
            'sale_return',
            v_item.quantity,
            v_item.unit_price,
            v_item.total,
            'sale_return',
            p_sale_return_id,
            'Sale return: ' || COALESCE(v_return.return_no, v_return.id::TEXT) || ' - ' || v_item.product_name,
            p_created_by
        );
        v_total_return_amount := v_total_return_amount + v_item.total;
    END LOOP;

    -- 2) Journal: Dr Sales Return, Cr AR or Cr Cash/Bank (reverse of original sale)
    INSERT INTO journal_entries (
        company_id, branch_id, entry_no, entry_date, description,
        reference_type, reference_id, created_by
    )
    VALUES (
        p_company_id, v_return.branch_id,
        'SR-' || TO_CHAR(v_return.return_date, 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id AND entry_no LIKE 'SR-%')::TEXT, 4, '0'),
        v_return.return_date,
        'Sale Return: ' || COALESCE(v_return.return_no, p_sale_return_id::TEXT) || ' (Original: ' || v_sale.invoice_no || ')',
        'sale_return', p_sale_return_id, p_created_by
    )
    RETURNING id INTO v_journal_entry_id;

    -- Debit: Sales Return (expense/contra-revenue)
    IF v_sales_return_account_id IS NOT NULL THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_sales_return_account_id, v_return.total, 0, 'Sales Return');
    END IF;

    -- Credit: AR (if original was credit/unpaid) or Cash/Bank (if original was cash/bank paid)
    IF v_sale.paid_amount = 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_ar_account_id, 0, v_return.total, 'Credit AR - sale return');
    ELSE
        IF v_sale.payment_method = 'cash' THEN v_payment_account_id := v_cash_account_id; ELSE v_payment_account_id := v_bank_account_id; END IF;
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_entry_id, v_payment_account_id, 0, v_return.total, 'Credit Cash/Bank - sale return');
    END IF;

    -- 3) Mark sale return as final
    UPDATE sale_returns SET status = 'final', updated_at = NOW() WHERE id = p_sale_return_id;

    RETURN json_build_object(
        'success', true,
        'sale_return_id', p_sale_return_id,
        'journal_entry_id', v_journal_entry_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
