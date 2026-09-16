-- Courier ledger views: void-safe totals, reference_type filters, entry_no/PAY refs
-- Safe to re-run (CREATE OR REPLACE VIEW).

DROP VIEW IF EXISTS courier_ledger;
DROP VIEW IF EXISTS courier_summary;

CREATE VIEW courier_ledger AS
SELECT
  je.company_id,
  je.entry_date AS date,
  COALESCE(c.name, a.name) AS courier_name,
  a.id AS account_id,
  a.contact_id AS courier_id,
  je.reference_id AS shipment_id,
  je.reference_type,
  je.entry_no,
  je.document_no,
  COALESCE(p.reference_number, je.document_no, je.entry_no) AS payment_ref,
  CASE
    WHEN je.reference_type = 'courier_payment' THEN 'payment'
    WHEN je.reference_type = 'shipment' THEN 'shipment'
    WHEN je.reference_type IN ('journal', 'purchase') AND jel.credit > 0 THEN 'accrual'
    ELSE COALESCE(je.reference_type, 'other')
  END AS entry_kind,
  jel.description,
  jel.debit,
  jel.credit,
  SUM(jel.credit - jel.debit) OVER (
    PARTITION BY a.id ORDER BY je.entry_date, je.id, jel.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS balance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id AND a.company_id = je.company_id
LEFT JOIN contacts c ON c.id = a.contact_id
LEFT JOIN payments p ON p.id = je.payment_id
WHERE COALESCE(je.is_void, false) = false
  AND a.contact_id IS NOT NULL
  AND (a.code ~ '^203[0-9]+$' OR a.parent_id IN (SELECT id FROM accounts WHERE code = '2030'));

GRANT SELECT ON courier_ledger TO authenticated;

CREATE VIEW courier_summary AS
SELECT
  a.company_id,
  a.id AS courier_account_id,
  a.contact_id AS courier_id,
  COALESCE(c.name, a.name) AS courier_name,
  (
    SELECT COUNT(DISTINCT je.reference_id)
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE jel.account_id = a.id
      AND je.reference_type = 'shipment'
      AND COALESCE(je.is_void, false) = false
  ) AS total_shipments,
  (
    SELECT COALESCE(SUM(jel.credit), 0)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = a.id
      AND COALESCE(je.is_void, false) = false
      AND je.reference_type <> 'courier_payment'
      AND jel.credit > 0
  ) AS total_expense,
  (
    SELECT COALESCE(SUM(jel.debit), 0)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = a.id
      AND COALESCE(je.is_void, false) = false
      AND je.reference_type = 'courier_payment'
      AND jel.debit > 0
  ) AS total_paid,
  (
    SELECT COALESCE(SUM(jel.credit - jel.debit), 0)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = a.id
      AND COALESCE(je.is_void, false) = false
  ) AS balance_due
FROM accounts a
LEFT JOIN contacts c ON c.id = a.contact_id
WHERE a.contact_id IS NOT NULL
  AND (a.code ~ '^203[0-9]+$' OR a.parent_id IN (SELECT id FROM accounts WHERE code = '2030'));

GRANT SELECT ON courier_summary TO authenticated;
