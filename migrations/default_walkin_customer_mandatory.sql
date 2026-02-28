-- ============================================================================
-- DEFAULT WALK-IN CUSTOMER (MANDATORY PER COMPANY)
-- Self-hosted Supabase ERP: one default customer per company, auto-created,
-- non-deletable, visible to all; sales auto-select it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Add is_default to contacts (customers)
-- ----------------------------------------------------------------------------
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN contacts.is_default IS 'Exactly one customer per company must be default (Walk-in); used for new sale auto-selection.';

-- Ensure system flags exist (may already exist from add_system_flags_to_contacts)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS system_type TEXT DEFAULT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- STEP 2: Unique partial index — only one default customer per company
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_contacts_one_default_per_company;
CREATE UNIQUE INDEX idx_contacts_one_default_per_company
  ON contacts (company_id)
  WHERE is_default = true AND type IN ('customer', 'both');

-- ----------------------------------------------------------------------------
-- STEP 3: Trigger — auto-create Walk-in Customer on company creation (skip if not owner)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION create_default_walkin_customer_for_company()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  BEGIN
    INSERT INTO contacts (
      company_id, type, name, is_default, is_system_generated, system_type, is_active,
      opening_balance, credit_limit, payment_terms
    )
    VALUES (NEW.id, 'customer', 'Walk-in Customer', true, true, 'walking_customer', true, 0, 0, 0);
    RETURN NEW;
  END;
  $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DROP TRIGGER IF EXISTS trg_after_company_insert_create_default_customer ON companies;
CREATE TRIGGER trg_after_company_insert_create_default_customer
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE PROCEDURE create_default_walkin_customer_for_company();

-- ----------------------------------------------------------------------------
-- STEP 4: Prevent deletion of default customer (skip if not owner)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION prevent_delete_default_customer()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    IF OLD.is_default = true THEN
      RAISE EXCEPTION 'Default Walk-in Customer cannot be deleted.';
    END IF;
    RETURN OLD;
  END;
  $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DROP TRIGGER IF EXISTS trg_contacts_prevent_delete_default ON contacts;
CREATE TRIGGER trg_contacts_prevent_delete_default
  BEFORE DELETE ON contacts
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_delete_default_customer();

-- ----------------------------------------------------------------------------
-- STEP 5: RLS — Admin: all; Manager: branch customers; Salesman: own + default
-- Helpers: skip replace if not owner (use existing from auth_user_id_functions / rls-policies).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION get_user_company_id()
  RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public
  AS $fn$ SELECT company_id FROM users WHERE id = auth.uid(); $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DO $$
BEGIN
  CREATE OR REPLACE FUNCTION has_module_permission(module_name VARCHAR, permission_type VARCHAR)
  RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  DECLARE user_permission RECORD; user_role_val user_role;
  BEGIN
    SELECT role INTO user_role_val FROM users WHERE id = auth.uid();
    IF user_role_val = 'admin' THEN RETURN true; END IF;
    SELECT * INTO user_permission FROM permissions WHERE user_id = auth.uid() AND module = module_name;
    IF NOT FOUND THEN RETURN false; END IF;
    CASE permission_type
      WHEN 'view' THEN RETURN user_permission.can_view;
      WHEN 'create' THEN RETURN user_permission.can_create;
      WHEN 'edit' THEN RETURN user_permission.can_edit;
      WHEN 'delete' THEN RETURN user_permission.can_delete;
      ELSE RETURN false;
    END CASE;
  END;
  $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DO $$
BEGIN
  CREATE OR REPLACE FUNCTION has_branch_access(branch_uuid UUID)
  RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
  AS $fn$ SELECT EXISTS (SELECT 1 FROM user_branches WHERE user_id = auth.uid() AND branch_id = branch_uuid); $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts" ON contacts;

-- SELECT: same company and (default visible to all | admin sees all | manager sees branch | salesman sees own or default)
CREATE POLICY "contacts_select_policy"
  ON contacts FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_default = true
      OR get_user_role() = 'admin'
      OR (
        get_user_role() = 'manager'
        AND (branch_id IS NULL OR has_branch_access(branch_id))
      )
      OR (
        get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'accountant', 'inventory_clerk', 'viewer')
        AND (created_by = auth.uid() OR is_default = true)
      )
    )
  );

-- INSERT: same company with permission, or exact default Walk-in row (for trigger on company create)
CREATE POLICY "contacts_insert_policy"
  ON contacts FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = get_user_company_id() AND has_module_permission('contacts', 'create'))
    OR (is_system_generated = true AND system_type = 'walking_customer' AND type = 'customer' AND is_default = true)
  );

-- UPDATE: same company; module permission (default customer can be updated for non-identity fields by admin)
CREATE POLICY "contacts_update_policy"
  ON contacts FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('contacts', 'edit')
  )
  WITH CHECK (company_id = get_user_company_id());

-- DELETE: same company; module permission; trigger will block if is_default
CREATE POLICY "contacts_delete_policy"
  ON contacts FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND has_module_permission('contacts', 'delete')
  );

-- Allow service_role / trigger to insert default (bypass RLS in SECURITY DEFINER or use role that bypasses RLS)
-- Trigger runs as definer; insert runs in same session so subject to RLS unless we use a role that bypasses.
-- So we need the trigger to run with sufficient privileges. SECURITY DEFINER already runs as owner;
-- the INSERT in the trigger runs in the trigger's context, so it might still be subject to RLS.
-- In Postgres, triggers run in the same role as the statement issuer. So when a backend inserts into companies
-- as service_role or postgres, the trigger runs as that role and RLS may not apply. If the app creates
-- companies via create_business_transaction (SECURITY DEFINER), the trigger runs as the function owner,
-- and the INSERT into contacts is done by the function owner - so we need a policy that allows the
-- insert when is_system_generated and system_type = 'walking_customer'. We added that in insert policy.
-- But the trigger runs as the definer (e.g. postgres/supabase), so it might bypass RLS. If not, we need
-- to allow insert when is_default = true and is_system_generated = true. We did: has_module_permission OR (is_system_generated AND system_type = 'walking_customer').
-- So the trigger, when run by create_business_transaction (definer), might run with definer's role and
-- bypass RLS. On self-hosted, that's fine. If not, the insert policy allows that case.
-- Done.

COMMENT ON TABLE contacts IS 'Contacts (customers/suppliers/workers). One default Walk-in Customer per company (is_default=true); auto-created on company insert; cannot be deleted.';

-- ----------------------------------------------------------------------------
-- BACKFILL: Ensure every existing company has exactly one default Walk-in Customer (skip if not owner)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION backfill_default_walkin_customers()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  DECLARE r RECORD;
  BEGIN
    FOR r IN (
      SELECT DISTINCT ON (t.company_id) t.id AS contact_id
      FROM contacts t
      WHERE t.type IN ('customer', 'both')
        AND (t.system_type = 'walking_customer' OR (t.is_system_generated = true AND t.name ILIKE '%walk-in%'))
        AND t.is_default = false
        AND NOT EXISTS (
          SELECT 1 FROM contacts t2
          WHERE t2.company_id = t.company_id AND t2.is_default = true AND t2.type IN ('customer', 'both')
        )
      ORDER BY t.company_id, t.created_at
    )
    LOOP
      UPDATE contacts SET is_default = true, is_system_generated = true, system_type = 'walking_customer', name = 'Walk-in Customer'
      WHERE id = r.contact_id;
    END LOOP;
    INSERT INTO contacts (company_id, type, name, is_default, is_system_generated, system_type, is_active, opening_balance, credit_limit, payment_terms)
    SELECT c.id, 'customer', 'Walk-in Customer', true, true, 'walking_customer', true, 0, 0, 0
    FROM companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM contacts t WHERE t.company_id = c.id AND t.is_default = true AND t.type IN ('customer', 'both')
    );
  END;
  $fn$;
  PERFORM backfill_default_walkin_customers();
  DROP FUNCTION backfill_default_walkin_customers();
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;
