-- AR/AP Reconciliation Center — repair workflows, AP vs Worker Payable split, party mapping audit, fix status.
-- Depends: 20260328, 20260329. Does not change TB formulas.

-- ---------------------------------------------------------------------------
-- Fix status on reconciliation items (extends “reviewed” workflow)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ar_ap_reconciliation_review_items
  ADD COLUMN IF NOT EXISTS fix_status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.ar_ap_reconciliation_review_items
  DROP CONSTRAINT IF EXISTS ar_ap_review_fix_status_chk;

ALTER TABLE public.ar_ap_reconciliation_review_items
  ADD CONSTRAINT ar_ap_review_fix_status_chk CHECK (fix_status IN (
    'new',
    'reviewed',
    'ready_to_post',
    'ready_to_relink',
    'ready_to_reverse_repost',
    'resolved'
  ));

-- Legacy rows already had reviewed_at / reviewed_by from the old “mark reviewed” flow.
UPDATE public.ar_ap_reconciliation_review_items
SET fix_status = 'reviewed', updated_at = NOW()
WHERE reviewed_at IS NOT NULL OR reviewed_by IS NOT NULL;

COMMENT ON COLUMN public.ar_ap_reconciliation_review_items.fix_status IS
  'Reconciliation Center workflow: new → reviewed / ready_* → resolved.';

CREATE OR REPLACE FUNCTION public.upsert_ar_ap_reconciliation_item(
  p_company_id UUID,
  p_item_kind TEXT,
  p_item_key TEXT,
  p_fix_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_fix_status IS NULL OR p_fix_status NOT IN (
    'new', 'reviewed', 'ready_to_post', 'ready_to_relink', 'ready_to_reverse_repost', 'resolved'
  ) THEN
    RAISE EXCEPTION 'Invalid fix_status';
  END IF;
  INSERT INTO public.ar_ap_reconciliation_review_items (
    company_id, item_kind, item_key, fix_status, reviewed_by, reviewed_at, updated_at
  )
  VALUES (
    p_company_id, p_item_kind, p_item_key, p_fix_status, auth.uid(), NOW(), NOW()
  )
  ON CONFLICT (company_id, item_key) DO UPDATE SET
    item_kind = EXCLUDED.item_kind,
    fix_status = EXCLUDED.fix_status,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_ar_ap_reconciliation_item(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_ar_ap_reconciliation_item(UUID, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_ar_ap_reconciliation_reviewed(
  p_company_id UUID,
  p_item_kind TEXT,
  p_item_key TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.upsert_ar_ap_reconciliation_item(p_company_id, p_item_kind, p_item_key, 'reviewed');
END;
$$;

-- ---------------------------------------------------------------------------
-- Auditable party ↔ journal mapping (prepare for party_contact_id on lines)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_party_contact_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  journal_line_id UUID REFERENCES public.journal_entry_lines(id) ON DELETE CASCADE,
  party_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  mapping_source TEXT NOT NULL DEFAULT 'reconciliation_lab',
  suggested_from TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.journal_party_contact_mapping IS
  'User-confirmed subledger party for a journal entry/line; audit trail before party_contact_id on lines.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_jpcm_line
  ON public.journal_party_contact_mapping(journal_line_id)
  WHERE journal_line_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_jpcm_entry_only
  ON public.journal_party_contact_mapping(journal_entry_id)
  WHERE journal_line_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_jpcm_company ON public.journal_party_contact_mapping(company_id);
CREATE INDEX IF NOT EXISTS idx_jpcm_je ON public.journal_party_contact_mapping(journal_entry_id);

ALTER TABLE public.journal_party_contact_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jpcm_select ON public.journal_party_contact_mapping;
DROP POLICY IF EXISTS jpcm_insert ON public.journal_party_contact_mapping;
DROP POLICY IF EXISTS jpcm_update ON public.journal_party_contact_mapping;
DROP POLICY IF EXISTS jpcm_delete ON public.journal_party_contact_mapping;

CREATE POLICY jpcm_select ON public.journal_party_contact_mapping FOR SELECT TO authenticated USING (true);
CREATE POLICY jpcm_insert ON public.journal_party_contact_mapping FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY jpcm_update ON public.journal_party_contact_mapping FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY jpcm_delete ON public.journal_party_contact_mapping FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_party_contact_mapping TO authenticated;
GRANT ALL ON public.journal_party_contact_mapping TO service_role;

-- ---------------------------------------------------------------------------
-- Unmapped journals: split supplier AP vs Worker Payable (2010 / name)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ar_ap_unmapped_journals AS
SELECT
  v.journal_entry_id,
  v.entry_no,
  v.entry_date,
  v.company_id,
  v.branch_id,
  v.journal_line_id,
  v.account_id,
  v.account_code,
  v.account_name,
  v.debit,
  v.credit,
  v.reference_type,
  v.reference_id,
  v.control_bucket,
  CASE
    WHEN v.control_bucket = 'AP' THEN
      CASE
        WHEN trim(COALESCE(v.account_code, '')) = '2010' THEN 'worker'
        WHEN lower(COALESCE(v.account_name, '')) LIKE '%worker payable%' THEN 'worker'
        ELSE 'supplier'
      END
    ELSE NULL
  END AS ap_sub_bucket,
  CASE
    WHEN v.reference_id IS NULL THEN 'missing_reference'
    WHEN v.control_bucket = 'AR' AND lower(trim(COALESCE(v.reference_type, ''))) IN (
      'sale', 'sale_reversal', 'sale_adjustment', 'sale_extra_expense', 'sale_return',
      'credit_note', 'refund', 'manual_receipt', 'on_account', 'rental',
      'shipment', 'shipment_reversal', 'studio_production', 'studio_production_stage',
      'studio_production_stage_reversal', 'payment_adjustment'
    ) THEN 'reference_whitelist_no_party_on_line'
    WHEN v.control_bucket = 'AP' AND lower(trim(COALESCE(v.reference_type, ''))) IN (
      'purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal',
      'manual_payment', 'courier_payment', 'shipment', 'shipment_reversal',
      'payment_adjustment'
    ) THEN 'reference_whitelist_no_party_on_line'
    ELSE 'unclassified_reference'
  END AS contact_mapping_status,
  CASE
    WHEN v.reference_id IS NULL THEN 'Journal entry has no reference_id; cannot tie to a document or party.'
    WHEN v.control_bucket = 'AR' AND lower(trim(COALESCE(v.reference_type, ''))) IN (
      'sale', 'sale_reversal', 'sale_adjustment', 'sale_extra_expense', 'sale_return',
      'credit_note', 'refund', 'manual_receipt', 'on_account', 'rental',
      'shipment', 'shipment_reversal', 'studio_production', 'studio_production_stage',
      'studio_production_stage_reversal', 'payment_adjustment'
    ) THEN 'Reference type is known for AR but journal lines have no party_contact_id yet.'
    WHEN v.control_bucket = 'AP' AND lower(trim(COALESCE(v.reference_type, ''))) IN (
      'purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal',
      'manual_payment', 'courier_payment', 'shipment', 'shipment_reversal',
      'payment_adjustment'
    ) THEN 'Reference type is known for AP but journal lines have no party_contact_id yet.'
    ELSE 'Reference type is not on the AR/AP whitelist; subledger mapping uncertain.'
  END AS reason
FROM public.v_reconciliation_ar_ap_line_audit v
WHERE v.is_unmapped_heuristic = TRUE;

COMMENT ON VIEW public.v_ar_ap_unmapped_journals IS
  'Unmapped AR/AP lines; ap_sub_bucket = supplier | worker for AP (2010 / Worker Payable name).';

GRANT SELECT ON public.v_ar_ap_unmapped_journals TO authenticated;
GRANT SELECT ON public.v_ar_ap_unmapped_journals TO service_role;

-- ---------------------------------------------------------------------------
-- Distinct JE counts: AR, supplier-AP, worker-payable-AP
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_unmapped_ar_ap_journal_entries_split(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  ar_unmapped_entry_count BIGINT,
  ap_supplier_unmapped_entry_count BIGINT,
  ap_worker_unmapped_entry_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    SELECT
      v.journal_entry_id,
      v.control_bucket,
      CASE
        WHEN v.control_bucket = 'AP' THEN
          CASE
            WHEN trim(COALESCE(v.account_code, '')) = '2010' THEN 'worker'
            WHEN lower(COALESCE(v.account_name, '')) LIKE '%worker payable%' THEN 'worker'
            ELSE 'supplier'
          END
        ELSE NULL
      END AS ap_sub_bucket
    FROM public.v_reconciliation_ar_ap_line_audit v
    WHERE v.company_id = p_company_id
      AND v.entry_date <= p_as_of_date
      AND v.is_unmapped_heuristic = TRUE
      AND (
        p_branch_id IS NULL
        OR (v.branch_id IS NOT NULL AND v.branch_id = p_branch_id)
      )
  )
  SELECT
    (SELECT COUNT(DISTINCT journal_entry_id) FROM u WHERE control_bucket = 'AR')::BIGINT,
    (SELECT COUNT(DISTINCT journal_entry_id) FROM u WHERE control_bucket = 'AP' AND ap_sub_bucket = 'supplier')::BIGINT,
    (SELECT COUNT(DISTINCT journal_entry_id) FROM u WHERE control_bucket = 'AP' AND ap_sub_bucket = 'worker')::BIGINT;
$$;

COMMENT ON FUNCTION public.count_unmapped_ar_ap_journal_entries_split(UUID, UUID, DATE) IS
  'Distinct JEs with unmapped-heuristic lines, split: AR vs supplier AP vs worker payable AP.';

GRANT EXECUTE ON FUNCTION public.count_unmapped_ar_ap_journal_entries_split(UUID, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_unmapped_ar_ap_journal_entries_split(UUID, UUID, DATE) TO service_role;

-- ---------------------------------------------------------------------------
-- Snapshot: add supplier vs worker unmapped counts (keep total AP = sum for compat)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ar_ap_integrity_lab_snapshot(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  gl_ar_net_dr_minus_cr NUMERIC,
  gl_ap_net_credit NUMERIC,
  unposted_document_count BIGINT,
  unmapped_ar_je_count BIGINT,
  unmapped_ap_je_count BIGINT,
  unmapped_ap_supplier_je_count BIGINT,
  unmapped_ap_worker_je_count BIGINT,
  manual_adjustment_je_count BIGINT,
  suspense_net_balance NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gl AS (
    SELECT
      SUM(CASE WHEN v.control_bucket = 'AR' THEN v.debit - v.credit ELSE 0 END)::numeric AS ar_net,
      SUM(CASE WHEN v.control_bucket = 'AP' THEN v.credit - v.debit ELSE 0 END)::numeric AS ap_net
    FROM public.v_reconciliation_ar_ap_line_audit v
    WHERE v.company_id = p_company_id
      AND v.entry_date <= p_as_of_date
      AND (
        p_branch_id IS NULL
        OR (v.branch_id IS NOT NULL AND v.branch_id = p_branch_id)
      )
  ),
  unposted AS (
    SELECT COUNT(*)::bigint AS c
    FROM public.v_ar_ap_unposted_documents u
    WHERE u.company_id = p_company_id
      AND (p_branch_id IS NULL OR u.branch_id = p_branch_id)
      AND u.document_date <= p_as_of_date
  ),
  unmap AS (
    SELECT
      s.ar_unmapped_entry_count::bigint AS ar_c,
      s.ap_supplier_unmapped_entry_count::bigint AS ap_sup,
      s.ap_worker_unmapped_entry_count::bigint AS ap_w
    FROM public.count_unmapped_ar_ap_journal_entries_split(p_company_id, p_branch_id, p_as_of_date) s
  ),
  manual AS (
    SELECT COUNT(DISTINCT m.journal_entry_id)::bigint AS c
    FROM public.v_ar_ap_manual_adjustments m
    WHERE m.company_id = p_company_id
      AND m.entry_date <= p_as_of_date
      AND (
        p_branch_id IS NULL
        OR (m.branch_id IS NOT NULL AND m.branch_id = p_branch_id)
      )
  ),
  susp AS (
    SELECT COALESCE(SUM(jel.debit - jel.credit), 0)::numeric AS bal
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN public.accounts a ON a.id = jel.account_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND je.entry_date <= p_as_of_date
      AND (
        p_branch_id IS NULL
        OR (je.branch_id IS NOT NULL AND je.branch_id = p_branch_id)
      )
      AND (
        trim(COALESCE(a.code, '')) = '1195'
        OR lower(COALESCE(a.name, '')) LIKE '%ar/ap reconciliation suspense%'
      )
  )
  SELECT
    (SELECT ar_net FROM gl),
    (SELECT ap_net FROM gl),
    (SELECT c FROM unposted),
    (SELECT ar_c FROM unmap),
    (SELECT COALESCE(ap_sup, 0) + COALESCE(ap_w, 0) FROM unmap),
    (SELECT ap_sup FROM unmap),
    (SELECT ap_w FROM unmap),
    (SELECT c FROM manual),
    (SELECT bal FROM susp);
$$;

COMMENT ON FUNCTION public.ar_ap_integrity_lab_snapshot(UUID, UUID, DATE) IS
  'Lab metrics; unmapped_ap_je_count = supplier + worker; split columns for UI sections.';
