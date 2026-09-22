-- Courier ledger view: expose JE/JEL ids for stable UI keys and tie-out
-- Safe to re-run (CREATE OR REPLACE VIEW).

DROP VIEW IF EXISTS courier_ledger;

CREATE VIEW courier_ledger AS
SELECT
  je.id AS journal_entry_id,
  jel.id AS journal_entry_line_id,
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
