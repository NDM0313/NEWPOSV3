-- ============================================================================
-- FULL ERP PERMISSION ENGINE v1.0
-- Role + permission + visibility. Replaces overlapping branch-only logic.
-- Run after: erp_permission_architecture_global, identity_model_auth_user_id,
--            create_erp_health_dashboard_view (for Phase 8 integration).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PHASE 1–2: ROLE STRUCTURE + PERMISSION DATA MODEL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (role, module, action)
);

COMMENT ON TABLE public.role_permissions IS 'Permission engine v1: role → module.action → allowed. owner/admin bypass in has_permission().';

-- Ensure RLS does not block reads (has_permission uses this table)
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_select_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (true);

-- Only admin/owner can modify (enforced in app/SECURITY DEFINER RPC if needed)
DROP POLICY IF EXISTS "role_permissions_admin_all" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_all"
  ON public.role_permissions FOR ALL TO authenticated
  USING (
    COALESCE(get_user_role()::text, '') IN ('owner', 'admin')
  )
  WITH CHECK (
    COALESCE(get_user_role()::text, '') IN ('owner', 'admin')
  );

-- Seed: avoid duplicate key errors
INSERT INTO public.role_permissions (role, module, action, allowed)
VALUES
  ('owner', 'sales', 'view_own', true),
  ('owner', 'sales', 'view_branch', true),
  ('owner', 'sales', 'view_company', true),
  ('owner', 'sales', 'create', true),
  ('owner', 'sales', 'edit', true),
  ('owner', 'sales', 'delete', true),
  ('owner', 'payments', 'receive', true),
  ('owner', 'payments', 'edit', true),
  ('owner', 'payments', 'delete', true),
  ('owner', 'ledger', 'view_customer', true),
  ('owner', 'ledger', 'view_supplier', true),
  ('owner', 'ledger', 'view_full_accounting', true),
  ('owner', 'inventory', 'view', true),
  ('owner', 'inventory', 'adjust', true),
  ('owner', 'inventory', 'transfer', true),
  ('owner', 'contacts', 'view', true),
  ('owner', 'contacts', 'edit', true),
  ('owner', 'reports', 'view', true),
  ('owner', 'users', 'create', true),
  ('owner', 'users', 'edit', true),
  ('owner', 'users', 'delete', true),
  ('owner', 'users', 'assign_permissions', true),
  ('owner', 'settings', 'modify', true),
  ('admin', 'sales', 'view_own', true),
  ('admin', 'sales', 'view_branch', true),
  ('admin', 'sales', 'view_company', true),
  ('admin', 'sales', 'create', true),
  ('admin', 'sales', 'edit', true),
  ('admin', 'sales', 'delete', true),
  ('admin', 'payments', 'receive', true),
  ('admin', 'payments', 'edit', true),
  ('admin', 'payments', 'delete', true),
  ('admin', 'ledger', 'view_customer', true),
  ('admin', 'ledger', 'view_supplier', true),
  ('admin', 'ledger', 'view_full_accounting', true),
  ('admin', 'inventory', 'view', true),
  ('admin', 'inventory', 'adjust', true),
  ('admin', 'inventory', 'transfer', true),
  ('admin', 'contacts', 'view', true),
  ('admin', 'contacts', 'edit', true),
  ('admin', 'reports', 'view', true),
  ('admin', 'users', 'create', true),
  ('admin', 'users', 'edit', true),
  ('admin', 'users', 'delete', true),
  ('admin', 'users', 'assign_permissions', true),
  ('admin', 'settings', 'modify', true),
  ('manager', 'sales', 'view_branch', true),
  ('manager', 'sales', 'view_company', false),
  ('manager', 'sales', 'view_own', true),
  ('manager', 'sales', 'create', true),
  ('manager', 'sales', 'edit', true),
  ('manager', 'sales', 'delete', true),
  ('manager', 'payments', 'receive', true),
  ('manager', 'payments', 'edit', true),
  ('manager', 'payments', 'delete', false),
  ('manager', 'ledger', 'view_customer', true),
  ('manager', 'ledger', 'view_supplier', true),
  ('manager', 'ledger', 'view_full_accounting', false),
  ('manager', 'inventory', 'view', true),
  ('manager', 'inventory', 'adjust', true),
  ('manager', 'inventory', 'transfer', true),
  ('manager', 'contacts', 'view', true),
  ('manager', 'contacts', 'edit', true),
  ('manager', 'reports', 'view', true),
  ('manager', 'users', 'create', false),
  ('manager', 'users', 'edit', false),
  ('manager', 'users', 'delete', false),
  ('manager', 'users', 'assign_permissions', false),
  ('manager', 'settings', 'modify', false),
  ('user', 'sales', 'view_own', true),
  ('user', 'sales', 'view_branch', false),
  ('user', 'sales', 'view_company', false),
  ('user', 'sales', 'create', true),
  ('user', 'sales', 'edit', true),
  ('user', 'sales', 'delete', false),
  ('user', 'payments', 'receive', true),
  ('user', 'payments', 'edit', false),
  ('user', 'payments', 'delete', false),
  ('user', 'ledger', 'view_customer', true),
  ('user', 'ledger', 'view_supplier', false),
  ('user', 'ledger', 'view_full_accounting', false),
  ('user', 'inventory', 'view', true),
  ('user', 'inventory', 'adjust', false),
  ('user', 'inventory', 'transfer', false),
  ('user', 'contacts', 'view', true),
  ('user', 'contacts', 'edit', true),
  ('user', 'reports', 'view', false),
  ('user', 'users', 'create', false),
  ('user', 'users', 'edit', false),
  ('user', 'users', 'delete', false),
  ('user', 'users', 'assign_permissions', false),
  ('user', 'settings', 'modify', false)
ON CONFLICT (role, module, action) DO NOTHING;

-- ----------------------------------------------------------------------------
-- PHASE 3: PERMISSION FUNCTIONS
-- ----------------------------------------------------------------------------
-- Normalize app role to engine role: owner | admin | manager | user
CREATE OR REPLACE FUNCTION public.get_user_role_normalized()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(get_user_role()::text, '') IN ('owner') THEN 'owner'
    WHEN COALESCE(get_user_role()::text, '') IN ('admin') THEN 'admin'
    WHEN COALESCE(get_user_role()::text, '') IN ('manager', 'accountant') THEN 'manager'
    ELSE 'user'
  END;
$$;

-- Alias for task naming (owner or admin = full company, unrestricted)
CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(get_user_role()::text, '') IN ('owner', 'admin');
$$;

-- Core permission check: owner/admin always true; else role_permissions
CREATE OR REPLACE FUNCTION public.has_permission(p_module TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    is_owner_or_admin()
    OR COALESCE(
      (SELECT allowed FROM public.role_permissions
       WHERE role = get_user_role_normalized()
         AND module = p_module
         AND action = p_action),
      false
    );
$$;

COMMENT ON FUNCTION public.get_user_role_normalized() IS 'Maps get_user_role() to owner|admin|manager|user for permission engine.';
COMMENT ON FUNCTION public.is_owner_or_admin() IS 'True if role is owner or admin (full company, unrestricted).';
COMMENT ON FUNCTION public.has_permission(TEXT, TEXT) IS 'Permission engine: true if owner/admin or role_permissions allows module.action.';

-- ----------------------------------------------------------------------------
-- PHASE 4: RLS REWRITE (CORE ENGINE)
-- Sales: view_company | view_branch | view_own
-- ----------------------------------------------------------------------------
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_select_enterprise" ON public.sales;
DROP POLICY IF EXISTS "sales_select_role_based" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_enterprise" ON public.sales;
DROP POLICY IF EXISTS "sales_update_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_update_enterprise" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_enterprise" ON public.sales;

CREATE POLICY "sales_select_policy"
  ON public.sales FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR has_permission('sales', 'view_company')
      OR (has_permission('sales', 'view_branch') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
      OR (has_permission('sales', 'view_own') AND created_by = auth.uid())
    )
  );

CREATE POLICY "sales_insert_policy"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('sales', 'create') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id)))
    )
  );

CREATE POLICY "sales_update_policy"
  ON public.sales FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('sales', 'edit') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
    )
  )
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "sales_delete_policy"
  ON public.sales FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('sales', 'delete') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
    )
  );

-- Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_enterprise" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_enterprise" ON public.payments;
DROP POLICY IF EXISTS "payments_update_enterprise" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_enterprise" ON public.payments;

CREATE POLICY "payments_select_enterprise"
  ON public.payments FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = payments.branch_id))
    )
  );

CREATE POLICY "payments_insert_enterprise"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('payments', 'receive') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id)))
    )
  );

CREATE POLICY "payments_update_enterprise"
  ON public.payments FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('payments', 'edit') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = payments.branch_id)))
    )
  )
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "payments_delete_enterprise"
  ON public.payments FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('payments', 'delete') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = payments.branch_id)))
    )
  );

-- Journal entries
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journal_entries') THEN
    ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "journal_entries_select_enterprise" ON public.journal_entries;
    DROP POLICY IF EXISTS "journal_entries_insert_enterprise" ON public.journal_entries;
    DROP POLICY IF EXISTS "journal_entries_update_enterprise" ON public.journal_entries;
    DROP POLICY IF EXISTS "journal_entries_delete_enterprise" ON public.journal_entries;

    CREATE POLICY "journal_entries_select_enterprise"
      ON public.journal_entries FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR has_permission('ledger', 'view_full_accounting')
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = journal_entries.branch_id))
        )
      );

    CREATE POLICY "journal_entries_insert_enterprise"
      ON public.journal_entries FOR INSERT TO authenticated
      WITH CHECK (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id))
        )
      );

    CREATE POLICY "journal_entries_update_enterprise"
      ON public.journal_entries FOR UPDATE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = journal_entries.branch_id))
        )
      )
      WITH CHECK (company_id = get_user_company_id());

    CREATE POLICY "journal_entries_delete_enterprise"
      ON public.journal_entries FOR DELETE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = journal_entries.branch_id))
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journal_entry_lines') THEN
    ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "journal_entry_lines_enterprise" ON public.journal_entry_lines;
    CREATE POLICY "journal_entry_lines_enterprise"
      ON public.journal_entry_lines FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.journal_entries je
          WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.company_id = get_user_company_id()
            AND (
              is_owner_or_admin()
              OR (je.branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = je.branch_id))
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.journal_entries je
          WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.company_id = get_user_company_id()
            AND (
              is_owner_or_admin()
              OR (je.branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = je.branch_id))
            )
        )
      );
  END IF;
END $$;

-- Contacts: owner/admin full; else own + system (walk-in)
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
CREATE POLICY "contacts_select_policy"
  ON public.contacts FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR has_permission('contacts', 'view')
      OR created_by = auth.uid()
      OR is_system_generated = true
    )
  );

DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
CREATE POLICY "contacts_insert_policy"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "contacts_update_policy" ON public.contacts;
CREATE POLICY "contacts_update_policy"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR has_permission('contacts', 'edit')
      OR created_by = auth.uid()
      OR is_system_generated = true
    )
  )
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;
CREATE POLICY "contacts_delete_policy"
  ON public.contacts FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (is_owner_or_admin() OR created_by = auth.uid())
    AND is_default = false
  );

-- Rentals
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rentals') THEN
    ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "rentals_select_enterprise" ON public.rentals;
    DROP POLICY IF EXISTS "rentals_insert_enterprise" ON public.rentals;
    DROP POLICY IF EXISTS "rentals_update_enterprise" ON public.rentals;
    DROP POLICY IF EXISTS "rentals_delete_enterprise" ON public.rentals;

    CREATE POLICY "rentals_select_enterprise"
      ON public.rentals FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = rentals.branch_id))
        )
      );

    CREATE POLICY "rentals_insert_enterprise"
      ON public.rentals FOR INSERT TO authenticated
      WITH CHECK (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id))
        )
      );

    CREATE POLICY "rentals_update_enterprise"
      ON public.rentals FOR UPDATE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = rentals.branch_id))
        )
      )
      WITH CHECK (company_id = get_user_company_id());

    CREATE POLICY "rentals_delete_enterprise"
      ON public.rentals FOR DELETE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = rentals.branch_id))
        )
      );
  END IF;
END $$;

-- Stock movements
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stock_movements') THEN
    ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "stock_movements_select_admin" ON public.stock_movements;
    DROP POLICY IF EXISTS "stock_movements_insert_admin" ON public.stock_movements;
    DROP POLICY IF EXISTS "stock_movements_update_admin" ON public.stock_movements;
    DROP POLICY IF EXISTS "stock_movements_delete_admin" ON public.stock_movements;

    CREATE POLICY "stock_movements_select_admin"
      ON public.stock_movements FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (has_permission('inventory', 'view') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id)))
        )
      );

    CREATE POLICY "stock_movements_insert_admin"
      ON public.stock_movements FOR INSERT TO authenticated
      WITH CHECK (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (has_permission('inventory', 'adjust') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id)))
        )
      );

    CREATE POLICY "stock_movements_update_admin"
      ON public.stock_movements FOR UPDATE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id))
        )
      )
      WITH CHECK (company_id = get_user_company_id());

    CREATE POLICY "stock_movements_delete_admin"
      ON public.stock_movements FOR DELETE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id))
        )
      );
  END IF;
END $$;

-- Ledger master (company-scoped; ledger always customer-based)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ledger_master') THEN
    ALTER TABLE public.ledger_master ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ledger_master_select_enterprise" ON public.ledger_master;
    CREATE POLICY "ledger_master_select_enterprise"
      ON public.ledger_master FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR has_permission('ledger', 'view_customer')
          OR has_permission('ledger', 'view_full_accounting')
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- PHASE 7: OWNER PROTECTION
-- Cannot demote last owner; cannot delete last owner.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_owner_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_count int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role::text = 'owner' AND (NEW.role IS NULL OR NEW.role::text <> 'owner') THEN
      SELECT COUNT(*) INTO owner_count FROM public.users WHERE company_id = OLD.company_id AND role::text = 'owner' AND id <> OLD.id;
      IF owner_count = 0 THEN
        RAISE EXCEPTION 'Cannot demote the last owner. Assign another owner first.';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role::text = 'owner' THEN
      SELECT COUNT(*) INTO owner_count FROM public.users WHERE company_id = OLD.company_id AND role::text = 'owner';
      IF owner_count <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last owner. Assign another owner first.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_owner_protection ON public.users;
CREATE TRIGGER trigger_owner_protection
  BEFORE UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.check_owner_protection();

COMMENT ON FUNCTION public.check_owner_protection() IS 'Prevents demoting or deleting the last owner per company.';
