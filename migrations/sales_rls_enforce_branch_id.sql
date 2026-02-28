-- Enforce branch_id and created_by for non-admin.
-- Branch: branch_id = get_user_branch_id() OR admin.
-- Created_by: created_by = auth.uid() OR admin (salesman cannot assign sale to someone else).

DROP POLICY IF EXISTS "sales_insert_role_based" ON public.sales;
CREATE POLICY "sales_insert_role_based"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (get_user_role() = 'admin' OR created_by = auth.uid() OR created_by IS NULL)
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND branch_id = get_user_branch_id())
      OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND (created_by IS NULL OR created_by = auth.uid()) AND branch_id = get_user_branch_id())
      OR (get_user_role() NOT IN ('admin', 'manager') AND (created_by IS NULL OR created_by = auth.uid()) AND branch_id = get_user_branch_id())
    )
  );

DROP POLICY IF EXISTS "sales_update_role_based" ON public.sales;
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
    AND (get_user_role() = 'admin' OR branch_id = get_user_branch_id())
  );
