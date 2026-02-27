-- ============================================================================
-- CONTACTS RLS: Strict salesman isolation (customer visibility only)
-- Salesman sees ONLY: default customer (is_default=true) + own customers (created_by = auth.uid()).
-- No suppliers, workers, admin-created customers, or other salesmen's customers.
-- No branch-based logic. RLS only. Self-hosted Supabase.
-- ============================================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_select_enterprise" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_enterprise" ON contacts;
DROP POLICY IF EXISTS "contacts_update_enterprise" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_enterprise" ON contacts;

-- SELECT: Admin/Manager see all. Salesman ONLY default + own customers (type = customer).
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

-- INSERT: Salesman must set created_by = auth.uid() (or NULL; trigger sets it). Only type = customer.
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

-- UPDATE: Salesman only own customers or default
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

-- DELETE: Admin/Manager only; default customer protected (trigger prevent_delete_default_customer also blocks)
CREATE POLICY "contacts_delete_enterprise"
  ON contacts FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'manager')
    AND (is_default IS NOT TRUE)
  );

COMMENT ON TABLE contacts IS 'Contacts. RLS: Admin/Manager see all; Salesman only default customer + own customers (no suppliers/workers/others).';
