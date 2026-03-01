-- ============================================================================
-- ERP PERMISSION ARCHITECTURE REPLICA — role_permissions table + seed
-- Fixes: "Could not find the table 'public.role_permissions' in the schema cache"
-- Run this on your Supabase project (SQL Editor or migration runner).
-- Dependencies: public.users with (id, auth_user_id, role, company_id).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helpers (create only if missing; safe to run after auth_user_id_functions)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.get_user_company_id()
  RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
  AS $func$ SELECT COALESCE(
    (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1),
    (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  ); $func$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'get_user_company_id: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
  AS $func$ SELECT COALESCE(
    NULLIF(TRIM((SELECT role::text FROM public.users WHERE id = auth.uid() LIMIT 1)), ''),
    NULLIF(TRIM((SELECT role::text FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)), ''),
    'viewer'
  ); $func$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'get_user_role: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 2. role_permissions table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (role, module, action)
);

COMMENT ON TABLE public.role_permissions IS 'Permission engine: role → module.action → allowed. owner/admin bypass in app.';

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_select_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "role_permissions_admin_all" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_all"
  ON public.role_permissions FOR ALL TO authenticated
  USING (COALESCE(get_user_role()::text, 'viewer') IN ('owner', 'admin'))
  WITH CHECK (COALESCE(get_user_role()::text, 'viewer') IN ('owner', 'admin'));

-- ----------------------------------------------------------------------------
-- 3. Seed (owner, admin, manager, user)
-- ----------------------------------------------------------------------------
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
  ('owner', 'pos', 'view', true),
  ('owner', 'pos', 'use', true),
  ('owner', 'purchase', 'view', true),
  ('owner', 'purchase', 'create', true),
  ('owner', 'purchase', 'edit', true),
  ('owner', 'purchase', 'delete', true),
  ('owner', 'studio', 'view', true),
  ('owner', 'studio', 'create', true),
  ('owner', 'studio', 'edit', true),
  ('owner', 'studio', 'delete', true),
  ('owner', 'rentals', 'view', true),
  ('owner', 'rentals', 'create', true),
  ('owner', 'rentals', 'edit', true),
  ('owner', 'rentals', 'delete', true),
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
  ('admin', 'pos', 'view', true),
  ('admin', 'pos', 'use', true),
  ('admin', 'purchase', 'view', true),
  ('admin', 'purchase', 'create', true),
  ('admin', 'purchase', 'edit', true),
  ('admin', 'purchase', 'delete', true),
  ('admin', 'studio', 'view', true),
  ('admin', 'studio', 'create', true),
  ('admin', 'studio', 'edit', true),
  ('admin', 'studio', 'delete', true),
  ('admin', 'rentals', 'view', true),
  ('admin', 'rentals', 'create', true),
  ('admin', 'rentals', 'edit', true),
  ('admin', 'rentals', 'delete', true),
  ('manager', 'sales', 'view_own', true),
  ('manager', 'sales', 'view_branch', true),
  ('manager', 'sales', 'view_company', false),
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
  ('manager', 'pos', 'view', true),
  ('manager', 'pos', 'use', true),
  ('manager', 'purchase', 'view', true),
  ('manager', 'purchase', 'create', true),
  ('manager', 'purchase', 'edit', true),
  ('manager', 'purchase', 'delete', false),
  ('manager', 'studio', 'view', true),
  ('manager', 'studio', 'create', true),
  ('manager', 'studio', 'edit', true),
  ('manager', 'studio', 'delete', false),
  ('manager', 'rentals', 'view', true),
  ('manager', 'rentals', 'create', true),
  ('manager', 'rentals', 'edit', true),
  ('manager', 'rentals', 'delete', false),
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
  ('user', 'settings', 'modify', false),
  ('user', 'pos', 'view', true),
  ('user', 'pos', 'use', true),
  ('user', 'purchase', 'view', true),
  ('user', 'purchase', 'create', true),
  ('user', 'purchase', 'edit', false),
  ('user', 'purchase', 'delete', false),
  ('user', 'studio', 'view', true),
  ('user', 'studio', 'create', true),
  ('user', 'studio', 'edit', false),
  ('user', 'studio', 'delete', false),
  ('user', 'rentals', 'view', true),
  ('user', 'rentals', 'create', true),
  ('user', 'rentals', 'edit', false),
  ('user', 'rentals', 'delete', false)
ON CONFLICT (role, module, action) DO NOTHING;
