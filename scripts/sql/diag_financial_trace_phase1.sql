-- Financial Trace Center — Phase 1 read-only diagnostic workbook.
-- No INSERT/UPDATE/DELETE. Safe for production SQL editor and VPS psql.
--
-- Run (VPS):
--   Get-Content scripts/sql/diag_financial_trace_phase1.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"
--
-- Optional: set company at session start:
--   SET app.diag_company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';

SELECT '=== 0. Session context ===' AS audit_section;

WITH co AS (
  SELECT COALESCE(
    NULLIF(current_setting('app.diag_company_id', true), '')::uuid,
    (SELECT company_id FROM sales WHERE invoice_no IN ('SL-0005', 'SL-0012') LIMIT 1)
  ) AS company_id
)
SELECT
  c.company_id,
  comp.name AS company_name,
  CURRENT_DATE AS as_of_date
FROM co c
LEFT JOIN companies comp ON comp.id = c.company_id;

-- ---------------------------------------------------------------------------
-- Section 1 — Control reconciliation (TB control vs lab snapshot vs ops sum)
-- ---------------------------------------------------------------------------

SELECT '=== 1A. AR/AP integrity lab snapshot (all branches) ===' AS audit_section;

SELECT *
FROM ar_ap_integrity_lab_snapshot(
  COALESCE(
    NULLIF(current_setting('app.diag_company_id', true), '')::uuid,
    (SELECT company_id FROM sales WHERE invoice_no = 'SL-0005' LIMIT 1)
  ),
  NULL,
  CURRENT_DATE
);

SELECT '=== 1B. GL AR/AP control accounts (lifetime net, void excluded) ===' AS audit_section;

WITH co AS (
  SELECT COALESCE(
    NULLIF(current_setting('app.diag_company_id', true), '')::uuid,
    (SELECT company_id FROM sales WHERE invoice_no = 'SL-0005' LIMIT 1)
  ) AS company_id
),
control_accounts AS (
  SELECT a.id, a.code, a.name, a.type
  FROM accounts a, co
  WHERE a.company_id = co.company_id
    AND a.is_active = TRUE
    AND a.code IN ('1100', '2000', '2010')
)
SELECT
  ca.code,
  ca.name,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS net_dr_minus_cr,
  ROUND(COALESCE(SUM(jel.debit), 0), 2) AS total_debit,
  ROUND(COALESCE(SUM(jel.credit), 0), 2) AS total_credit,
  COUNT(jel.id) AS line_count
FROM control_accounts ca
LEFT JOIN journal_entry_lines jel ON jel.account_id = ca.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND COALESCE(je.is_void, FALSE) = FALSE
  AND je.company_id = (SELECT company_id FROM co LIMIT 1)
GROUP BY ca.code, ca.name
ORDER BY ca.code;

SELECT '=== 1C. Operational receivables/payables sum (RPC proxy — open documents) ===' AS audit_section;

WITH co AS (
  SELECT COALESCE(
    NULLIF(current_setting('app.diag_company_id', true), '')::uuid,
    (SELECT company_id FROM sales WHERE invoice_no = 'SL-0005' LIMIT 1)
  ) AS company_id
)
SELECT
  ROUND(COALESCE(SUM(s.due_amount), 0), 2) AS sales_due_sum_non_cancelled,
  ROUND(COALESCE(SUM(p.due_amount), 0), 2) AS purchases_due_sum_non_cancelled,
  COUNT(*) FILTER (WHERE s.due_amount > 0 AND lower(trim(s.status)) NOT IN ('cancelled', 'void')) AS sales_with_due_count,
  COUNT(*) FILTER (WHERE p.due_amount > 0 AND lower(trim(p.status)) NOT IN ('cancelled', 'void')) AS purchases_with_due_count
FROM co
LEFT JOIN sales s ON s.company_id = co.company_id
  AND lower(trim(s.status)) NOT IN ('cancelled', 'void')
LEFT JOIN purchases p ON p.company_id = co.company_id
  AND lower(trim(p.status)) NOT IN ('cancelled', 'void');

SELECT '=== 1D. Queue counts (AR/AP lab views) ===' AS audit_section;

WITH co AS (
  SELECT COALESCE(
    NULLIF(current_setting('app.diag_company_id', true), '')::uuid,
    (SELECT company_id FROM sales WHERE invoice_no = 'SL-0005' LIMIT 1)
  ) AS company_id
)
SELECT
  (SELECT COUNT(*) FROM v_ar_ap_unposted_documents u WHERE u.company_id = co.company_id) AS unposted_docs,
  (SELECT COUNT(DISTINCT journal_entry_id) FROM v_ar_ap_unmapped_journals v WHERE v.company_id = co.company_id) AS unmapped_distinct_jes,
  (SELECT COUNT(*) FROM v_ar_ap_manual_adjustments m WHERE m.company_id = co.company_id) AS manual_je_rows
FROM co;

-- ---------------------------------------------------------------------------
-- Section 2 — Inayat / REN-0002 rental trace
-- ---------------------------------------------------------------------------

SELECT '=== 2A. Contact Inayat + AR sub-account ===' AS audit_section;

SELECT
  c.id AS contact_id,
  c.name,
  c.opening_balance,
  a.id AS ar_account_id,
  a.code AS ar_code,
  a.name AS ar_name,
  a.linked_contact_id
FROM contacts c
LEFT JOIN accounts a ON a.linked_contact_id = c.id AND a.company_id = c.company_id
WHERE c.name ILIKE '%Inayat%'
ORDER BY c.name
LIMIT 10;

SELECT '=== 2B. REN-0002 rental header ===' AS audit_section;

SELECT
  r.id,
  r.booking_no,
  r.customer_id,
  r.customer_name,
  r.status,
  r.rental_charges,
  r.total_amount,
  r.paid_amount,
  r.due_amount,
  r.damage_charges,
  r.penalty_paid,
  r.branch_id,
  b.name AS branch_name
FROM rentals r
LEFT JOIN branches b ON b.id = r.branch_id
WHERE r.booking_no = 'REN-0002';

SELECT '=== 2C. REN-0002 rental_payments + linked JEs ===' AS audit_section;

SELECT
  rp.id,
  rp.reference,
  rp.payment_date,
  rp.amount,
  rp.voided_at,
  rp.journal_entry_id,
  je.entry_no,
  je.reference_type AS je_ref_type,
  je.is_void AS je_void,
  je.branch_id AS je_branch_id,
  a.code AS cash_account_code,
  a.name AS cash_account_name
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id AND r.booking_no = 'REN-0002'
LEFT JOIN journal_entries je ON je.id = rp.journal_entry_id
LEFT JOIN accounts a ON a.id = rp.payment_account_id
ORDER BY rp.payment_date, rp.created_at;

SELECT '=== 2D. payments rows tied to REN-0002 / Inayat / HQ-RCV ===' AS audit_section;

SELECT
  p.reference_number,
  p.payment_date,
  p.amount,
  p.reference_type,
  p.reference_id,
  p.contact_id,
  p.voided_at,
  p.payment_account_id,
  a.code AS account_code,
  je.id AS je_id,
  je.entry_no,
  je.reference_type AS je_ref_type,
  je.is_void AS je_void
FROM payments p
LEFT JOIN accounts a ON a.id = p.payment_account_id
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.reference_number IN ('HQ-RCV-0006', 'HQ-RCV-0003')
   OR p.reference_number ILIKE 'REN-0002%'
   OR p.notes ILIKE '%Inayat%'
ORDER BY p.payment_date DESC, p.reference_number
LIMIT 30;

SELECT '=== 2E. AR sub-ledger net for Inayat (if AR account found) ===' AS audit_section;

WITH inayat AS (
  SELECT c.id AS contact_id, a.id AS ar_account_id
  FROM contacts c
  JOIN accounts a ON a.linked_contact_id = c.id AND a.company_id = c.company_id
  WHERE c.name ILIKE '%Inayat%'
  LIMIT 1
)
SELECT
  i.contact_id,
  i.ar_account_id,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS ar_net_dr_minus_cr,
  COUNT(jel.id) AS line_count
FROM inayat i
LEFT JOIN journal_entry_lines jel ON jel.account_id = i.ar_account_id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND COALESCE(je.is_void, FALSE) = FALSE;

-- ---------------------------------------------------------------------------
-- Section 3 — Saqib RCV-0008 metadata review (class B)
-- ---------------------------------------------------------------------------

SELECT '=== 3A. Saqib contact + AR-CUS0060 net ===' AS audit_section;

WITH saqib AS (
  SELECT c.id AS contact_id, a.id AS ar_account_id, a.code AS ar_code
  FROM contacts c
  JOIN accounts a ON a.linked_contact_id = c.id AND a.company_id = c.company_id
  WHERE c.name ILIKE 'Saqib'
  LIMIT 1
)
SELECT
  s.*,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS ar_net_dr_minus_cr
FROM saqib s
LEFT JOIN journal_entry_lines jel ON jel.account_id = s.ar_account_id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND COALESCE(je.is_void, FALSE) = FALSE;

SELECT '=== 3B. RCV-0008 payment + JE metadata ===' AS audit_section;

SELECT
  p.id,
  p.reference_number,
  p.amount,
  p.payment_date,
  p.reference_type AS payment_ref_type,
  p.reference_id,
  p.contact_id,
  p.notes,
  je.id AS je_id,
  je.entry_no,
  je.reference_type AS je_ref_type,
  je.description AS je_description,
  je.is_void
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id OR je.id = (
  SELECT rp.journal_entry_id FROM rental_payments rp WHERE rp.reference = p.reference_number LIMIT 1
)
WHERE p.reference_number = 'RCV-0008'
   OR p.id = '315c21c2-ed7b-4a3f-97d6-4ca4f3c34f44';

SELECT '=== 3C. RCV-0008 in unmapped view (if present) ===' AS audit_section;

SELECT *
FROM v_ar_ap_unmapped_journals
WHERE entry_no ILIKE '%RCV-0008%'
   OR description ILIKE '%RCV-0008%'
LIMIT 20;

-- ---------------------------------------------------------------------------
-- Section 4 — Walk-in false-positive pattern (RCV-0017/18/19)
-- ---------------------------------------------------------------------------

SELECT '=== 4A. Walk-in on_account payments in unmapped queue ===' AS audit_section;

SELECT
  v.journal_entry_id,
  v.entry_no,
  v.reference_type AS je_ref_type,
  v.contact_mapping_status,
  v.reason,
  v.control_bucket,
  p.reference_number,
  p.reference_type AS payment_ref_type,
  p.contact_id AS payment_contact_id,
  ar.code AS ar_code,
  ar.linked_contact_id AS ar_linked_contact_id
FROM v_ar_ap_unmapped_journals v
JOIN journal_entries je ON je.id = v.journal_entry_id
LEFT JOIN payments p ON p.id = je.payment_id
LEFT JOIN accounts ar ON ar.id = v.account_id
WHERE p.reference_number IN ('RCV-0017', 'RCV-0018', 'RCV-0019')
   OR v.entry_no IN ('RCV-0017', 'RCV-0018', 'RCV-0019')
ORDER BY v.entry_no;

-- ---------------------------------------------------------------------------
-- Section 5 — Non-final order sales in unposted queue
-- ---------------------------------------------------------------------------

SELECT '=== 5A. Unposted queue — order-status sales ===' AS audit_section;

SELECT
  u.document_no,
  u.source_type,
  u.due_amount,
  u.reason,
  s.status AS sale_status,
  s.total,
  s.paid_amount,
  s.customer_name,
  EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_id = s.id
      AND lower(trim(je.reference_type)) = 'sale'
      AND COALESCE(je.is_void, FALSE) = FALSE
  ) AS has_sale_je
FROM v_ar_ap_unposted_documents u
JOIN sales s ON s.id = u.source_id AND u.source_type = 'sale'
WHERE u.document_no IN ('SL-0005', 'SL-0006', 'SL-0012')
ORDER BY u.document_no;

SELECT '=== 5B. Payments on order-status sales (SL-0005/6/12) ===' AS audit_section;

SELECT
  s.invoice_no,
  s.status,
  p.reference_number,
  p.amount,
  p.payment_date,
  p.reference_type,
  je.entry_no,
  je.reference_type AS je_ref_type,
  COALESCE(je.is_void, FALSE) AS je_void
FROM sales s
JOIN payment_allocations pa ON pa.sale_id = s.id
JOIN payments p ON p.id = pa.payment_id
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE s.invoice_no IN ('SL-0005', 'SL-0006', 'SL-0012')
ORDER BY s.invoice_no, p.payment_date;

-- ---------------------------------------------------------------------------
-- Section 6 — Ledger V2 / Account Statement tie-out helper (per contact GL)
-- ---------------------------------------------------------------------------

SELECT '=== 6. Party AR GL net vs sum of AR-CUS sub-ledgers (sanity) ===' AS audit_section;

WITH co AS (
  SELECT COALESCE(
    NULLIF(current_setting('app.diag_company_id', true), '')::uuid,
    (SELECT company_id FROM sales WHERE invoice_no = 'SL-0005' LIMIT 1)
  ) AS company_id
),
ar_control AS (
  SELECT id FROM accounts a, co WHERE a.company_id = co.company_id AND a.code = '1100' LIMIT 1
),
ar_subs AS (
  SELECT a.id
  FROM accounts a, co
  WHERE a.company_id = co.company_id
    AND a.code LIKE 'AR-CUS%'
    AND a.is_active = TRUE
)
SELECT
  '1100_control' AS slice,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS net_dr_minus_cr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND COALESCE(je.is_void, FALSE) = FALSE
  AND je.company_id = (SELECT company_id FROM co)
WHERE jel.account_id = (SELECT id FROM ar_control)
UNION ALL
SELECT
  'AR-CUS_subledgers_sum' AS slice,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS net_dr_minus_cr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND COALESCE(je.is_void, FALSE) = FALSE
  AND je.company_id = (SELECT company_id FROM co)
WHERE jel.account_id IN (SELECT id FROM ar_subs);

SELECT '=== END Phase 1 diagnostic (read-only) ===' AS audit_section;
