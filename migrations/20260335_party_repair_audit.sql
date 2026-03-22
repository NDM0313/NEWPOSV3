-- Audit trail for deterministic party/repair fixes (reversible via old_value; no GL line edits here).

CREATE TABLE IF NOT EXISTS public.party_repair_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  column_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason_code TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  applied_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_repair_audit_company_created
  ON public.party_repair_audit(company_id, created_at DESC);

COMMENT ON TABLE public.party_repair_audit IS
  'Row-level audit for party repair helpers (e.g. payments.contact_id backfill). Revert = UPDATE row to old_value using this log.';

GRANT SELECT, INSERT ON public.party_repair_audit TO authenticated;
GRANT SELECT, INSERT ON public.party_repair_audit TO service_role;
