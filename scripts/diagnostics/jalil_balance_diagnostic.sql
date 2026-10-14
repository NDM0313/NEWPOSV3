-- Read-only JALIL balance diagnostic (no mutations)
\set contact_id 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'
\set company_id '30bd8592-3384-4f34-899a-f3907e336485'

\echo '=== Contact ==='
SELECT id, code, name, company_id, type, opening_balance, linked_account_id
FROM contacts WHERE id = :'contact_id';

\echo '=== Linked AR subledger account ==='
SELECT a.id, a.code, a.name, a.linked_contact_id
FROM accounts a
WHERE a.company_id = :'company_id'
  AND (a.linked_contact_id = :'contact_id' OR a.name ILIKE '%JALIL%')
ORDER BY a.code;

\echo '=== RPC get_customer_ar_gl_ledger_for_contact row count + final balance ==='
WITH rpc AS (
  SELECT *
  FROM get_customer_ar_gl_ledger_for_contact(
    :'company_id'::uuid,
    :'contact_id'::uuid,
    NULL::uuid,
    '2000-01-01'::date,
    '2099-12-31'::date
  )
)
SELECT
  count(*) AS row_count,
  round(coalesce(sum(debit),0)::numeric, 2) AS total_debit,
  round(coalesce(sum(credit),0)::numeric, 2) AS total_credit,
  round(coalesce(sum(debit - credit),0)::numeric, 2) AS net_debit_minus_credit,
  (SELECT running_balance FROM rpc ORDER BY sort_order DESC NULLS LAST, entry_date DESC, entry_no DESC LIMIT 1) AS last_running_balance
FROM rpc;

\echo '=== Sales final count + total for customer ==='
SELECT count(*) AS sale_count,
  round(coalesce(sum(total_amount),0)::numeric, 2) AS total_sales
FROM sales
WHERE company_id = :'company_id'
  AND customer_id = :'contact_id'
  AND status = 'final';

\echo '=== Payments received (customer) ==='
SELECT count(*) AS payment_count,
  round(coalesce(sum(amount),0)::numeric, 2) AS total_received
FROM payments p
WHERE p.company_id = :'company_id'
  AND p.contact_id = :'contact_id'
  AND p.payment_type = 'received'
  AND p.voided_at IS NULL;

\echo '=== Journal lines on JALIL-linked AR account (unfiltered party) ==='
WITH ar_acct AS (
  SELECT id FROM accounts
  WHERE company_id = :'company_id'
    AND linked_contact_id = :'contact_id'
  LIMIT 1
)
SELECT count(jel.id) AS line_count,
  round(coalesce(sum(jel.debit),0)::numeric, 2) AS total_debit,
  round(coalesce(sum(jel.credit),0)::numeric, 2) AS total_credit,
  round(coalesce(sum(jel.debit - jel.credit),0)::numeric, 2) AS net
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id IN (SELECT id FROM ar_acct)
  AND je.is_void IS NOT TRUE;
