-- ============================================================================
-- Developer Integrity Lab — persistent issues + diagnostic RPCs + sensitive line view
-- ============================================================================
-- Frontend access is still restricted; RLS scopes rows to user's company_id.
-- Safe to run once; use IF NOT EXISTS patterns where supported.
-- ============================================================================

-- ─── Issues queue (Fix Queue tab, review workflow) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.integrity_lab_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info', 'clean')),
  module TEXT,
  source_type TEXT,
  source_id UUID,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  journal_line_id UUID,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  rule_code TEXT NOT NULL,
  rule_message TEXT,
  expected_payload JSONB,
  actual_payload JSONB,
  suggested_action TEXT,
  impact_summary TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new',
    'reviewed',
    'ready_to_post',
    'ready_to_relink',
    'ready_to_reverse_repost',
    'resolved',
    'ignored_by_rule'
  )),
  bucket TEXT,
  priority INT NOT NULL DEFAULT 0,
  owner_user_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  last_reviewed_at TIMESTAMPTZ,
  last_reviewed_by UUID
);

CREATE INDEX IF NOT EXISTS idx_integrity_lab_issues_company_status
  ON public.integrity_lab_issues(company_id, status);
CREATE INDEX IF NOT EXISTS idx_integrity_lab_issues_company_created
  ON public.integrity_lab_issues(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integrity_lab_issues_journal
  ON public.integrity_lab_issues(journal_entry_id) WHERE journal_entry_id IS NOT NULL;

COMMENT ON TABLE public.integrity_lab_issues IS
  'Developer Integrity Lab fix queue; forensic review — not operational ledger.';

ALTER TABLE public.integrity_lab_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integrity_lab_issues_select ON public.integrity_lab_issues;
DROP POLICY IF EXISTS integrity_lab_issues_insert ON public.integrity_lab_issues;
DROP POLICY IF EXISTS integrity_lab_issues_update ON public.integrity_lab_issues;
DROP POLICY IF EXISTS integrity_lab_issues_delete ON public.integrity_lab_issues;

CREATE POLICY integrity_lab_issues_select ON public.integrity_lab_issues
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY integrity_lab_issues_insert ON public.integrity_lab_issues
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY integrity_lab_issues_update ON public.integrity_lab_issues
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY integrity_lab_issues_delete ON public.integrity_lab_issues
  FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

-- ─── RPC: missing canonical JE for finalized sale ──────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_integrity_count_final_sales_missing_je(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'rpc_integrity_count_final_sales_missing_je: company access denied' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COUNT(*)::INT
    FROM public.sales s
    WHERE s.company_id = p_company_id
      AND s.status = 'final'
      AND NOT EXISTS (
        SELECT 1
        FROM public.journal_entries je
        WHERE je.company_id = s.company_id
          AND je.reference_type = 'sale'
          AND je.reference_id = s.id
          AND COALESCE(je.is_void, FALSE) = FALSE
      )
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_integrity_count_final_sales_missing_je(UUID) IS
  'Integrity Lab: count final sales with no active (non-void) canonical sale JE.';

-- ─── RPC: missing canonical JE for posted purchase ─────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_integrity_count_posted_purchases_missing_je(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'rpc_integrity_count_posted_purchases_missing_je: company access denied' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COUNT(*)::INT
    FROM public.purchases p
    WHERE p.company_id = p_company_id
      AND p.status IN ('final', 'received')
      AND NOT EXISTS (
        SELECT 1
        FROM public.journal_entries je
        WHERE je.company_id = p.company_id
          AND je.reference_type = 'purchase'
          AND je.reference_id = p.id
          AND COALESCE(je.is_void, FALSE) = FALSE
      )
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_integrity_count_posted_purchases_missing_je(UUID) IS
  'Integrity Lab: count final/received purchases with no active purchase JE.';

GRANT EXECUTE ON FUNCTION public.rpc_integrity_count_final_sales_missing_je(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_integrity_count_posted_purchases_missing_je(UUID) TO authenticated;

-- ─── View: sensitive GL lines (invoker security — RLS on base tables) ───────
CREATE OR REPLACE VIEW public.v_integrity_sensitive_journal_lines AS
SELECT
  jel.id AS line_id,
  jel.journal_entry_id,
  je.company_id,
  je.branch_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.is_void,
  je.payment_id,
  je.created_by,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  jel.debit,
  jel.credit,
  jel.description AS line_description
FROM public.journal_entry_lines jel
JOIN public.journal_entries je ON je.id = jel.journal_entry_id
JOIN public.accounts a ON a.id = jel.account_id
WHERE a.code IN ('1100', '1180', '1195', '2000', '2010', '5000', '1000', '1010', '1020');

COMMENT ON VIEW public.v_integrity_sensitive_journal_lines IS
  'Developer Integrity Lab: GL lines hitting AR, AP, worker, suspense, production, core cash/bank.';
