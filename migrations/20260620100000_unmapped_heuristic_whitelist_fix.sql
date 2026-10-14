-- Unmapped heuristic: exclude applied gl_correction JEs and rental payment rows with party sub-ledger.

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
        WHEN lower(COALESCE(l.reference_type, '')) = 'gl_correction'
          AND EXISTS (
            SELECT 1 FROM public.journal_entries je2
            WHERE je2.id = l.journal_entry_id
              AND COALESCE(je2.action_fingerprint, '') LIKE 'developer_repair:gl_correction:%'
          ) THEN FALSE
        WHEN lower(COALESCE(l.reference_type, '')) = 'payment'
          AND EXISTS (
            SELECT 1 FROM public.journal_entries je2
            INNER JOIN public.payments p ON p.id = je2.payment_id
            WHERE je2.id = l.journal_entry_id
              AND lower(trim(p.reference_type::text)) = 'rental'
          )
          AND EXISTS (
            SELECT 1 FROM public.accounts acc
            WHERE acc.id = l.account_id AND acc.linked_contact_id IS NOT NULL
          ) THEN FALSE
        WHEN lower(COALESCE(l.reference_type, '')) IN (
          'sale', 'sale_reversal', 'sale_adjustment', 'sale_extra_expense', 'sale_return',
          'credit_note', 'refund', 'manual_receipt', 'on_account', 'rental',
          'shipment', 'shipment_reversal', 'studio_production', 'studio_production_stage',
          'studio_production_stage_reversal', 'payment_adjustment',
          'opening_balance_contact_ar', 'gl_correction'
        ) THEN FALSE
        ELSE TRUE
      END
    WHEN l.control_bucket = 'AP' THEN
      CASE
        WHEN l.reference_id IS NULL THEN TRUE
        WHEN lower(COALESCE(l.reference_type, '')) IN (
          'purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal',
          'manual_payment', 'courier_payment', 'shipment', 'shipment_reversal',
          'payment_adjustment',
          'opening_balance_contact_ap',
          'opening_balance_contact_worker'
        ) THEN FALSE
        ELSE TRUE
      END
    ELSE FALSE
  END AS is_unmapped_heuristic
FROM lines l
WHERE l.control_bucket IS NOT NULL;

COMMENT ON VIEW public.v_reconciliation_ar_ap_line_audit IS
  'AR/AP control lines + heuristic unmapped flag. gl_correction repairs and rental payment+party sub-ledger excluded.';

NOTIFY pgrst, 'reload schema';
