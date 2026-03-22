-- ============================================================================
-- PHASE 3 — Audit table for historical payment ↔ journal_entries linkage repair
--
-- Detection queries, dry-run previews, APPLY blocks, and rollback live in:
--   scripts/sql/phase3_payment_je_linkage_playbook.sql
--
-- After this migration: optional auto-apply P3–P6 via
--   migrations/20260341_phase4_payment_je_linkage_repair_apply.sql
-- Or run the playbook manually in the Supabase SQL editor (detection / dry-run / per-step APPLY).
-- No row updates in this file (safe for automated migration runners).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.je_payment_linkage_repair_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_batch_id UUID NOT NULL,
  company_id UUID NOT NULL,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  old_payment_id TEXT,
  old_reference_id TEXT,
  new_payment_id TEXT,
  new_reference_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_je_pay_link_audit_batch
  ON public.je_payment_linkage_repair_audit(repair_batch_id);

CREATE INDEX IF NOT EXISTS idx_je_pay_link_audit_je
  ON public.je_payment_linkage_repair_audit(journal_entry_id);

COMMENT ON TABLE public.je_payment_linkage_repair_audit IS
  'Phase 3 payment/JE linkage repairs — revert via playbook PART 7 using repair_batch_id.';

GRANT SELECT, INSERT ON public.je_payment_linkage_repair_audit TO authenticated;
GRANT SELECT, INSERT ON public.je_payment_linkage_repair_audit TO service_role;
