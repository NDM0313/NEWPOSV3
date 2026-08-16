-- Phase 1.6.1 — branch attribution risk rows with JE lines, accounts, payments
WITH risk AS (
  SELECT
    r.company_id,
    r.journal_entry_id,
    r.entry_no,
    r.entry_date,
    r.reference_type,
    r.reference_id,
    r.payment_id,
    r.branch_id AS current_je_branch_id,
    r.description
  FROM v_single_core_ledger_branch_attribution_risk r
  WHERE ($1::uuid IS NULL OR r.company_id = $1::uuid)
),
line_agg AS (
  SELECT
    jel.journal_entry_id,
    COALESCE(MAX(jel.debit), 0) AS max_debit,
    COALESCE(MAX(jel.credit), 0) AS max_credit,
    GREATEST(COALESCE(SUM(jel.debit), 0), COALESCE(SUM(jel.credit), 0)) AS total_amount,
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'account_id', a.id,
        'code', a.code,
        'name', a.name,
        'branch_id', a.branch_id,
        'debit', jel.debit,
        'credit', jel.credit
      )
    ) FILTER (WHERE jel.debit > 0) AS debit_lines,
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'account_id', a.id,
        'code', a.code,
        'name', a.name,
        'branch_id', a.branch_id,
        'debit', jel.debit,
        'credit', jel.credit
      )
    ) FILTER (WHERE jel.credit > 0) AS credit_lines
  FROM journal_entry_lines jel
  INNER JOIN risk rk ON rk.journal_entry_id = jel.journal_entry_id
  LEFT JOIN accounts a ON a.id = jel.account_id
  GROUP BY jel.journal_entry_id
),
payment_link AS (
  SELECT DISTINCT ON (rk.journal_entry_id)
    rk.journal_entry_id,
    p.id AS linked_payment_id,
    p.branch_id AS payment_branch_id,
    p.reference_type AS payment_reference_type,
    p.reference_id AS payment_reference_id,
    p.reference_number AS payment_reference_number
  FROM risk rk
  LEFT JOIN payments p ON p.company_id = rk.company_id AND p.voided_at IS NULL
    AND (
      p.id = rk.payment_id
      OR (
        LOWER(TRIM(COALESCE(rk.reference_type, ''))) IN ('payment', 'payment_adjustment', 'manual_payment')
        AND p.id = rk.reference_id
      )
      OR (
        LOWER(TRIM(COALESCE(rk.reference_type, ''))) = 'manual_receipt'
        AND LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'manual_receipt'
        AND p.reference_id = rk.reference_id
      )
    )
  ORDER BY rk.journal_entry_id, p.payment_date DESC NULLS LAST, p.created_at DESC NULLS LAST
)
SELECT
  co.id AS company_id,
  co.name AS company_name,
  rk.journal_entry_id,
  rk.entry_no,
  rk.entry_date,
  rk.reference_type,
  rk.reference_id,
  rk.current_je_branch_id,
  rk.description,
  je.created_by,
  u.email AS created_by_email,
  la.total_amount,
  la.max_debit,
  la.max_credit,
  la.debit_lines,
  la.credit_lines,
  pl.linked_payment_id,
  pl.payment_branch_id,
  pl.payment_reference_type,
  pl.payment_reference_id,
  pl.payment_reference_number
FROM risk rk
INNER JOIN companies co ON co.id = rk.company_id
INNER JOIN journal_entries je ON je.id = rk.journal_entry_id
LEFT JOIN users u ON u.id = je.created_by
LEFT JOIN line_agg la ON la.journal_entry_id = rk.journal_entry_id
LEFT JOIN payment_link pl ON pl.journal_entry_id = rk.journal_entry_id
ORDER BY co.name, rk.entry_date DESC NULLS LAST, rk.entry_no;
