-- ============================================================================
-- Sales & Products RLS - Role-Based Access
-- ============================================================================
-- Business rules:
--   Products: All users in same company see all products (company-level only).
--   Sales:
--     Admin: full access (all sales in company)
--     Manager: only sales from their branch
--     Salesman: only sales created by themselves
--   Insert: Salesman can only insert sales where created_by = auth.uid() (trigger sets it).
-- ============================================================================

-- STEP 1: Ensure sales table has required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'company_id') THEN
    ALTER TABLE public.sales ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_sales_company ON public.sales(company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'branch_id') THEN
    ALTER TABLE public.sales ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;
    CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(branch_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'created_by') THEN
    ALTER TABLE public.sales ADD COLUMN created_by UUID;
    COMMENT ON COLUMN public.sales.created_by IS 'auth.uid() of creator; set by trigger';
  END IF;
END $$;

-- STEP 2: Create get_user_branch_id() (skip replace if not owner)
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.get_user_branch_id()
  RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
    SELECT COALESCE(
      (SELECT ub.branch_id FROM public.user_branches ub JOIN public.users u ON u.id = ub.user_id
       WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid()) AND ub.is_default = true LIMIT 1),
      (SELECT ub.branch_id FROM public.user_branches ub JOIN public.users u ON u.id = ub.user_id
       WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid()) LIMIT 1)
    );
  $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

-- STEP 3: Drop existing sales policies
DROP POLICY IF EXISTS "rls_fix_company" ON public.sales;
DROP POLICY IF EXISTS "Users can view branch sales" ON public.sales;
DROP POLICY IF EXISTS "Users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Users can update sales" ON public.sales;
DROP POLICY IF EXISTS "Users can delete sales" ON public.sales;
DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_update_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_select_role_based" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_role_based" ON public.sales;
DROP POLICY IF EXISTS "sales_update_role_based" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_role_based" ON public.sales;

-- STEP 4: Create sales RLS policies
-- SELECT: Admin=all company, Manager=branch only, Salesman=own only
CREATE POLICY "sales_select_role_based"
  ON public.sales FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND branch_id = get_user_branch_id())
      OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND created_by = auth.uid())
      OR (get_user_role() NOT IN ('admin', 'manager') AND created_by = auth.uid())
    )
  );

-- INSERT: company match; salesman must have created_by = auth.uid() or null (trigger sets)
CREATE POLICY "sales_insert_role_based"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND branch_id = get_user_branch_id())
      OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND (created_by IS NULL OR created_by = auth.uid()))
      OR (get_user_role() NOT IN ('admin', 'manager') AND (created_by IS NULL OR created_by = auth.uid()))
    )
  );

-- UPDATE: same visibility as SELECT
CREATE POLICY "sales_update_role_based"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND branch_id = get_user_branch_id())
      OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND created_by = auth.uid())
      OR (get_user_role() NOT IN ('admin', 'manager') AND created_by = auth.uid())
    )
  )
  WITH CHECK (
    company_id = get_user_company_id()
  );

-- DELETE: same visibility as SELECT
CREATE POLICY "sales_delete_role_based"
  ON public.sales FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND branch_id = get_user_branch_id())
      OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND created_by = auth.uid())
      OR (get_user_role() NOT IN ('admin', 'manager') AND created_by = auth.uid())
    )
  );

-- STEP 5: sale_items - inherit from parent sales visibility
DROP POLICY IF EXISTS "rls_fix_company" ON public.sale_items;
DROP POLICY IF EXISTS "Users can view sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can manage sale items" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_select_policy" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_insert_policy" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_update_policy" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_delete_policy" ON public.sale_items;

CREATE POLICY "sale_items_select_policy"
  ON public.sale_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.company_id = get_user_company_id()
        AND (
          get_user_role() = 'admin'
          OR (get_user_role() = 'manager' AND s.branch_id = get_user_branch_id())
          OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND s.created_by = auth.uid())
          OR (get_user_role() NOT IN ('admin', 'manager') AND s.created_by = auth.uid())
        )
    )
  );

CREATE POLICY "sale_items_insert_policy"
  ON public.sale_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.company_id = get_user_company_id()
        AND (
          get_user_role() = 'admin'
          OR (get_user_role() = 'manager' AND s.branch_id = get_user_branch_id())
          OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND s.created_by = auth.uid())
          OR (get_user_role() NOT IN ('admin', 'manager') AND s.created_by = auth.uid())
        )
    )
  );

CREATE POLICY "sale_items_update_policy"
  ON public.sale_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.company_id = get_user_company_id()
        AND (
          get_user_role() = 'admin'
          OR (get_user_role() = 'manager' AND s.branch_id = get_user_branch_id())
          OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND s.created_by = auth.uid())
          OR (get_user_role() NOT IN ('admin', 'manager') AND s.created_by = auth.uid())
        )
    )
  );

CREATE POLICY "sale_items_delete_policy"
  ON public.sale_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.company_id = get_user_company_id()
        AND (
          get_user_role() = 'admin'
          OR (get_user_role() = 'manager' AND s.branch_id = get_user_branch_id())
          OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND s.created_by = auth.uid())
          OR (get_user_role() NOT IN ('admin', 'manager') AND s.created_by = auth.uid())
        )
    )
  );

-- STEP 6: Products - company-level visibility only (all users in company see all products)
DROP POLICY IF EXISTS "rls_fix_company" ON public.products;
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;

CREATE POLICY "products_select_policy"
  ON public.products FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "products_insert_policy"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "products_update_policy"
  ON public.products FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "products_delete_policy"
  ON public.products FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Ensure RLS is enabled
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
