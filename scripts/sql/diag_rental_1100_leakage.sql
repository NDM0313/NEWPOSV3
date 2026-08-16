-- Diagnostic: rental / mobile GL rows posted to AR control (1100) instead of AR-CUS* sub-ledgers.
-- Read-only. Use results with Hybrid Repair / GL correction (see arControlOrphanRepair.ts).

-- 0) Control 1100 net trial balance (journal lines, non-void)
WITH co AS (SELECT id FROM companies WHERE name ILIKE '%DIN BRIDAL%' LIMIT 1),
ctrl AS (
  SELECT a.id FROM accounts a, co
  WHERE a.company_id = co.id AND trim(COALESCE(a.code, '')) = '1100' LIMIT 1
)
SELECT round(COALESCE(SUM(jel.debit - jel.credit), 0), 2) AS control_1100_net_tb
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN ctrl ON jel.account_id = ctrl.id
WHERE je.company_id = (SELECT id FROM co) AND COALESCE(je.is_void, false) = false;

-- 0b) Party sub-ledger vs control (Hasseb / Inayat sample)
WITH co AS (SELECT id FROM companies WHERE name ILIKE '%DIN BRIDAL%' LIMIT 1)
SELECT c.name, round(b.gl_ar_receivable, 2) AS party_signed_ar
FROM get_contact_party_gl_balances((SELECT id FROM co), NULL, CURRENT_DATE) b
JOIN contacts c ON c.id = b.contact_id
WHERE c.name ILIKE '%haseeb%' OR c.name ILIKE '%inayat%'
ORDER BY c.name;

-- 1) Rental revenue JEs on 1100 with a named customer
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id AS rental_id,
  r.booking_no,
  r.customer_id,
  c.name AS customer_name,
  a.code AS ar_account_code,
  a.name AS ar_account_name,
  jel.id AS journal_line_id,
  jel.debit,
  jel.credit,
  EXISTS (
    SELECT 1 FROM journal_entries corr
    WHERE corr.action_fingerprint = 'developer_repair:gl_correction:rental-1100-leakage:' || jel.id::text
      AND COALESCE(corr.is_void, false) = false
  ) AS repair_applied
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
LEFT JOIN rentals r ON r.id = je.reference_id AND je.reference_type = 'rental'
LEFT JOIN contacts c ON c.id = r.customer_id
WHERE trim(COALESCE(a.code, '')) = '1100'
  AND COALESCE(je.is_void, false) = false
  AND (
    (je.reference_type = 'rental' AND r.customer_id IS NOT NULL)
    OR (
      je.reference_type = 'payment'
      AND EXISTS (
        SELECT 1 FROM payments p
        WHERE p.id = je.payment_id
          AND p.reference_type = 'rental'
          AND p.contact_id IS NOT NULL
      )
    )
  )
ORDER BY je.entry_date DESC, je.created_at DESC;

-- 2) rental_payments without linked JE but payments row exists (D4 dual-stream gap)
SELECT
  rp.id AS rental_payment_id,
  rp.rental_id,
  rp.amount,
  rp.payment_date,
  rp.payment_type,
  rp.journal_entry_id,
  p.id AS payments_id,
  p.reference_number,
  je.id AS payment_je_id
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
LEFT JOIN payments p ON p.reference_type = 'rental'
  AND p.reference_id = rp.rental_id
  AND p.amount = rp.amount
  AND p.payment_date = rp.payment_date
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE rp.journal_entry_id IS NULL
  AND je.id IS NOT NULL
ORDER BY rp.payment_date DESC;

-- 3) Trial balance control vs sub-ledger residual (informational)
SELECT
  ctrl.company_id,
  ctrl.id AS control_account_id,
  ctrl.code,
  ctrl.balance AS control_balance,
  COALESCE(SUM(sub.balance), 0) AS sub_ledger_sum,
  ctrl.balance - COALESCE(SUM(sub.balance), 0) AS unmapped_residual
FROM accounts ctrl
LEFT JOIN accounts sub ON sub.parent_id = ctrl.id
  AND sub.linked_contact_id IS NOT NULL
  AND COALESCE(sub.is_active, true)
WHERE trim(COALESCE(ctrl.code, '')) = '1100'
  AND COALESCE(ctrl.is_active, true)
GROUP BY ctrl.company_id, ctrl.id, ctrl.code, ctrl.balance;

-- 4) Count eligible vs already corrected (Phase D)
SELECT
  'eligible' AS bucket,
  count(*)::int AS line_count,
  coalesce(sum(GREATEST(jel.debit, jel.credit)), 0) AS total_amount
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id AND trim(a.code) = '1100'
LEFT JOIN rentals r ON je.reference_type = 'rental' AND je.reference_id = r.id
LEFT JOIN payments pay ON je.payment_id = pay.id
WHERE COALESCE(je.is_void, false) = false
  AND GREATEST(COALESCE(jel.debit, 0), COALESCE(jel.credit, 0)) > 0.001
  AND (
    (je.reference_type = 'rental' AND r.customer_id IS NOT NULL)
    OR (lower(trim(COALESCE(je.reference_type, ''))) = 'payment' AND pay.reference_type = 'rental' AND pay.contact_id IS NOT NULL)
  )
  AND trim(COALESCE(je.entry_no, '')) NOT IN ('JE-0160', 'JE-0161')
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries corr
    WHERE corr.action_fingerprint = 'developer_repair:gl_correction:rental-1100-leakage:' || jel.id::text
      AND COALESCE(corr.is_void, false) = false
  )
UNION ALL
SELECT
  'corrected' AS bucket,
  count(*)::int,
  coalesce(sum(GREATEST(jel.debit, jel.credit)), 0)
FROM journal_entries corr
JOIN journal_entry_lines jel ON jel.journal_entry_id = corr.id
JOIN accounts a ON a.id = jel.account_id AND trim(a.code) = '1100'
WHERE corr.reference_type = 'gl_correction'
  AND corr.action_fingerprint LIKE 'developer_repair:gl_correction:rental-1100-leakage:%'
  AND COALESCE(corr.is_void, false) = false;

-- 5) Effective control 1100 rows after repair (what UI should hide in effective view)
WITH co AS (SELECT id FROM companies WHERE name ILIKE '%DIN BRIDAL%' LIMIT 1),
repaired AS (
  SELECT replace(corr.action_fingerprint, 'developer_repair:gl_correction:rental-1100-leakage:', '') AS source_line_id
  FROM journal_entries corr, co
  WHERE corr.company_id = co.id
    AND corr.action_fingerprint LIKE 'developer_repair:gl_correction:rental-1100-leakage:%'
    AND COALESCE(corr.is_void, false) = false
)
SELECT
  je.entry_no,
  je.reference_type,
  jel.id AS journal_line_id,
  jel.debit,
  jel.credit,
  CASE
    WHEN je.reference_type = 'gl_correction'
      AND je.action_fingerprint LIKE 'developer_repair:gl_correction:rental-1100-leakage:%' THEN 'hide_correction'
    WHEN jel.id::text IN (SELECT source_line_id FROM repaired) THEN 'hide_source'
    ELSE 'show'
  END AS effective_visibility
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id AND trim(a.code) = '1100'
WHERE je.company_id = (SELECT id FROM co)
  AND COALESCE(je.is_void, false) = false
ORDER BY je.entry_date, je.entry_no;
