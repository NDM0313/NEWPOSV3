-- ============================================================================
-- STOCK MOVEMENTS + INVENTORY_BALANCE RLS (branch-based visibility)
-- Admin: see all company stock. Non-admin: only branches in user_branches (auth.uid()).
-- ============================================================================

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "stock_movements_select_all" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_select_company" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_select_branch" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_update" ON public.stock_movements;
DROP POLICY IF EXISTS "inventory_balance_select_all" ON public.inventory_balance;
DROP POLICY IF EXISTS "inventory_balance_select_company" ON public.inventory_balance;
DROP POLICY IF EXISTS "inventory_balance_select_branch" ON public.inventory_balance;
DROP POLICY IF EXISTS "inventory_balance_insert" ON public.inventory_balance;
DROP POLICY IF EXISTS "inventory_balance_update" ON public.inventory_balance;

-- stock_movements SELECT: admin = all company; else only rows where branch_id in user_branches or branch_id is null
CREATE POLICY "stock_movements_select_branch"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR branch_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_branches ub
        WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id
      )
    )
  );

-- stock_movements INSERT: company match; user must have branch access for branch_id (or admin)
CREATE POLICY "stock_movements_insert"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR branch_id IS NULL
      OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id)
    )
  );

-- stock_movements UPDATE: same as SELECT (allow updates for reversal etc.)
CREATE POLICY "stock_movements_update"
  ON public.stock_movements FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR branch_id IS NULL
      OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id)
    )
  );

-- inventory_balance SELECT: same branch logic (stock snapshot visibility)
CREATE POLICY "inventory_balance_select_branch"
  ON public.inventory_balance FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR branch_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_branches ub
        WHERE ub.user_id = auth.uid() AND ub.branch_id = inventory_balance.branch_id
      )
    )
  );

-- inventory_balance is updated by trigger only; no direct INSERT/UPDATE from app (service role in trigger)
-- Allow INSERT/UPDATE for authenticated if they have branch access (trigger runs as table owner)
CREATE POLICY "inventory_balance_insert"
  ON public.inventory_balance FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR branch_id IS NULL
      OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = inventory_balance.branch_id)
    )
  );

CREATE POLICY "inventory_balance_update"
  ON public.inventory_balance FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR branch_id IS NULL
      OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = inventory_balance.branch_id)
    )
  );

COMMENT ON POLICY "stock_movements_select_branch" ON public.stock_movements IS 'Admin: all company. Others: only assigned branches (user_branches by auth.uid()).';
