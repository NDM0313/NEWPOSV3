-- Findings (2026-07-08 VPS, DIN CHINA DC0159) — CLOSED: legitimate credit-heavy bank
--
-- | Check | Result |
-- |-------|--------|
-- | raw JE td/tc/nb vs TB | MATCH (−4,647,660.00) |
-- | Unbalanced JEs touching DC0159 | 0 |
-- | Orphan single-leg lines | 0 |
-- | Credit-heavy asset leafs on TB | DC0159 only |
-- | Active lines | Balanced dual-leg: receipts (AR), transfers→1202 WALI T/T, courier_payment→2031 YAQOOB |
-- | Voided transfers without correction_reversal | Historical CSV rollback voids (excluded from official_gl) — not a live balance bug |
--
-- No GL repair posted. Negative bank = credits (money out) > debits; use Ledger for trail.
-- Deep audit: DIN NDM MZ (DC0159) credit-heavy trail — read-only
-- Company DIN CHINA / account a903c6d2-6ba8-4e40-849e-39e6b7394901
-- Flags: unbalanced JE, missing counterpart, void without active reversal

-- 1) TB vs raw JE totals for DC0159
WITH a AS (
  SELECT id FROM accounts
  WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485' AND code = 'DC0159'
),
raw AS (
  SELECT
    COALESCE(SUM(jel.debit), 0) AS td,
    COALESCE(SUM(jel.credit), 0) AS tc,
    COALESCE(SUM(jel.debit - jel.credit), 0) AS nb
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  JOIN a ON a.id = jel.account_id
  WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
    AND COALESCE(je.is_void, false) = false
    AND je.entry_date::date <= '2026-07-08'
),
tb AS (
  SELECT
    (acc->>'total_debit')::numeric AS td,
    (acc->>'total_credit')::numeric AS tc,
    (acc->>'net_balance')::numeric AS nb
  FROM jsonb_array_elements(
    (get_unified_trial_balance(
      '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
      NULL, '2026-07-08'::date, 'official_gl'
    )::jsonb)->'accounts'
  ) acc
  WHERE acc->>'account_code' = 'DC0159'
)
SELECT 'DC0159_totals' AS section,
  r.td AS raw_td, r.tc AS raw_tc, r.nb AS raw_nb,
  t.td AS tb_td, t.tc AS tb_tc, t.nb AS tb_nb,
  ROUND(r.nb - t.nb, 2) AS delta_nb
FROM raw r CROSS JOIN tb t;

-- 2) Per-JE balance check for all JEs that touch DC0159 (whole JE must balance)
WITH a AS (
  SELECT id FROM accounts
  WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485' AND code = 'DC0159'
),
touch AS (
  SELECT DISTINCT je.id AS je_id, je.entry_no, je.entry_date::date AS ed,
    je.reference_type, je.branch_id, je.is_void, left(coalesce(je.description,''), 80) AS descr
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  JOIN a ON a.id = jel.account_id
  WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
    AND je.entry_date::date <= '2026-07-08'
),
bal AS (
  SELECT t.*,
    SUM(jel.debit) AS je_td,
    SUM(jel.credit) AS je_tc,
    ROUND(SUM(jel.debit) - SUM(jel.credit), 2) AS je_imbalance
  FROM touch t
  JOIN journal_entry_lines jel ON jel.journal_entry_id = t.je_id
  GROUP BY t.je_id, t.entry_no, t.ed, t.reference_type, t.branch_id, t.is_void, t.descr
)
SELECT 'unbalanced_jes' AS section, *
FROM bal
WHERE ABS(je_imbalance) > 0.01
ORDER BY ABS(je_imbalance) DESC;

-- 3) DC0159 lines with counterpart account(s) on same JE
WITH a AS (
  SELECT id FROM accounts
  WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485' AND code = 'DC0159'
)
SELECT
  je.entry_no,
  je.entry_date::date AS ed,
  je.reference_type,
  je.branch_id IS NULL AS null_br,
  COALESCE(je.is_void, false) AS is_void,
  jel.debit AS ndm_dr,
  jel.credit AS ndm_cr,
  (
    SELECT string_agg(DISTINCT acc.code || ' ' || acc.name, ' | ' ORDER BY acc.code || ' ' || acc.name)
    FROM journal_entry_lines o
    JOIN accounts acc ON acc.id = o.account_id
    WHERE o.journal_entry_id = je.id AND o.account_id <> jel.account_id
  ) AS counterparts,
  left(coalesce(je.description,''), 70) AS descr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN a ON a.id = jel.account_id
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND COALESCE(je.is_void, false) = false
  AND je.entry_date::date <= '2026-07-08'
ORDER BY GREATEST(jel.debit, jel.credit) DESC;

-- 4) Lines with NO counterpart on same JE (true orphan leg)
WITH a AS (
  SELECT id FROM accounts
  WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485' AND code = 'DC0159'
)
SELECT je.entry_no, jel.debit, jel.credit, je.reference_type
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN a ON a.id = jel.account_id
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND COALESCE(je.is_void, false) = false
  AND je.entry_date::date <= '2026-07-08'
  AND NOT EXISTS (
    SELECT 1 FROM journal_entry_lines o
    WHERE o.journal_entry_id = je.id AND o.account_id <> jel.account_id
  );

-- 5) Voided DC0159 originals missing active correction_reversal
WITH a AS (
  SELECT id FROM accounts
  WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485' AND code = 'DC0159'
)
SELECT je.entry_no, je.entry_date::date, je.reference_type, je.void_reason
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN a ON a.id = jel.account_id
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND COALESCE(je.is_void, false) = true
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries rev
    WHERE rev.company_id = je.company_id
      AND rev.reference_type = 'correction_reversal'
      AND rev.reference_id = je.id
      AND COALESCE(rev.is_void, false) = false
  )
ORDER BY je.entry_date;

-- 6) Other credit-heavy asset/bank leafs on TB (exclude revenue/equity/AP name payable)
SELECT
  acc->>'account_code' AS code,
  acc->>'account_name' AS name,
  acc->>'account_type' AS typ,
  (acc->>'net_balance')::numeric AS nb
FROM jsonb_array_elements(
  (get_unified_trial_balance(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    NULL, '2026-07-08'::date, 'official_gl'
  )::jsonb)->'accounts'
) acc
WHERE COALESCE((acc->>'is_header')::boolean, false) = false
  AND (acc->>'net_balance')::numeric < -0.01
  AND (
    LOWER(COALESCE(acc->>'account_type','')) ~ 'asset|bank|cash|receivable|inventory'
    OR LOWER(COALESCE(acc->>'account_name','')) ~ 'cash|bank|mz|habib|ndm|fhd|wali'
  )
  AND LOWER(COALESCE(acc->>'account_name','')) !~ 'payable'
ORDER BY (acc->>'net_balance')::numeric ASC;
