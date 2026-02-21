-- ============================================================================
-- DIN COLLECTION ERP - DATABASE FUNCTIONS & TRIGGERS
-- Version: 1.0.0
-- Date: January 18, 2026
-- Description: Business logic functions and automated triggers
-- ============================================================================

-- ============================================================================
-- 1. DOCUMENT NUMBER GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_document_number(
  p_company_id UUID,
  p_branch_id UUID,
  p_document_type VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_current_number INTEGER;
  v_padding INTEGER;
  v_new_number VARCHAR;
BEGIN
  -- Get or create sequence
  INSERT INTO document_sequences (company_id, branch_id, document_type, prefix, current_number, padding)
  VALUES (
    p_company_id,
    p_branch_id,
    p_document_type,
    CASE p_document_type
      WHEN 'sale' THEN 'INV-'
      WHEN 'purchase' THEN 'PO-'
      WHEN 'expense' THEN 'EXP-'
      WHEN 'rental' THEN 'RNT-'
      WHEN 'studio' THEN 'STU-'
      WHEN 'journal' THEN 'JE-'
      WHEN 'payment' THEN 'PMT-'
      WHEN 'receipt' THEN 'RCP-'
      WHEN 'product' THEN 'PRD-'
      ELSE 'DOC-'
    END,
    0,
    4
  )
  ON CONFLICT (company_id, branch_id, document_type)
  DO UPDATE SET current_number = document_sequences.current_number + 1
  RETURNING prefix, current_number, padding INTO v_prefix, v_current_number, v_padding;

  -- Format number with padding
  v_new_number := v_prefix || LPAD(v_current_number::TEXT, v_padding, '0');
  
  RETURN v_new_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. AUTO-SET DOCUMENT NUMBERS
-- ============================================================================

-- Sales invoice number
CREATE OR REPLACE FUNCTION set_sale_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    NEW.invoice_no := get_next_document_number(NEW.company_id, NEW.branch_id, 'sale');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_sale_invoice_number
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_invoice_number();

-- Purchase PO number
CREATE OR REPLACE FUNCTION set_purchase_po_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_no IS NULL OR NEW.po_no = '' THEN
    NEW.po_no := get_next_document_number(NEW.company_id, NEW.branch_id, 'purchase');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_purchase_po_number
  BEFORE INSERT ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION set_purchase_po_number();

-- Expense number
CREATE OR REPLACE FUNCTION set_expense_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expense_no IS NULL OR NEW.expense_no = '' THEN
    NEW.expense_no := get_next_document_number(NEW.company_id, NEW.branch_id, 'expense');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_expense_number
  BEFORE INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_expense_number();

-- Rental booking number
CREATE OR REPLACE FUNCTION set_rental_booking_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_no IS NULL OR NEW.booking_no = '' THEN
    NEW.booking_no := get_next_document_number(NEW.company_id, NEW.branch_id, 'rental');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_rental_booking_number
  BEFORE INSERT ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION set_rental_booking_number();

-- ============================================================================
-- 3. CALCULATE TOTALS (Sales)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_sale_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(15,2);
BEGIN
  -- Calculate subtotal from items
  SELECT COALESCE(SUM(total), 0)
  INTO v_subtotal
  FROM sale_items
  WHERE sale_id = NEW.id;

  -- Update sale totals
  UPDATE sales SET
    subtotal = v_subtotal,
    discount_amount = CASE
      WHEN discount_percentage > 0 THEN ROUND(v_subtotal * discount_percentage / 100, 2)
      ELSE discount_amount
    END,
    tax_amount = CASE
      WHEN tax_percentage > 0 THEN ROUND((v_subtotal - discount_amount) * tax_percentage / 100, 2)
      ELSE tax_amount
    END,
    total = v_subtotal - discount_amount + tax_amount + shipping_charges,
    due_amount = total - paid_amount,
    payment_status = CASE
      WHEN paid_amount = 0 THEN 'unpaid'::payment_status
      WHEN paid_amount >= total THEN 'paid'::payment_status
      ELSE 'partial'::payment_status
    END
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_sale_totals
  AFTER INSERT OR UPDATE ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_totals();

-- ============================================================================
-- 4. CALCULATE TOTALS (Purchases)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_purchase_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(total), 0)
  INTO v_subtotal
  FROM purchase_items
  WHERE purchase_id = NEW.id;

  UPDATE purchases SET
    subtotal = v_subtotal,
    discount_amount = CASE
      WHEN discount_percentage > 0 THEN ROUND(v_subtotal * discount_percentage / 100, 2)
      ELSE discount_amount
    END,
    tax_amount = CASE
      WHEN tax_percentage > 0 THEN ROUND((v_subtotal - discount_amount) * tax_percentage / 100, 2)
      ELSE tax_amount
    END,
    total = v_subtotal - discount_amount + tax_amount + shipping_charges,
    due_amount = total - paid_amount,
    payment_status = CASE
      WHEN paid_amount = 0 THEN 'unpaid'::payment_status
      WHEN paid_amount >= total THEN 'paid'::payment_status
      ELSE 'partial'::payment_status
    END
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_purchase_totals
  AFTER INSERT OR UPDATE ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_purchase_totals();

-- ============================================================================
-- 5. UPDATE STOCK ON SALE (When status = final)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Only update stock when status changes to 'final'
  IF NEW.status = 'final' AND (OLD.status IS NULL OR OLD.status != 'final') THEN
    
    -- Loop through all sale items
    FOR v_item IN
      SELECT * FROM sale_items WHERE sale_id = NEW.id
    LOOP
      -- Reduce stock
      UPDATE products
      SET current_stock = current_stock - v_item.quantity
      WHERE id = v_item.product_id;

      -- If variation exists, reduce variation stock too
      IF v_item.variation_id IS NOT NULL THEN
        UPDATE product_variations
        SET current_stock = current_stock - v_item.quantity
        WHERE id = v_item.variation_id;
      END IF;

      -- Record stock movement
      INSERT INTO stock_movements (
        company_id,
        branch_id,
        product_id,
        variation_id,
        type,
        quantity,
        unit_cost,
        total_cost,
        balance_qty,
        reference_type,
        reference_id,
        created_by
      )
      SELECT
        NEW.company_id,
        NEW.branch_id,
        v_item.product_id,
        v_item.variation_id,
        'sale',
        -v_item.quantity, -- Negative for stock OUT
        v_item.unit_price,
        -v_item.total,
        (SELECT current_stock FROM products WHERE id = v_item.product_id),
        'sale',
        NEW.id,
        NEW.created_by;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_sale
  AFTER INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_sale();

-- ============================================================================
-- 6. UPDATE STOCK ON PURCHASE (When status = final)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_stock_on_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.status = 'final' AND (OLD.status IS NULL OR OLD.status != 'final') THEN
    
    FOR v_item IN
      SELECT * FROM purchase_items WHERE purchase_id = NEW.id
    LOOP
      -- Increase stock
      UPDATE products
      SET current_stock = current_stock + v_item.quantity
      WHERE id = v_item.product_id;

      IF v_item.variation_id IS NOT NULL THEN
        UPDATE product_variations
        SET current_stock = current_stock + v_item.quantity
        WHERE id = v_item.variation_id;
      END IF;

      -- Record stock movement
      INSERT INTO stock_movements (
        company_id,
        branch_id,
        product_id,
        variation_id,
        type,
        quantity,
        unit_cost,
        total_cost,
        balance_qty,
        reference_type,
        reference_id,
        created_by
      )
      SELECT
        NEW.company_id,
        NEW.branch_id,
        v_item.product_id,
        v_item.variation_id,
        'purchase',
        v_item.quantity, -- Positive for stock IN
        v_item.unit_price,
        v_item.total,
        (SELECT current_stock FROM products WHERE id = v_item.product_id),
        'purchase',
        NEW.id,
        NEW.created_by;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_purchase
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_purchase();

-- ============================================================================
-- 7. UPDATE CONTACT BALANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_contact_balance_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'final' THEN
    -- Increase customer's receivable (what they owe us)
    UPDATE contacts
    SET current_balance = current_balance + NEW.due_amount
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_balance_on_sale
  AFTER INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_balance_on_sale();

CREATE OR REPLACE FUNCTION update_contact_balance_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'final' THEN
    -- Increase supplier's payable (what we owe them)
    UPDATE contacts
    SET current_balance = current_balance - NEW.due_amount
    WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_balance_on_purchase
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_balance_on_purchase();

-- ============================================================================
-- 8. AUTO-POST TO ACCOUNTING (Sales)
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_post_sale_to_accounting()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_id UUID;
  v_cash_account_id UUID;
  v_sales_account_id UUID;
  v_ar_account_id UUID;
BEGIN
  -- Only post when status becomes 'final'
  IF NEW.status = 'final' AND (OLD.status IS NULL OR OLD.status != 'final') THEN
    
    -- Get account IDs from settings or default accounts
    SELECT id INTO v_cash_account_id FROM accounts
    WHERE company_id = NEW.company_id AND subtype = 'cash' AND is_active = true LIMIT 1;
    
    SELECT id INTO v_sales_account_id FROM accounts
    WHERE company_id = NEW.company_id AND subtype = 'sales_revenue' AND is_active = true LIMIT 1;
    
    SELECT id INTO v_ar_account_id FROM accounts
    WHERE company_id = NEW.company_id AND subtype = 'accounts_receivable' AND is_active = true LIMIT 1;

    -- Create journal entry
    INSERT INTO journal_entries (
      company_id,
      branch_id,
      entry_no,
      entry_date,
      description,
      reference_type,
      reference_id,
      total_debit,
      total_credit,
      is_posted,
      posted_at,
      is_manual,
      created_by
    ) VALUES (
      NEW.company_id,
      NEW.branch_id,
      get_next_document_number(NEW.company_id, NEW.branch_id, 'journal'),
      NEW.invoice_date,
      'Sale to ' || NEW.customer_name || ' - Invoice ' || NEW.invoice_no,
      'sale',
      NEW.id,
      NEW.total,
      NEW.total,
      true,
      NOW(),
      false,
      NEW.created_by
    ) RETURNING id INTO v_journal_id;

    -- Debit entries
    IF NEW.paid_amount > 0 THEN
      -- Dr: Cash/Bank (if paid)
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_name, debit, credit, description)
      VALUES (
        v_journal_id,
        v_cash_account_id,
        (SELECT name FROM accounts WHERE id = v_cash_account_id),
        NEW.paid_amount,
        0,
        'Cash received on sale'
      );
    END IF;

    IF NEW.due_amount > 0 THEN
      -- Dr: Accounts Receivable (if credit)
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_name, debit, credit, description)
      VALUES (
        v_journal_id,
        v_ar_account_id,
        (SELECT name FROM accounts WHERE id = v_ar_account_id),
        NEW.due_amount,
        0,
        'Credit sale to ' || NEW.customer_name
      );
    END IF;

    -- Credit entry
    -- Cr: Sales Revenue
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_name, debit, credit, description)
    VALUES (
      v_journal_id,
      v_sales_account_id,
      (SELECT name FROM accounts WHERE id = v_sales_account_id),
      0,
      NEW.total,
      'Sale revenue'
    );

    -- Update sale with journal reference
    UPDATE sales SET journal_entry_id = v_journal_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_post_sale_to_accounting
  AFTER INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION auto_post_sale_to_accounting();

-- ============================================================================
-- 9. AUDIT LOG TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Try to get company_id from the record
  IF TG_OP = 'DELETE' THEN
    v_company_id := OLD.company_id;
  ELSE
    v_company_id := NEW.company_id;
  END IF;

  INSERT INTO audit_logs (
    company_id,
    user_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    ip_address
  ) VALUES (
    v_company_id,
    auth.uid(),
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    inet_client_addr()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit logging to important tables
CREATE TRIGGER audit_sales AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_purchases AFTER INSERT OR UPDATE OR DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_journal_entries AFTER INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- ============================================================================
-- 10. UTILITY FUNCTIONS
-- ============================================================================

-- Get account balance
CREATE OR REPLACE FUNCTION get_account_balance(account_uuid UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  v_balance DECIMAL(15,2);
  v_debits DECIMAL(15,2);
  v_credits DECIMAL(15,2);
  v_account RECORD;
BEGIN
  -- Get account details
  SELECT * INTO v_account FROM accounts WHERE id = account_uuid;

  -- Calculate total debits and credits
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_debits, v_credits
  FROM journal_entry_lines
  WHERE account_id = account_uuid
    AND EXISTS (
      SELECT 1 FROM journal_entries
      WHERE id = journal_entry_lines.journal_entry_id
        AND is_posted = true
    );

  -- Calculate balance based on account type
  CASE v_account.type
    WHEN 'asset', 'expense' THEN
      v_balance := v_account.opening_balance + v_debits - v_credits;
    WHEN 'liability', 'equity', 'revenue' THEN
      v_balance := v_account.opening_balance + v_credits - v_debits;
    ELSE
      v_balance := 0;
  END CASE;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Update all account balances
CREATE OR REPLACE FUNCTION update_all_account_balances()
RETURNS VOID AS $$
DECLARE
  v_account RECORD;
BEGIN
  FOR v_account IN SELECT id FROM accounts WHERE is_active = true
  LOOP
    UPDATE accounts
    SET current_balance = get_account_balance(v_account.id)
    WHERE id = v_account.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF FUNCTIONS
-- ============================================================================

COMMENT ON SCHEMA public IS 'Business logic functions and triggers applied';
