-- ============================================================================
-- ACCOUNTS RLS: Show accounts assigned via user_account_access in Add Payment
-- Fixes: Bank (and other) accounts not showing in payment dialog even after
--        granting account access to the user. Previous policy only allowed
--        code 1000/1010/1020 for non-admin; now also allow any account in
--        user_account_access for auth.uid().
-- ============================================================================

DROP POLICY IF EXISTS "accounts_select_enterprise" ON public.accounts;

CREATE POLICY "accounts_select_enterprise"
  ON public.accounts FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR get_user_role() = 'manager'
      OR get_user_role() = 'accountant'
      OR (get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator') AND code IN ('1000', '1010', '1020'))
      OR EXISTS (
        SELECT 1 FROM public.user_account_access ua
        WHERE ua.account_id = accounts.id AND ua.user_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY "accounts_select_enterprise" ON public.accounts IS
  'Admin/manager/accountant: all company accounts. Others: default payment (1000/1010/1020) OR accounts in user_account_access.';
