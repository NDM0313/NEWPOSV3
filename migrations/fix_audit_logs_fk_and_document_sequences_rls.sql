-- ============================================================================
-- 1) audit_logs.user_id: FK currently references public.users(id).
--    Trigger log_audit_trail() inserts auth.uid() -> FK violation.
--    Fix: reference auth.users(id) ON DELETE SET NULL so auth.uid() is valid.
-- 2) document_sequences: 403 on upsert -> add RLS policies (company-scoped).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. audit_logs: user_id -> auth.users(id)
-- ----------------------------------------------------------------------------
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.audit_logs.user_id IS 'Identity: auth.users(id). Set by log_audit_trail() as auth.uid().';

-- ----------------------------------------------------------------------------
-- 2. document_sequences: enable RLS and allow company-scoped access
-- ----------------------------------------------------------------------------
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_sequences_select_company" ON public.document_sequences;
DROP POLICY IF EXISTS "document_sequences_insert_company" ON public.document_sequences;
DROP POLICY IF EXISTS "document_sequences_update_company" ON public.document_sequences;
DROP POLICY IF EXISTS "document_sequences_all_company" ON public.document_sequences;

-- SELECT: same company
CREATE POLICY "document_sequences_select_company"
  ON public.document_sequences FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- INSERT: same company (for upsert)
CREATE POLICY "document_sequences_insert_company"
  ON public.document_sequences FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- UPDATE: same company
CREATE POLICY "document_sequences_update_company"
  ON public.document_sequences FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

COMMENT ON TABLE public.document_sequences IS 'Document numbering sequences. RLS: users see only their company.';
