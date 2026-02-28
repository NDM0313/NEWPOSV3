-- ============================================================================
-- ACCOUNTS RLS: Allow sale accounting codes (AR, Sales Revenue) for sale creation
-- Fixes: 403 on accounts when creating sale journal entry; "AR: MISSING, Sales: MISSING".
-- Any user who can create sales must be able to SELECT AR (1100/2000) and
-- Sales Revenue (4000/4001/4002/4003) so SalesContext can create the journal entry.
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
      OR (
        get_user_role() IN ('salesperson', 'salesman', 'staff', 'cashier', 'inventory', 'operator')
        AND (
          code IN (
            '1000', '1010', '1020',
            '1100', '2000',
            '4000', '4001', '4002', '4003'
          )
          OR EXISTS (
            SELECT 1 FROM public.user_account_access ua
            WHERE ua.account_id = accounts.id AND ua.user_id = auth.uid()
          )
        )
      )
      -- Any authenticated user in company can read AR/Sales accounts (required for sale journal entry)
      OR code IN ('1100', '2000', '4000', '4001', '4002', '4003')
    )
  );

COMMENT ON POLICY "accounts_select_enterprise" ON public.accounts IS
  'Admin/manager/accountant: all. Others: payment (1000/1010/1020), AR (1100/2000), Sales (4000+), or user_account_access. AR/Sales also allowed for any role so sale creation never 403s.';
