-- Per-branch product availability (multi-branch companies).
-- No rows for a product = available in all branches (backward compatible).

CREATE TABLE IF NOT EXISTS public.product_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_product_branches_company_branch
  ON public.product_branches (company_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_product_branches_product
  ON public.product_branches (product_id);

ALTER TABLE public.product_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_branches_select_policy ON public.product_branches;
DROP POLICY IF EXISTS product_branches_insert_policy ON public.product_branches;
DROP POLICY IF EXISTS product_branches_update_policy ON public.product_branches;
DROP POLICY IF EXISTS product_branches_delete_policy ON public.product_branches;

CREATE POLICY product_branches_select_policy
  ON public.product_branches FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY product_branches_insert_policy
  ON public.product_branches FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY product_branches_update_policy
  ON public.product_branches FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY product_branches_delete_policy
  ON public.product_branches FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());
