-- Phase 1: Read-only AR/AP reconciliation audit (journal lines on control accounts).
-- Does NOT change TB; does not overwrite Contacts operational balances.
-- "Unmapped" = heuristic: reference_type/reference_id cannot be classified as a known document/customer/supplier path (see CASE below).
-- Branch: p_branch_id NULL = all branches; UUID = only journal_entries.branch_id = p_branch_id (NULL branch on JE excluded when filtering).

CREATE OR REPLACE VIEW public.v_reconciliation_ar_ap_line_audit AS
WITH lines AS (
  SELECT
    je.company_id,
    je.branch_id,
    je.id AS journal_entry_id,
    je.entry_no,
    je.entry_date,
    je.reference_type,
    je.reference_id,
    jel.id AS journal_line_id,
    jel.account_id,
    a.code AS account_code,
    a.name AS account_name,
    a.type AS account_type,
    jel.debit,
    jel.credit,
    CASE
      WHEN trim(COALESCE(a.code, '')) = '1100' THEN 'AR'
      WHEN trim(COALESCE(a.code, '')) = '2000' THEN 'AP'
      WHEN lower(COALESCE(a.name, '')) LIKE '%receivable%'
        AND lower(COALESCE(a.type, '')) LIKE '%asset%' THEN 'AR'
      WHEN lower(COALESCE(a.name, '')) LIKE '%payable%'
        AND lower(COALESCE(a.type, '')) LIKE '%liab%' THEN 'AP'
      ELSE NULL
    END AS control_bucket
  FROM public.journal_entry_lines jel
  INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  INNER JOIN public.accounts a ON a.id = jel.account_id AND COALESCE(a.is_active, TRUE) = TRUE
  WHERE COALESCE(je.is_void, FALSE) = FALSE
)
SELECT
  l.*,
  CASE
    WHEN l.control_bucket = 'AR' THEN
      CASE
        WHEN l.reference_id IS NULL THEN TRUE
        WHEN lower(COALESCE(l.reference_type, '')) IN (
          'sale', 'sale_reversal', 'sale_adjustment', 'sale_extra_expense', 'sale_return',
          'credit_note', 'refund', 'manual_receipt', 'on_account', 'rental',
          'shipment', 'shipment_reversal', 'studio_production', 'studio_production_stage',
          'studio_production_stage_reversal', 'payment_adjustment'
        ) THEN FALSE
        ELSE TRUE
      END
    WHEN l.control_bucket = 'AP' THEN
      CASE
        WHEN l.reference_id IS NULL THEN TRUE
        WHEN lower(COALESCE(l.reference_type, '')) IN (
          'purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal',
          'manual_payment', 'courier_payment', 'shipment', 'shipment_reversal',
          'payment_adjustment'
        ) THEN FALSE
        ELSE TRUE
      END
    ELSE FALSE
  END AS is_unmapped_heuristic
FROM lines l
WHERE l.control_bucket IS NOT NULL;

COMMENT ON VIEW public.v_reconciliation_ar_ap_line_audit IS
  'AR/AP control lines + heuristic unmapped flag (JE reference only). party_contact_id not used. Read-only.';

GRANT SELECT ON public.v_reconciliation_ar_ap_line_audit TO authenticated;
GRANT SELECT ON public.v_reconciliation_ar_ap_line_audit TO service_role;

CREATE OR REPLACE FUNCTION public.count_unmapped_ar_ap_journal_entries(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  ar_unmapped_entry_count BIGINT,
  ap_unmapped_entry_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT v.journal_entry_id, v.control_bucket
    FROM public.v_reconciliation_ar_ap_line_audit v
    WHERE v.company_id = p_company_id
      AND v.entry_date <= p_as_of_date
      AND (
        p_branch_id IS NULL
        OR (v.branch_id IS NOT NULL AND v.branch_id = p_branch_id)
      )
      AND v.is_unmapped_heuristic = TRUE
  )
  SELECT
    (SELECT COUNT(DISTINCT journal_entry_id) FROM filtered WHERE control_bucket = 'AR')::BIGINT,
    (SELECT COUNT(DISTINCT journal_entry_id) FROM filtered WHERE control_bucket = 'AP')::BIGINT;
$$;

COMMENT ON FUNCTION public.count_unmapped_ar_ap_journal_entries(UUID, UUID, DATE) IS
  'Distinct non-void JEs with unmapped-heuristic AR/AP lines, through p_as_of_date.';

GRANT EXECUTE ON FUNCTION public.count_unmapped_ar_ap_journal_entries(UUID, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_unmapped_ar_ap_journal_entries(UUID, UUID, DATE) TO service_role;
