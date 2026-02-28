-- Allow operator/inventory to SELECT payment accounts (1000, 1010, 1020) so app load and default-accounts check don't 403.
-- They still cannot INSERT/UPDATE/DELETE accounts (only admin/manager/accountant).

DROP POLICY IF EXISTS "accounts_select_enterprise" ON accounts;

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
