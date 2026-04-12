-- Phase 4: Generic transaction_mutations ledger, economic_event_id on journal_entries,
-- unified read-model view v_unified_transaction_feed (read-only; not write SOT).

-- ---------------------------------------------------------------------------
-- 1) transaction_mutations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  branch_id UUID NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  mutation_type TEXT NOT NULL,
  old_state JSONB NULL,
  new_state JSONB NULL,
  delta_amount NUMERIC(18,4) NULL,
  source_journal_entry_id UUID NULL,
  adjustment_journal_entry_id UUID NULL,
  actor_user_id UUID NULL,
  reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transaction_mutations_entity_type_chk CHECK (
    entity_type IN (
      'sale', 'purchase', 'payment', 'expense', 'journal', 'transfer'
    )
  ),
  CONSTRAINT transaction_mutations_mutation_type_chk CHECK (
    mutation_type IN (
      'create',
      'update_metadata',
      'date_edit',
      'amount_edit',
      'qty_edit',
      'account_change',
      'contact_change',
      'allocation_rebuild',
      'reversal',
      'void',
      'restore',
      'status_change'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_transaction_mutations_company_entity_time
  ON public.transaction_mutations (company_id, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_mutations_company_mutation_time
  ON public.transaction_mutations (company_id, mutation_type, created_at DESC);

COMMENT ON TABLE public.transaction_mutations IS
  'Append-only business edit history (not GL truth). Journal remains canonical for accounting.';

-- ---------------------------------------------------------------------------
-- 2) journal_entries.economic_event_id — stable chain key (payment = payment_id; document = document id)
-- ---------------------------------------------------------------------------
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS economic_event_id UUID NULL;

COMMENT ON COLUMN public.journal_entries.economic_event_id IS
  'Phase 4: Groups primary JE + PF-14 adjustments/reversals for the same economic event (often = payment_id for receipts).';

CREATE INDEX IF NOT EXISTS idx_journal_entries_economic_event
  ON public.journal_entries (company_id, economic_event_id)
  WHERE economic_event_id IS NOT NULL AND COALESCE(is_void, false) = false;

-- Backfill (best-effort; idempotent)
UPDATE public.journal_entries je
SET economic_event_id = je.payment_id
WHERE je.payment_id IS NOT NULL
  AND je.economic_event_id IS NULL;

UPDATE public.journal_entries je
SET economic_event_id = je.reference_id::uuid
WHERE je.economic_event_id IS NULL
  AND je.reference_type = 'payment_adjustment'
  AND je.reference_id IS NOT NULL
  AND je.reference_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

UPDATE public.journal_entries je
SET economic_event_id = je.reference_id::uuid
WHERE je.economic_event_id IS NULL
  AND je.reference_id IS NOT NULL
  AND je.reference_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND je.reference_type IN (
    'sale', 'sale_adjustment', 'purchase', 'purchase_adjustment', 'expense', 'manual', 'journal'
  );

-- ---------------------------------------------------------------------------
-- 3) v_unified_transaction_feed — READ MODEL ONLY
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_unified_transaction_feed;

CREATE OR REPLACE VIEW public.v_unified_transaction_feed AS
WITH pay_acc AS (
  SELECT a.id, a.code, a.name
  FROM public.accounts a
)
SELECT
  p.company_id,
  p.branch_id,
  'payment'::text AS entity_type,
  p.id AS entity_id,
  p.id AS economic_event_id,
  p.contact_id,
  NULL::text AS document_no,
  p.reference_number AS reference_no,
  p.payment_date::date AS transaction_date,
  (p.created_at AT TIME ZONE 'UTC')::date AS posting_date,
  p.amount AS current_amount,
  CASE
    WHEN p.voided_at IS NOT NULL THEN 'voided'
    ELSE COALESCE(p.payment_type::text, 'posted')
  END AS status,
  p.payment_account_id AS current_account_id,
  pa.code AS current_account_code,
  pa.name AS current_account_name,
  'payments'::text AS source_table,
  p.id AS source_pk,
  (
    SELECT max(m)
    FROM (
      SELECT p.updated_at AS m
      UNION ALL
      SELECT tm.created_at FROM public.transaction_mutations tm
      WHERE tm.company_id = p.company_id AND tm.entity_type = 'payment' AND tm.entity_id = p.id
    ) x(m)
  ) AS last_mutation_at,
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.company_id = p.company_id
      AND COALESCE(je.is_void, false) = false
      AND (
        je.payment_id = p.id
        OR (je.reference_type = 'payment_adjustment' AND je.reference_id::text = p.id::text)
      )
      AND je.reference_type = 'payment_adjustment'
  ) AS has_adjustments,
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.company_id = p.company_id
      AND COALESCE(je.is_void, false) = false
      AND (
        je.payment_id = p.id
        OR (je.reference_type = 'payment_adjustment' AND je.reference_id::text = p.id::text)
      )
      AND je.reference_type IN ('correction_reversal', 'purchase_reversal')
  ) AS has_reversal,
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.company_id = p.company_id
      AND COALESCE(je.is_void, false) = false
      AND je.reference_type = 'payment_adjustment'
      AND je.reference_id::text = p.id::text
      AND je.action_fingerprint ILIKE 'payment_adjustment_account:%'
  ) AS has_transfer,
  p.created_at,
  p.updated_at
FROM public.payments p
LEFT JOIN pay_acc pa ON pa.id = p.payment_account_id

UNION ALL

SELECT
  s.company_id,
  s.branch_id,
  'sale'::text,
  s.id,
  s.id,
  s.customer_id,
  s.invoice_no,
  s.invoice_no,
  COALESCE(s.invoice_date, (s.created_at AT TIME ZONE 'UTC')::date),
  (s.created_at AT TIME ZONE 'UTC')::date,
  s.total,
  COALESCE(s.status::text, 'unknown'),
  NULL::uuid,
  NULL::text,
  NULL::text,
  'sales',
  s.id,
  GREATEST(
    s.updated_at,
    COALESCE(
      (SELECT max(tm.created_at) FROM public.transaction_mutations tm
       WHERE tm.company_id = s.company_id AND tm.entity_type = 'sale' AND tm.entity_id = s.id),
      s.updated_at
    )
  ),
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.company_id = s.company_id AND COALESCE(je.is_void, false) = false
      AND je.reference_type = 'sale_adjustment' AND je.reference_id::text = s.id::text
  ),
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.company_id = s.company_id AND COALESCE(je.is_void, false) = false
      AND je.reference_type IN ('sale_reversal', 'correction_reversal') AND je.reference_id::text = s.id::text
  ),
  false,
  s.created_at,
  s.updated_at
FROM public.sales s

UNION ALL

SELECT
  pu.company_id,
  pu.branch_id,
  'purchase'::text,
  pu.id,
  pu.id,
  pu.supplier_id,
  pu.po_no,
  pu.po_no,
  pu.po_date::date,
  (pu.created_at AT TIME ZONE 'UTC')::date,
  pu.total,
  COALESCE(pu.status::text, 'unknown'),
  NULL::uuid,
  NULL::text,
  NULL::text,
  'purchases',
  pu.id,
  GREATEST(
    pu.updated_at,
    COALESCE(
      (SELECT max(tm.created_at) FROM public.transaction_mutations tm
       WHERE tm.company_id = pu.company_id AND tm.entity_type = 'purchase' AND tm.entity_id = pu.id),
      pu.updated_at
    )
  ),
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.company_id = pu.company_id AND COALESCE(je.is_void, false) = false
      AND je.reference_type = 'purchase_adjustment' AND je.reference_id::text = pu.id::text
  ),
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.company_id = pu.company_id AND COALESCE(je.is_void, false) = false
      AND je.reference_type IN ('purchase_reversal', 'correction_reversal') AND je.reference_id::text = pu.id::text
  ),
  false,
  pu.created_at,
  pu.updated_at
FROM public.purchases pu

UNION ALL

SELECT
  e.company_id,
  e.branch_id,
  'expense'::text,
  e.id,
  e.id,
  NULL::uuid AS contact_id,
  e.expense_no,
  e.expense_no,
  e.expense_date::date,
  (e.created_at AT TIME ZONE 'UTC')::date,
  e.amount,
  COALESCE(e.status::text, 'unknown'),
  e.payment_account_id,
  ea.code,
  ea.name,
  'expenses',
  e.id,
  GREATEST(
    e.updated_at,
    COALESCE(
      (SELECT max(tm.created_at) FROM public.transaction_mutations tm
       WHERE tm.company_id = e.company_id AND tm.entity_type = 'expense' AND tm.entity_id = e.id),
      e.updated_at
    )
  ),
  false,
  false,
  false,
  e.created_at,
  e.updated_at
FROM public.expenses e
LEFT JOIN pay_acc ea ON ea.id = e.payment_account_id;

GRANT SELECT ON public.v_unified_transaction_feed TO authenticated;
GRANT SELECT, INSERT ON public.transaction_mutations TO authenticated;

COMMENT ON VIEW public.v_unified_transaction_feed IS
  'Phase 4 read model: union of payments, sales, purchases, expenses with adjustment flags. Not a write source.';

-- ---------------------------------------------------------------------------
-- 4) RLS (match enterprise payments pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE public.transaction_mutations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transaction_mutations_select_enterprise" ON public.transaction_mutations;
DROP POLICY IF EXISTS "transaction_mutations_insert_enterprise" ON public.transaction_mutations;

CREATE POLICY "transaction_mutations_select_enterprise"
  ON public.transaction_mutations FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (branch_id IS NULL OR EXISTS (
        SELECT 1 FROM public.user_branches ub
        WHERE ub.user_id = auth.uid() AND ub.branch_id = transaction_mutations.branch_id
      ))
    )
  );

CREATE POLICY "transaction_mutations_insert_enterprise"
  ON public.transaction_mutations FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (branch_id IS NULL OR EXISTS (
        SELECT 1 FROM public.user_branches ub
        WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id
      ))
    )
  );
