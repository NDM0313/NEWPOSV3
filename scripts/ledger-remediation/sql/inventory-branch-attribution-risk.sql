-- Branch attribution risk detail (all transactional NULL branch_id JEs)
SELECT
  r.company_id,
  co.name AS company_name,
  r.journal_entry_id,
  r.entry_no,
  r.entry_date,
  r.reference_type,
  r.reference_id,
  r.payment_id,
  r.branch_id AS current_je_branch_id,
  r.description
FROM v_single_core_ledger_branch_attribution_risk r
INNER JOIN companies co ON co.id = r.company_id
WHERE ($1::uuid IS NULL OR r.company_id = $1::uuid)
ORDER BY co.name, r.entry_date DESC NULLS LAST, r.entry_no;
