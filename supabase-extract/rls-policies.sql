-- ============================================================================
-- DIN COLLECTION ERP - ROW LEVEL SECURITY (RLS) POLICIES
-- Version: 1.0.0
-- Date: January 18, 2026
-- Description: Security policies to restrict data access based on user roles
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user has permission for a module
CREATE OR REPLACE FUNCTION has_module_permission(
  module_name VARCHAR,
  permission_type VARCHAR -- 'view', 'create', 'edit', 'delete'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_permission RECORD;
  user_role_val user_role;
BEGIN
  -- Admin has all permissions
  SELECT role INTO user_role_val FROM users WHERE id = auth.uid();
  IF user_role_val = 'admin' THEN
    RETURN true;
  END IF;

  -- Check specific permission
  SELECT * INTO user_permission
  FROM permissions
  WHERE user_id = auth.uid()
    AND module = module_name;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  CASE permission_type
    WHEN 'view' THEN RETURN user_permission.can_view;
    WHEN 'create' THEN RETURN user_permission.can_create;
    WHEN 'edit' THEN RETURN user_permission.can_edit;
    WHEN 'delete' THEN RETURN user_permission.can_delete;
    ELSE RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has access to branch
CREATE OR REPLACE FUNCTION has_branch_access(branch_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_branches
    WHERE user_id = auth.uid()
      AND branch_id = branch_uuid
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- COMPANIES
-- ============================================================================

-- Users can only view their own company
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (id = get_user_company_id());

-- Only admins can update company
CREATE POLICY "Admins can update company"
  ON companies FOR UPDATE
  USING (get_user_role() = 'admin' AND id = get_user_company_id());

-- ============================================================================
-- BRANCHES
-- ============================================================================

-- Users can view branches they have access to
CREATE POLICY "Users can view accessible branches"
  ON branches FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR has_branch_access(id)
    )
  );

-- Admins and managers can insert/update branches
CREATE POLICY "Admins and managers can manage branches"
  ON branches FOR ALL
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'manager')
  );

-- ============================================================================
-- USERS
-- ============================================================================

-- Users can view users in same company
CREATE POLICY "Users can view company users"
  ON users FOR SELECT
  USING (company_id = get_user_company_id());

-- Only admins can insert/update/delete users
CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  USING (get_user_role() = 'admin' AND company_id = get_user_company_id());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

CREATE POLICY "Admins can manage permissions"
  ON permissions FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "Users can view own permissions"
  ON permissions FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- CONTACTS
-- ============================================================================

CREATE POLICY "Users can view company contacts"
  ON contacts FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('contacts', 'view')
  );

CREATE POLICY "Users can insert contacts"
  ON contacts FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND has_module_permission('contacts', 'create')
  );

CREATE POLICY "Users can update contacts"
  ON contacts FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('contacts', 'edit')
  );

CREATE POLICY "Users can delete contacts"
  ON contacts FOR DELETE
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('contacts', 'delete')
  );

-- ============================================================================
-- PRODUCTS
-- ============================================================================

CREATE POLICY "Users can view company products"
  ON products FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('products', 'view')
  );

CREATE POLICY "Users can insert products"
  ON products FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND has_module_permission('products', 'create')
  );

CREATE POLICY "Users can update products"
  ON products FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('products', 'edit')
  );

CREATE POLICY "Users can delete products"
  ON products FOR DELETE
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('products', 'delete')
  );

-- Product Variations (inherit from products)
CREATE POLICY "Users can view product variations"
  ON product_variations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_variations.product_id
      AND products.company_id = get_user_company_id()
  ));

CREATE POLICY "Users can manage product variations"
  ON product_variations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variations.product_id
        AND products.company_id = get_user_company_id()
    )
    AND has_module_permission('products', 'edit')
  );

-- ============================================================================
-- STOCK MOVEMENTS
-- ============================================================================

CREATE POLICY "Users can view stock movements"
  ON stock_movements FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('inventory', 'view')
  );

CREATE POLICY "Users can insert stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND has_module_permission('inventory', 'create')
  );

-- ============================================================================
-- SALES
-- ============================================================================

CREATE POLICY "Users can view branch sales"
  ON sales FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('sales', 'view')
  );

CREATE POLICY "Users can insert sales"
  ON sales FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('sales', 'create')
  );

CREATE POLICY "Users can update sales"
  ON sales FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('sales', 'edit')
    AND status IN ('draft', 'quotation') -- Can't edit finalized sales
  );

CREATE POLICY "Users can delete sales"
  ON sales FOR DELETE
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('sales', 'delete')
    AND status = 'draft' -- Can only delete drafts
  );

-- Sale Items (inherit from sales)
CREATE POLICY "Users can view sale items"
  ON sale_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_items.sale_id
      AND sales.company_id = get_user_company_id()
  ));

CREATE POLICY "Users can manage sale items"
  ON sale_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_items.sale_id
      AND sales.company_id = get_user_company_id()
      AND sales.status IN ('draft', 'quotation')
  ));

-- ============================================================================
-- PURCHASES
-- ============================================================================

CREATE POLICY "Users can view branch purchases"
  ON purchases FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('purchases', 'view')
  );

CREATE POLICY "Users can insert purchases"
  ON purchases FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('purchases', 'create')
  );

CREATE POLICY "Users can update purchases"
  ON purchases FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('purchases', 'edit')
    AND status IN ('draft', 'order')
  );

CREATE POLICY "Users can delete purchases"
  ON purchases FOR DELETE
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('purchases', 'delete')
    AND status = 'draft'
  );

-- Purchase Items (inherit from purchases)
CREATE POLICY "Users can view purchase items"
  ON purchase_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM purchases
    WHERE purchases.id = purchase_items.purchase_id
      AND purchases.company_id = get_user_company_id()
  ));

CREATE POLICY "Users can manage purchase items"
  ON purchase_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM purchases
    WHERE purchases.id = purchase_items.purchase_id
      AND purchases.company_id = get_user_company_id()
      AND purchases.status IN ('draft', 'order')
  ));

-- ============================================================================
-- RENTALS
-- ============================================================================

CREATE POLICY "Users can view branch rentals"
  ON rentals FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('rentals', 'view')
  );

CREATE POLICY "Users can insert rentals"
  ON rentals FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('rentals', 'create')
  );

CREATE POLICY "Users can update rentals"
  ON rentals FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('rentals', 'edit')
  );

-- ============================================================================
-- STUDIO ORDERS
-- ============================================================================

CREATE POLICY "Users can view studio orders"
  ON studio_orders FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('studio', 'view')
  );

CREATE POLICY "Users can manage studio orders"
  ON studio_orders FOR ALL
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('studio', 'create')
  );

-- ============================================================================
-- EXPENSES
-- ============================================================================

CREATE POLICY "Users can view branch expenses"
  ON expenses FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('expenses', 'view')
  );

CREATE POLICY "Users can insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
    AND has_module_permission('expenses', 'create')
  );

CREATE POLICY "Managers can approve expenses"
  ON expenses FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'manager')
  );

-- ============================================================================
-- ACCOUNTING
-- ============================================================================

CREATE POLICY "Accountants can view accounts"
  ON accounts FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('accounting', 'view')
  );

CREATE POLICY "Admins and accountants can manage accounts"
  ON accounts FOR ALL
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'accountant', 'manager')
    AND (is_system = false OR get_user_role() = 'admin')
  );

CREATE POLICY "Users can view journal entries"
  ON journal_entries FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('accounting', 'view')
  );

CREATE POLICY "Accountants can manage manual entries"
  ON journal_entries FOR ALL
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'accountant', 'manager')
    AND (is_manual = true OR get_user_role() = 'admin')
  );

-- ============================================================================
-- PAYMENTS
-- ============================================================================

CREATE POLICY "Users can view payments"
  ON payments FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
  );

CREATE POLICY "Users can insert payments"
  ON payments FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND has_branch_access(branch_id)
  );

-- ============================================================================
-- SETTINGS
-- ============================================================================

CREATE POLICY "Users can view company settings"
  ON settings FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can manage settings"
  ON settings FOR ALL
  USING (
    company_id = get_user_company_id()
    AND get_user_role() = 'admin'
  );

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE POLICY "Users can view company audit logs"
  ON audit_logs FOR SELECT
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true); -- System inserts via triggers

-- ============================================================================
-- END OF RLS POLICIES
-- ============================================================================

COMMENT ON SCHEMA public IS 'RLS Policies Applied - Multi-tenant security enabled';
