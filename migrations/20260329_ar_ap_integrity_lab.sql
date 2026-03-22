-- AR/AP Reconciliation Center — read-only views + review workflow + suspense account helper.
-- Depends: v_reconciliation_ar_ap_line_audit (20260328_ar_ap_reconciliation_layer.sql).
-- Does NOT change Trial Balance formulas; does not force-match operational vs GL.

-- ---------------------------------------------------------------------------
-- Review marks (per user; visible until cleared by deleting row or re-review)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ar_ap_reconciliation_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL,
  item_key TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID,
  CONSTRAINT ar_ap_review_unique UNIQUE (company_id, item_key)
);

COMMENT ON TABLE public.ar_ap_reconciliation_review_items IS
  'AR/AP Integrity Lab: user-marked reviewed rows (item_key e.g. sale:<uuid>, je:<uuid>).';

CREATE INDEX IF NOT EXISTS idx_ar_ap_review_company ON public.ar_ap_reconciliation_review_items(company_id);

ALTER TABLE public.ar_ap_reconciliation_review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ar_ap_review_select ON public.ar_ap_reconciliation_review_items;
DROP POLICY IF EXISTS ar_ap_review_insert ON public.ar_ap_reconciliation_review_items;
DROP POLICY IF EXISTS ar_ap_review_update ON public.ar_ap_reconciliation_review_items;
DROP POLICY IF EXISTS ar_ap_review_delete ON public.ar_ap_reconciliation_review_items;

-- Authenticated users: tighten to your company model if needed (e.g. profiles.company_id).
CREATE POLICY ar_ap_review_select ON public.ar_ap_reconciliation_review_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY ar_ap_review_insert ON public.ar_ap_reconciliation_review_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY ar_ap_review_update ON public.ar_ap_reconciliation_review_items
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY ar_ap_review_delete ON public.ar_ap_reconciliation_review_items
  FOR DELETE TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_ap_reconciliation_review_items TO authenticated;
GRANT ALL ON public.ar_ap_reconciliation_review_items TO service_role;

-- ---------------------------------------------------------------------------
-- Dedicated suspense account (1195) — create per company on demand via function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_ar_ap_reconciliation_suspense_account(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT a.id INTO v_id
  FROM public.accounts a
  WHERE a.company_id = p_company_id AND trim(a.code) = '1195'
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  INSERT INTO public.accounts (company_id, code, name, type, is_active)
  VALUES (
    p_company_id,
    '1195',
    'AR/AP Reconciliation Suspense',
    'asset',
    TRUE
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_ar_ap_reconciliation_suspense_account(UUID) IS
  'Idempotent: ensures code 1195 AR/AP Reconciliation Suspense exists; use only from explicit UI/API, never silently.';

GRANT EXECUTE ON FUNCTION public.ensure_ar_ap_reconciliation_suspense_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ar_ap_reconciliation_suspense_account(UUID) TO service_role;

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
  INSERT INTO public.ar_ap_reconciliation_review_items (company_id, item_kind, item_key, reviewed_by)
  VALUES (p_company_id, p_item_kind, p_item_key, auth.uid())
  ON CONFLICT (company_id, item_key) DO UPDATE SET
    reviewed_at = NOW(),
    reviewed_by = auth.uid(),
    item_kind = EXCLUDED.item_kind;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_ar_ap_reconciliation_reviewed(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_ar_ap_reconciliation_reviewed(UUID, TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- A) Operational totals from open sales/purchases (subset of Contacts RPC)
--    Excludes: contact opening balances, worker payables from worker_ledger — see UI note.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ar_ap_operational_totals AS
WITH recv AS (
  SELECT
    s.company_id,
    s.branch_id,
    SUM(GREATEST(0, COALESCE(s.due_amount, (COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0)))::numeric)) AS operational_receivables
  FROM public.sales s
  WHERE (s.status IS NULL OR s.status::text <> 'cancelled')
  GROUP BY s.company_id, s.branch_id
),
pay AS (
  SELECT
    p.company_id,
    p.branch_id,
    SUM(GREATEST(0, COALESCE(p.due_amount, (COALESCE(p.total, 0) - COALESCE(p.paid_amount, 0)))::numeric)) AS operational_payables
  FROM public.purchases p
  GROUP BY p.company_id, p.branch_id
)
SELECT
  COALESCE(r.company_id, p.company_id) AS company_id,
  COALESCE(r.branch_id, p.branch_id) AS branch_id,
  COALESCE(r.operational_receivables, 0)::numeric AS operational_receivables,
  COALESCE(p.operational_payables, 0)::numeric AS operational_payables
FROM recv r
FULL OUTER JOIN pay p ON r.company_id = p.company_id AND r.branch_id IS NOT DISTINCT FROM p.branch_id;

COMMENT ON VIEW public.v_ar_ap_operational_totals IS
  'Open-document AR/AP from sales/purchases only; full Contacts totals may differ (openings, workers).';

GRANT SELECT ON public.v_ar_ap_operational_totals TO authenticated;
GRANT SELECT ON public.v_ar_ap_operational_totals TO service_role;

-- ---------------------------------------------------------------------------
-- B) GL control totals (lifetime, all non-void journals) — same buckets as reconciliation audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ar_ap_gl_control_totals AS
SELECT
  v.company_id,
  v.branch_id,
  SUM(CASE WHEN v.control_bucket = 'AR' THEN v.debit - v.credit ELSE 0 END)::numeric AS gl_ar_net_dr_minus_cr,
  SUM(CASE WHEN v.control_bucket = 'AP' THEN v.credit - v.debit ELSE 0 END)::numeric AS gl_ap_net_credit
FROM public.v_reconciliation_ar_ap_line_audit v
GROUP BY v.company_id, v.branch_id;

COMMENT ON VIEW public.v_ar_ap_gl_control_totals IS
  'Lifetime GL on AR/AP control lines (non-void). For as-of TB match, filter lines by entry_date in app or use ar_ap_integrity_lab_snapshot RPC.';

GRANT SELECT ON public.v_ar_ap_gl_control_totals TO authenticated;
GRANT SELECT ON public.v_ar_ap_gl_control_totals TO service_role;

-- ---------------------------------------------------------------------------
-- C) Variance (operational open docs vs lifetime GL — informational; can diverge from TB as-of)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ar_ap_variance_summary AS
SELECT
  COALESCE(o.company_id, g.company_id) AS company_id,
  COALESCE(o.branch_id, g.branch_id) AS branch_id,
  COALESCE(o.operational_receivables, 0)::numeric AS operational_receivables,
  COALESCE(o.operational_payables, 0)::numeric AS operational_payables,
  COALESCE(g.gl_ar_net_dr_minus_cr, 0)::numeric AS gl_ar_net_dr_minus_cr,
  COALESCE(g.gl_ap_net_credit, 0)::numeric AS gl_ap_net_credit,
  (COALESCE(o.operational_receivables, 0) - COALESCE(g.gl_ar_net_dr_minus_cr, 0))::numeric AS receivables_variance,
  (COALESCE(o.operational_payables, 0) - COALESCE(g.gl_ap_net_credit, 0))::numeric AS payables_variance
FROM public.v_ar_ap_operational_totals o
FULL OUTER JOIN public.v_ar_ap_gl_control_totals g
  ON o.company_id = g.company_id AND o.branch_id IS NOT DISTINCT FROM g.branch_id;

COMMENT ON VIEW public.v_ar_ap_variance_summary IS
  'Open-doc operational vs lifetime GL; not a substitute for dated TB vs get_contact_balances_summary.';

GRANT SELECT ON public.v_ar_ap_variance_summary TO authenticated;
GRANT SELECT ON public.v_ar_ap_variance_summary TO service_role;

-- ---------------------------------------------------------------------------
-- D) Unposted documents (no non-void sale/purchase journal by reference)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ar_ap_unposted_documents AS
SELECT
  'sale'::text AS source_type,
  s.id AS source_id,
  s.invoice_no AS document_no,
  s.customer_id AS contact_id,
  s.customer_name AS contact_name,
  (GREATEST(0, COALESCE(s.due_amount, (COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0)))::numeric)) AS amount,
  s.branch_id,
  s.invoice_date::date AS document_date,
  s.company_id,
  'No non-void journal with reference_type=sale and reference_id=this sale'::text AS reason
FROM public.sales s
WHERE (s.status IS NULL OR s.status::text <> 'cancelled')
  AND COALESCE(s.total, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.journal_entries je
    WHERE je.company_id = s.company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND lower(trim(COALESCE(je.reference_type, ''))) = 'sale'
      AND je.reference_id = s.id
  )
UNION ALL
SELECT
  'purchase'::text AS source_type,
  p.id AS source_id,
  p.po_no AS document_no,
  p.supplier_id AS contact_id,
  p.supplier_name AS contact_name,
  (GREATEST(0, COALESCE(p.due_amount, (COALESCE(p.total, 0) - COALESCE(p.paid_amount, 0)))::numeric)) AS amount,
  p.branch_id,
  p.po_date::date AS document_date,
  p.company_id,
  'No non-void journal with reference_type=purchase and reference_id=this purchase'::text AS reason
FROM public.purchases p
WHERE COALESCE(p.total, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.journal_entries je
    WHERE je.company_id = p.company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND lower(trim(COALESCE(je.reference_type, ''))) = 'purchase'
      AND je.reference_id = p.id
  );

COMMENT ON VIEW public.v_ar_ap_unposted_documents IS
  'Sales/purchases with no matching non-void document journal; investigate before posting.';

GRANT SELECT ON public.v_ar_ap_unposted_documents TO authenticated;
GRANT SELECT ON public.v_ar_ap_unposted_documents TO service_role;

-- ---------------------------------------------------------------------------
-- E) Unmapped AR/AP journal lines (heuristic from JE reference only)
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
  'AR/AP control lines flagged unmapped by reference heuristic; party_contact_id not used.';

GRANT SELECT ON public.v_ar_ap_unmapped_journals TO authenticated;
GRANT SELECT ON public.v_ar_ap_unmapped_journals TO service_role;

-- ---------------------------------------------------------------------------
-- F) Manual / tagged reconciliation journals (suspense 1195, tag, or reference_type)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ar_ap_manual_adjustments AS
SELECT
  je.id AS journal_entry_id,
  je.company_id,
  je.branch_id,
  je.entry_no,
  je.entry_date,
  je.description,
  je.reference_type,
  je.reference_id,
  je.created_by,
  je.created_at,
  COALESCE(
    (
      SELECT SUM((jel.debit - jel.credit)::numeric)
      FROM public.journal_entry_lines jel
      INNER JOIN public.accounts a ON a.id = jel.account_id
      WHERE jel.journal_entry_id = je.id
        AND (
          trim(COALESCE(a.code, '')) = '1195'
          OR lower(COALESCE(a.name, '')) LIKE '%ar/ap reconciliation suspense%'
          OR lower(COALESCE(a.name, '')) LIKE '%reconciliation suspense%'
        )
    ),
    0::numeric
  ) AS suspense_net_dr_minus_cr,
  CASE
    WHEN je.reference_type = 'ar_ap_reconciliation' OR je.description LIKE '%[AR_AP_RECON]%' THEN 'tagged_reconciliation'
    WHEN EXISTS (
      SELECT 1 FROM public.journal_entry_lines jel2
      INNER JOIN public.accounts a2 ON a2.id = jel2.account_id
      WHERE jel2.journal_entry_id = je.id
        AND (
          trim(COALESCE(a2.code, '')) = '1195'
          OR lower(COALESCE(a2.name, '')) LIKE '%reconciliation suspense%'
        )
    ) THEN 'suspense_account'
    ELSE 'other'
  END AS detection_kind,
  'posted'::text AS status
FROM public.journal_entries je
WHERE COALESCE(je.is_void, FALSE) = FALSE
  AND (
    je.reference_type = 'ar_ap_reconciliation'
    OR je.description LIKE '%[AR_AP_RECON]%'
    OR EXISTS (
      SELECT 1
      FROM public.journal_entry_lines jel
      INNER JOIN public.accounts a ON a.id = jel.account_id
      WHERE jel.journal_entry_id = je.id
        AND (
          trim(COALESCE(a.code, '')) = '1195'
          OR lower(COALESCE(a.name, '')) LIKE '%ar/ap reconciliation suspense%'
        )
    )
  );

COMMENT ON VIEW public.v_ar_ap_manual_adjustments IS
  'Tagged reconciliation journals: reference_type ar_ap_reconciliation, [AR_AP_RECON] in description, or lines on suspense 1195 / name match.';

GRANT SELECT ON public.v_ar_ap_manual_adjustments TO authenticated;
GRANT SELECT ON public.v_ar_ap_manual_adjustments TO service_role;

-- ---------------------------------------------------------------------------
-- G) Parameterized snapshot for lab summary cards (as-of GL + counts)
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
      u.ar_unmapped_entry_count::bigint AS ar_c,
      u.ap_unmapped_entry_count::bigint AS ap_c
    FROM public.count_unmapped_ar_ap_journal_entries(p_company_id, p_branch_id, p_as_of_date) u
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
    (SELECT ap_c FROM unmap),
    (SELECT c FROM manual),
    (SELECT bal FROM susp);
$$;

COMMENT ON FUNCTION public.ar_ap_integrity_lab_snapshot(UUID, UUID, DATE) IS
  'Summary metrics for AR/AP Integrity Lab; GL as-of p_as_of_date; unmapped = distinct JEs (count_unmapped_ar_ap_journal_entries).';

GRANT EXECUTE ON FUNCTION public.ar_ap_integrity_lab_snapshot(UUID, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ar_ap_integrity_lab_snapshot(UUID, UUID, DATE) TO service_role;
