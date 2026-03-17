-- ============================================================================
-- PF-08: Shipment Ledger — Courier Payable column fix
-- ============================================================================
-- Posting goes to courier sub-accounts (2031, 2032, ...), not control 2030.
-- Original view compared jel.account_id to 2030, so courier_payable was always 0.
-- Fix: sum jel.credit where the line's account is a courier sub-ledger (code 2031+).
-- Safe to run multiple times.
-- ============================================================================

DROP VIEW IF EXISTS shipment_ledger;

CREATE VIEW shipment_ledger AS
SELECT
  sh.id                                              AS shipment_id,
  sh.company_id,
  sh.courier_id,
  COALESCE(c.name, sh.courier_name, 'Unknown')       AS courier_name,
  je.entry_date                                      AS date,
  -- Shipping income: credit to 4100
  SUM(CASE
    WHEN jel.account_id = a_income.id THEN jel.credit
    ELSE 0
  END)                                               AS shipping_income,
  -- Shipping expense: debit to 5100
  SUM(CASE
    WHEN jel.account_id = a_expense.id THEN jel.debit
    ELSE 0
  END)                                               AS shipping_expense,
  -- Courier payable: credit to courier sub-accounts (2031, 2032, ...), not 2030
  SUM(CASE
    WHEN a_line.id IS NOT NULL AND a_line.code ~ '^203[1-9][0-9]*$' THEN jel.credit
    ELSE 0
  END)                                               AS courier_payable,
  je.id                                              AS journal_entry_id,
  je.entry_no
FROM
  sale_shipments sh
  JOIN journal_entries je
    ON je.reference_type = 'shipment'
    AND je.reference_id  = sh.id
  JOIN journal_entry_lines jel
    ON jel.journal_entry_id = je.id
  LEFT JOIN accounts a_line
    ON a_line.id = jel.account_id
    AND a_line.company_id = sh.company_id
  LEFT JOIN LATERAL (
    SELECT id FROM accounts
    WHERE company_id = sh.company_id AND code = '4100' LIMIT 1
  ) a_income ON true
  LEFT JOIN LATERAL (
    SELECT id FROM accounts
    WHERE company_id = sh.company_id AND code = '5100' LIMIT 1
  ) a_expense ON true
  LEFT JOIN contacts c ON c.id = sh.courier_id
GROUP BY
  sh.id,
  sh.company_id,
  sh.courier_id,
  c.name,
  sh.courier_name,
  je.entry_date,
  je.id,
  je.entry_no;

GRANT SELECT ON shipment_ledger TO authenticated;
