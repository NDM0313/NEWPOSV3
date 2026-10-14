-- Developer Center controlled repair audit trail (Phase F).
-- Row-level before/after JSON for confirm-gated repairs — no GL line amount edits here.

CREATE TABLE IF NOT EXISTS public.developer_repair_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,
  action_id TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  before_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  dry_run_hash TEXT NOT NULL,
  confirm_phrase TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_developer_repair_audit_company_created
  ON public.developer_repair_audit(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_developer_repair_audit_action
  ON public.developer_repair_audit(company_id, action_id, created_at DESC);

COMMENT ON TABLE public.developer_repair_audit IS
  'Audit for Accounting Developer Center controlled repairs. Revert metadata-only changes using before_json.';

GRANT SELECT, INSERT ON public.developer_repair_audit TO authenticated;
GRANT SELECT, INSERT ON public.developer_repair_audit TO service_role;
