-- Single Core Ledger — Phase 0 read-only diagnostics
-- NO INSERT / UPDATE / DELETE — SELECT only
-- Run against staging/clone, or read-only on live with explicit approval.
--
-- Usage (psql):
--   \set company_id '30bd8592-3384-4f34-899a-f3907e336485'
--   \i scripts/sql/single_core_ledger_phase0_diagnostics.sql

\echo '=== 0. Company scope ==='
SELECT :'company_id'::uuid AS company_id;

\echo '=== 1. Payments missing contact_id (sale-linked) ==='
SELECT
  COUNT(*) AS row_count,
  COUNT(DISTINCT p.id) AS distinct_payments
FROM payments p
INNER JOIN sales s ON s.id = p.reference_id AND s.company_id = p.company_id
WHERE p.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'sale'
  AND p.contact_id IS NULL
  AND p.voided_at IS NULL;

\echo '=== 1b. Sample sale-linked payments missing contact_id (limit 25) ==='
SELECT
  p.id AS payment_id,
  p.reference_number,
  p.payment_date,
  p.amount,
  p.reference_type,
  s.invoice_no,
  s.customer_id AS sale_customer_id,
  c.code AS customer_code,
  c.name AS customer_name
FROM payments p
INNER JOIN sales s ON s.id = p.reference_id AND s.company_id = p.company_id
LEFT JOIN contacts c ON c.id = s.customer_id
WHERE p.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'sale'
  AND p.contact_id IS NULL
  AND p.voided_at IS NULL
ORDER BY p.payment_date DESC NULLS LAST
LIMIT 25;

\echo '=== 2. Sale-linked payments with wrong party attribution ==='
SELECT COUNT(*) AS wrong_contact_count
FROM payments p
INNER JOIN sales s ON s.id = p.reference_id AND s.company_id = p.company_id
WHERE p.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'sale'
  AND p.contact_id IS NOT NULL
  AND p.contact_id IS DISTINCT FROM s.customer_id
  AND p.voided_at IS NULL;

\echo '=== 3. Journal lines hitting AR control 1100 directly ==='
WITH ar_control AS (
  SELECT a.id
  FROM accounts a
  WHERE a.company_id = :'company_id'::uuid
    AND TRIM(COALESCE(a.code, '')) = '1100'
  LIMIT 1
)
SELECT COUNT(*) AS control_1100_line_count
FROM journal_entry_lines jel
INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
INNER JOIN ar_control ac ON jel.account_id = ac.id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, FALSE) = FALSE
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) NOT IN (
    'opening_balance_contact_ar', 'opening_balance', 'gl_correction'
  );

\echo '=== 4. Unposted final sales ==='
SELECT COUNT(*) AS unposted_final_sales
FROM sales s
WHERE s.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(s.status, ''))) IN ('final', 'finalized')
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.company_id = s.company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_adjustment')
      AND je.reference_id = s.id
  );

\echo '=== 5. Unposted final purchases ==='
SELECT COUNT(*) AS unposted_final_purchases
FROM purchases p
WHERE p.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(p.status, ''))) IN ('final', 'finalized', 'received')
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.company_id = p.company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('purchase', 'purchase_adjustment')
      AND je.reference_id = p.id
  );

\echo '=== 6. Unposted rentals (total > 0) ==='
SELECT COUNT(*) AS unposted_rentals
FROM rentals r
WHERE r.company_id = :'company_id'::uuid
  AND COALESCE(r.total_amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.company_id = r.company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'rental'
      AND je.reference_id = r.id
  );

\echo '=== 7. Correction / reversal chains (JE-0168 class) ==='
SELECT COUNT(*) AS correction_reversal_je_count
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, FALSE) = FALSE
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal';

\echo '=== 8. Opening balance JEs vs contacts.opening_balance ==='
SELECT
  (SELECT COUNT(*) FROM journal_entries je
   WHERE je.company_id = :'company_id'::uuid
     AND COALESCE(je.is_void, FALSE) = FALSE
     AND LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'opening_balance_contact_ar') AS ar_opening_je_count,
  (SELECT COUNT(*) FROM contacts c
   WHERE c.company_id = :'company_id'::uuid
     AND COALESCE(c.opening_balance, 0) <> 0) AS contacts_with_opening_balance;

\echo '=== 9. Walk-in CUS-0000 attribution ==='
WITH walkin AS (
  SELECT id FROM contacts
  WHERE company_id = :'company_id'::uuid
    AND (TRIM(COALESCE(code, '')) = 'CUS-0000' OR LOWER(name) LIKE '%walk-in%')
  LIMIT 1
)
SELECT
  (SELECT COUNT(*) FROM walkin) AS walkin_contact_found,
  (SELECT COUNT(*) FROM journal_entry_lines jel
   INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
   INNER JOIN accounts acc ON acc.id = jel.account_id
   WHERE je.company_id = :'company_id'::uuid
     AND COALESCE(je.is_void, FALSE) = FALSE
     AND acc.linked_contact_id = (SELECT id FROM walkin)
  ) AS lines_on_walkin_subledger,
  (SELECT COUNT(*) FROM journal_entry_lines jel
   INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
   INNER JOIN accounts acc ON acc.id = jel.account_id AND TRIM(acc.code) = '1100'
   WHERE je.company_id = :'company_id'::uuid
     AND COALESCE(je.is_void, FALSE) = FALSE
     AND public._gl_resolve_party_id_for_journal_entry(je.company_id, je.id) = (SELECT id FROM walkin)
  ) AS control_1100_resolved_to_walkin;

\echo '=== 10. Unmapped AR/AP queue summary ==='
SELECT
  COUNT(*) AS unmapped_line_count,
  COUNT(DISTINCT journal_entry_id) AS unmapped_distinct_je
FROM v_ar_ap_unmapped_journals v
WHERE v.company_id = :'company_id'::uuid;

\echo '=== 11. Branch NULL on transactional JEs (filter risk) ==='
SELECT COUNT(*) AS je_with_null_branch
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, FALSE) = FALSE
  AND je.branch_id IS NULL
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'payment', 'manual_receipt', 'purchase');

\echo '=== DONE (read-only) ==='
