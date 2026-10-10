-- R3 read-only golden baseline capture (shadow RPC / GL read — no flag writes)
-- Used for expansion planning only; finance must validate before R5 enablement.

\echo '=== Trial balance totals (official_gl, all branches, as of today) ==='
SELECT
  c.name AS company,
  c.id AS company_id,
  (get_unified_trial_balance(c.id, NULL, CURRENT_DATE, 'official_gl')->>'total_debit')::numeric AS tb_debit,
  (get_unified_trial_balance(c.id, NULL, CURRENT_DATE, 'official_gl')->>'total_credit')::numeric AS tb_credit,
  (get_unified_trial_balance(c.id, NULL, CURRENT_DATE, 'official_gl')->>'difference')::numeric AS tb_difference,
  (get_unified_trial_balance(c.id, NULL, CURRENT_DATE, 'official_gl')->>'account_count')::int AS account_count
FROM companies c
ORDER BY c.name;

\echo '=== Top AR customer candidate per company (linked_contact_id, AR-CUS*) ==='
WITH ar_bal AS (
  SELECT
    c.name AS company,
    c.id AS company_id,
    ct.name AS party_name,
    a.linked_contact_id AS party_id,
    SUM(jel.debit - jel.credit)::numeric AS net_balance
  FROM companies c
  JOIN accounts a ON a.company_id = c.id
  JOIN contacts ct ON ct.id = a.linked_contact_id
  JOIN journal_entry_lines jel ON jel.account_id = a.id
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE COALESCE(je.is_void, false) = false
    AND a.linked_contact_id IS NOT NULL
    AND TRIM(COALESCE(a.code, '')) LIKE 'AR-CUS%'
  GROUP BY c.name, c.id, ct.name, a.linked_contact_id
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY ABS(net_balance) DESC) AS rn
  FROM ar_bal
)
SELECT company, company_id, party_name, party_id, net_balance
FROM ranked WHERE rn = 1
ORDER BY company;

\echo '=== Party ledger closing (top AR candidate — last running_balance from RPC rows) ==='
WITH ar_bal AS (
  SELECT
    c.name AS company,
    c.id AS company_id,
    ct.name AS party_name,
    a.linked_contact_id AS party_id,
    SUM(jel.debit - jel.credit)::numeric AS net_balance
  FROM companies c
  JOIN accounts a ON a.company_id = c.id
  JOIN contacts ct ON ct.id = a.linked_contact_id
  JOIN journal_entry_lines jel ON jel.account_id = a.id
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE COALESCE(je.is_void, false) = false
    AND a.linked_contact_id IS NOT NULL
    AND TRIM(COALESCE(a.code, '')) LIKE 'AR-CUS%'
  GROUP BY c.name, c.id, ct.name, a.linked_contact_id
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY ABS(net_balance) DESC) AS rn
  FROM ar_bal
),
top AS (SELECT * FROM ranked WHERE rn = 1),
payload AS (
  SELECT
    t.*,
    get_unified_party_ledger(t.company_id, 'customer', t.party_id, NULL, NULL, CURRENT_DATE, 'official_gl') AS pl
  FROM top t
)
SELECT
  company,
  party_name,
  party_id,
  net_balance AS ar_account_net_proxy,
  (pl->'rows'->-1->>'running_balance')::numeric AS party_ledger_closing
FROM payload
ORDER BY company;

\echo '=== Cash/Bank liquidity summary (official_gl, all history through today) ==='
SELECT
  c.name AS company,
  c.id AS company_id,
  (get_unified_cash_bank_ledger(c.id, NULL, '2000-01-01'::date, CURRENT_DATE, 'official_gl', 'all')->>'period_opening_balance')::numeric AS opening_balance,
  (get_unified_cash_bank_ledger(c.id, NULL, '2000-01-01'::date, CURRENT_DATE, 'official_gl', 'all')->>'row_count')::int AS row_count
FROM companies c
ORDER BY c.name;

\echo '=== Cash/Bank period totals (debit=cash in proxy, credit=cash out proxy) ==='
WITH liq_lines AS (
  SELECT
    je.company_id,
    jel.debit,
    jel.credit
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  JOIN accounts a ON a.id = jel.account_id
  WHERE COALESCE(je.is_void, false) = false
    AND je.entry_date::date BETWEEN '2000-01-01'::date AND CURRENT_DATE
    AND public._unified_ledger_is_liquidity_account(a.code, a.name, a.type::text, 'all')
)
SELECT
  c.name AS company,
  c.id AS company_id,
  COALESCE(SUM(ll.debit), 0)::numeric AS cash_in_proxy,
  COALESCE(SUM(ll.credit), 0)::numeric AS cash_out_proxy,
  COALESCE(SUM(ll.debit - ll.credit), 0)::numeric AS net_liquidity_movement
FROM companies c
LEFT JOIN liq_lines ll ON ll.company_id = c.id
GROUP BY c.name, c.id
ORDER BY c.name;
