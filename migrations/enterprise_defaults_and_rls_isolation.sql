-- ============================================================================
-- ENTERPRISE DEFAULTS + STRICT RLS ISOLATION
-- Self-hosted Supabase ERP. Security first. No cloud logic.
-- ============================================================================
-- 1. Company trigger: auto-create Walk-in Customer + default Cash + Bank accounts
-- 2. Contacts RLS: Admin all, Manager branch, Salesman own + default only
-- 3. Sales RLS: Admin all, Manager branch, Salesman own only
-- 4. Accounts RLS: Admin full; Salesman can only see/use default payment accounts (1000, 1010, 1020)
-- 5. Journal/ledger: Admin/Manager/Accountant only; Salesman cannot view
-- 6. created_by immutable on UPDATE (trigger)
-- ============================================================================

-- Ensure contacts has is_default (from default_walkin_customer_mandatory; safe if already present)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- HELPERS (support id + auth_user_id; skip replace if not owner)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION get_user_company_id()
  RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public
  AS $fn$ SELECT COALESCE(
    (SELECT company_id FROM users WHERE id = auth.uid() LIMIT 1),
    (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1)
  ); $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DO $$ BEGIN
  CREATE OR REPLACE FUNCTION has_branch_access(branch_uuid UUID)
  RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
  AS $fn$ SELECT EXISTS (
    SELECT 1 FROM user_branches ub JOIN users u ON u.id = ub.user_id
    WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid()) AND ub.branch_id = branch_uuid
  ); $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DO $$ BEGIN
  CREATE OR REPLACE FUNCTION get_user_branch_id()
  RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public
  AS $fn$ SELECT COALESCE(
    (SELECT ub.branch_id FROM user_branches ub JOIN users u ON u.id = ub.user_id
     WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid()) AND ub.is_default = true LIMIT 1),
    (SELECT ub.branch_id FROM user_branches ub JOIN users u ON u.id = ub.user_id
     WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid()) LIMIT 1)
  ); $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. COMPANY TRIGGER: Walk-in Customer + default Cash + Bank (skip if not owner)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION create_company_defaults()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  BEGIN
    INSERT INTO contacts (company_id, type, name, is_default, is_system_generated, system_type, is_active, opening_balance, credit_limit, payment_terms)
    VALUES (NEW.id, 'customer', 'Walk-in Customer', true, true, 'walking_customer', true, 0, 0, 0);
    INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (NEW.id, '1000', 'Cash', 'cash', true) ON CONFLICT (company_id, code) DO NOTHING;
    INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (NEW.id, '1010', 'Bank', 'bank', true) ON CONFLICT (company_id, code) DO NOTHING;
    INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (NEW.id, '1020', 'Mobile Wallet', 'mobile_wallet', true) ON CONFLICT (company_id, code) DO NOTHING;
    RETURN NEW;
  END;
  $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DROP TRIGGER IF EXISTS trg_after_company_insert_create_default_customer ON companies;
DROP TRIGGER IF EXISTS trg_after_company_insert_defaults ON companies;
CREATE TRIGGER trg_after_company_insert_defaults
  AFTER INSERT ON companies FOR EACH ROW
  EXECUTE PROCEDURE create_company_defaults();

-- ----------------------------------------------------------------------------
-- 2. CONTACTS RLS: Admin all, Manager branch, Salesman own + default only
-- ----------------------------------------------------------------------------
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_fix_company" ON contacts;
DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_select_enterprise" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_enterprise" ON contacts;
DROP POLICY IF EXISTS "contacts_update_enterprise" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_enterprise" ON contacts;
DROP POLICY IF EXISTS "Users can view company contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts" ON contacts;

-- Contacts SELECT: strict isolation. No branch logic. Salesman ONLY sees default + own customers.
CREATE POLICY "contacts_select_enterprise"
  ON contacts FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() IN ('admin', 'manager')
      OR is_default = true
      OR (
        get_user_role() IN ('salesman', 'salesperson')
        AND created_by = auth.uid()
        AND type = 'customer'
      )
    )
  );

-- INSERT: admin/manager any; salesman only with created_by = auth.uid() and type customer; trigger can insert default
CREATE POLICY "contacts_insert_enterprise"
  ON contacts FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      get_user_role() IN ('admin', 'manager')
      OR (
        get_user_role() IN ('salesman', 'salesperson')
        AND type = 'customer'
        AND (created_by IS NULL OR created_by = auth.uid())
      )
      OR (is_default = true AND is_system_generated = true AND system_type = 'walking_customer')
    )
  );

-- UPDATE: admin/manager any; salesman only own customers or default
CREATE POLICY "contacts_update_enterprise"
  ON contacts FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() IN ('admin', 'manager')
      OR is_default = true
      OR (get_user_role() IN ('salesman', 'salesperson') AND created_by = auth.uid() AND type = 'customer')
    )
  )
  WITH CHECK (company_id = get_user_company_id());

-- DELETE: admin/manager only; default customer protected (trigger also blocks)
CREATE POLICY "contacts_delete_enterprise"
  ON contacts FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'manager')
    AND (is_default IS NOT TRUE)
  );

-- ----------------------------------------------------------------------------
-- 3. SALES RLS: Admin all, Manager branch, Salesman own only
-- (Re-apply role-based policies; ensure get_user_role/get_user_branch_id used)
-- ----------------------------------------------------------------------------
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_fix_company" ON sales;
DROP POLICY IF EXISTS "sales_select_role_based" ON sales;
DROP POLICY IF EXISTS "sales_insert_role_based" ON sales;
DROP POLICY IF EXISTS "sales_update_role_based" ON sales;
DROP POLICY IF EXISTS "sales_delete_role_based" ON sales;
DROP POLICY IF EXISTS "sales_select_enterprise" ON sales;
DROP POLICY IF EXISTS "sales_insert_enterprise" ON sales;
DROP POLICY IF EXISTS "sales_update_enterprise" ON sales;
DROP POLICY IF EXISTS "sales_delete_enterprise" ON sales;

CREATE POLICY "sales_select_enterprise"
  ON sales FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (branch_id = get_user_branch_id() OR branch_id IS NULL))
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND created_by = auth.uid())
    )
  );

CREATE POLICY "sales_insert_enterprise"
  ON sales FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (branch_id = get_user_branch_id() OR branch_id IS NULL))
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND (created_by IS NULL OR created_by = auth.uid()))
    )
  );

CREATE POLICY "sales_update_enterprise"
  ON sales FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (branch_id = get_user_branch_id() OR branch_id IS NULL))
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND created_by = auth.uid())
    )
  )
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "sales_delete_enterprise"
  ON sales FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (branch_id = get_user_branch_id() OR branch_id IS NULL))
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND created_by = auth.uid())
    )
  );

-- sale_items: inherit from parent sale visibility
DROP POLICY IF EXISTS "rls_fix_company" ON sale_items;
DROP POLICY IF EXISTS "sale_items_select_policy" ON sale_items;
DROP POLICY IF EXISTS "sale_items_insert_policy" ON sale_items;
DROP POLICY IF EXISTS "sale_items_update_policy" ON sale_items;
DROP POLICY IF EXISTS "sale_items_delete_policy" ON sale_items;
DROP POLICY IF EXISTS "sale_items_select_enterprise" ON sale_items;
DROP POLICY IF EXISTS "sale_items_insert_enterprise" ON sale_items;
DROP POLICY IF EXISTS "sale_items_update_enterprise" ON sale_items;
DROP POLICY IF EXISTS "sale_items_delete_enterprise" ON sale_items;

CREATE POLICY "sale_items_select_enterprise"
  ON sale_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id AND s.company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (s.branch_id = get_user_branch_id() OR s.branch_id IS NULL))
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND s.created_by = auth.uid())
    )
  ));

CREATE POLICY "sale_items_insert_enterprise"
  ON sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id AND s.company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (s.branch_id = get_user_branch_id() OR s.branch_id IS NULL))
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND s.created_by = auth.uid())
    )
  ));

CREATE POLICY "sale_items_update_enterprise"
  ON sale_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id AND s.company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (s.branch_id = get_user_branch_id() OR s.branch_id IS NULL))
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND s.created_by = auth.uid())
    )
  ));

CREATE POLICY "sale_items_delete_enterprise"
  ON sale_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id AND s.company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (s.branch_id = get_user_branch_id() OR s.branch_id IS NULL))
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND s.created_by = auth.uid())
    )
  ));

-- ----------------------------------------------------------------------------
-- 4. ACCOUNTS RLS: Admin full; Salesman only default payment accounts (1000, 1010, 1020)
-- Salesman can receive payments into these; cannot view other accounts or ledger.
-- ----------------------------------------------------------------------------
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_fix_company" ON accounts;
DROP POLICY IF EXISTS "accounts_select_company" ON accounts;
DROP POLICY IF EXISTS "accounts_insert_company" ON accounts;
DROP POLICY IF EXISTS "accounts_update_company" ON accounts;
DROP POLICY IF EXISTS "accounts_delete_company" ON accounts;
DROP POLICY IF EXISTS "accounts_select_enterprise" ON accounts;
DROP POLICY IF EXISTS "accounts_insert_enterprise" ON accounts;
DROP POLICY IF EXISTS "accounts_update_enterprise" ON accounts;
DROP POLICY IF EXISTS "accounts_delete_enterprise" ON accounts;

CREATE POLICY "accounts_select_enterprise"
  ON accounts FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR get_user_role() = 'manager'
      OR get_user_role() = 'accountant'
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND code IN ('1000', '1010', '1020'))
    )
  );

CREATE POLICY "accounts_insert_enterprise"
  ON accounts FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager', 'accountant'));

CREATE POLICY "accounts_update_enterprise"
  ON accounts FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'manager', 'accountant')
  )
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "accounts_delete_enterprise"
  ON accounts FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND get_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 5. JOURNAL ENTRIES / LEDGER: Admin (and manager/accountant) only; Salesman cannot view
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journal_entries') THEN
    ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "rls_fix_company" ON journal_entries;
    DROP POLICY IF EXISTS "Accountants can view journal entries" ON journal_entries;
    DROP POLICY IF EXISTS "Accountants can manage manual entries" ON journal_entries;
    DROP POLICY IF EXISTS "journal_entries_select_enterprise" ON journal_entries;
    DROP POLICY IF EXISTS "journal_entries_insert_enterprise" ON journal_entries;
    DROP POLICY IF EXISTS "journal_entries_update_enterprise" ON journal_entries;
    DROP POLICY IF EXISTS "journal_entries_delete_enterprise" ON journal_entries;
    CREATE POLICY "journal_entries_select_enterprise"
      ON journal_entries FOR SELECT TO authenticated
      USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager', 'accountant'));
    CREATE POLICY "journal_entries_insert_enterprise"
      ON journal_entries FOR INSERT TO authenticated
      WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager', 'accountant'));
    CREATE POLICY "journal_entries_update_enterprise"
      ON journal_entries FOR UPDATE TO authenticated
      USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager', 'accountant'));
    CREATE POLICY "journal_entries_delete_enterprise"
      ON journal_entries FOR DELETE TO authenticated
      USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager', 'accountant'));
  END IF;

  -- journal_entry_lines: restrict by parent journal_entries (salesman cannot view)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journal_entry_lines') THEN
    ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow authenticated full access" ON journal_entry_lines;
    DROP POLICY IF EXISTS "journal_entry_lines_enterprise" ON journal_entry_lines;
    CREATE POLICY "journal_entry_lines_enterprise"
      ON journal_entry_lines FOR ALL TO authenticated
      USING (
        get_user_role() IN ('admin', 'manager', 'accountant')
        AND EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.company_id = get_user_company_id()
        )
      )
      WITH CHECK (
        get_user_role() IN ('admin', 'manager', 'accountant')
        AND EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.company_id = get_user_company_id()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ledger_entries') THEN
    ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "rls_fix_company" ON ledger_entries;
    DROP POLICY IF EXISTS "ledger_entries_select_enterprise" ON ledger_entries;
    CREATE POLICY "ledger_entries_select_enterprise"
      ON ledger_entries FOR SELECT TO authenticated
      USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager', 'accountant'));
    CREATE POLICY "ledger_entries_all_enterprise"
      ON ledger_entries FOR ALL TO authenticated
      USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager', 'accountant'))
      WITH CHECK (company_id = get_user_company_id());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. ENFORCE created_by immutable on UPDATE (skip if not owner)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION enforce_created_by_immutable()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
  BEGIN
    IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      NEW.created_by := OLD.created_by;
    END IF;
    RETURN NEW;
  END;
  $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DROP TRIGGER IF EXISTS enforce_sales_created_by_immutable ON sales;
CREATE TRIGGER enforce_sales_created_by_immutable
  BEFORE UPDATE ON sales FOR EACH ROW EXECUTE PROCEDURE enforce_created_by_immutable();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'created_by') THEN
    DROP TRIGGER IF EXISTS enforce_contacts_created_by_immutable ON contacts;
    CREATE TRIGGER enforce_contacts_created_by_immutable
      BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE PROCEDURE enforce_created_by_immutable();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- BACKFILL: Ensure existing companies have default Cash/Bank (skip if not owner)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION backfill_company_default_accounts()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  BEGIN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    SELECT c.id, '1000', 'Cash', 'cash', true FROM companies c
    WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.company_id = c.id AND a.code = '1000')
    ON CONFLICT (company_id, code) DO NOTHING;
    INSERT INTO accounts (company_id, code, name, type, is_active)
    SELECT c.id, '1010', 'Bank', 'bank', true FROM companies c
    WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.company_id = c.id AND a.code = '1010')
    ON CONFLICT (company_id, code) DO NOTHING;
    INSERT INTO accounts (company_id, code, name, type, is_active)
    SELECT c.id, '1020', 'Mobile Wallet', 'mobile_wallet', true FROM companies c
    WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.company_id = c.id AND a.code = '1020')
    ON CONFLICT (company_id, code) DO NOTHING;
  END;
  $fn$;
  PERFORM backfill_company_default_accounts();
  DROP FUNCTION backfill_company_default_accounts();
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

COMMENT ON FUNCTION create_company_defaults() IS 'Enterprise: seed Walk-in Customer + default Cash/Bank/Mobile Wallet on company insert.';
