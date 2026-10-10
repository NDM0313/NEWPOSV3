-- Unified Trial Balance ↔ Account Statement leaf tie-out (read-only)
--
-- Contract: for each non-header TB leaf under official_gl,
--   TB net_balance  ==  AS period_opening_balance + Σ(row.debit − row.credit)
-- (get_unified_account_ledger has no totals.closing_balance key.)
--
-- Plain SQL only — runs in Supabase SQL Editor and psql (no \if / \set / :vars).
-- Edit the params CTE below for company / as-of / branch / basis.
--
-- VPS:
--   scp scripts/sql/diag_unified_tb_leaf_as_tieout.sql dincouture-vps:/tmp/
--   ssh dincouture-vps "cat /tmp/diag_unified_tb_leaf_as_tieout.sql | docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"
--
-- Prefer this over diag_trial_balance_tieout.sql for single-core unified screens
-- (legacy void-excluded raw JE sums do not match void/correction_reversal parity).

-- === Summary ===
WITH params AS (
  SELECT
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid AS company_id,  -- DIN CHINA
    '2026-07-08'::date AS as_of,                                 -- or CURRENT_DATE
    NULL::uuid AS branch_id,                                     -- all-branches; set UUID for header-branch
    'official_gl'::text AS basis
),
tb AS (
  SELECT
    (acc->>'account_id')::uuid AS account_id,
    acc->>'account_code' AS code,
    acc->>'account_name' AS name,
    (acc->>'net_balance')::numeric AS tb_nb,
    (acc->>'total_debit')::numeric AS td,
    (acc->>'total_credit')::numeric AS tc
  FROM params p,
  LATERAL jsonb_array_elements(
    (get_unified_trial_balance(p.company_id, p.branch_id, p.as_of, p.basis)::jsonb)->'accounts'
  ) acc
  WHERE COALESCE((acc->>'is_header')::boolean, false) = false
),
as_close AS (
  SELECT
    t.account_id,
    COALESCE((led.ledger->>'period_opening_balance')::numeric, 0)
      + COALESCE((
          SELECT SUM((r->>'debit')::numeric - (r->>'credit')::numeric)
          FROM jsonb_array_elements(COALESCE(led.ledger->'rows', '[]'::jsonb)) r
        ), 0) AS as_closing,
    COALESCE((
      SELECT SUM((r->>'debit')::numeric)
      FROM jsonb_array_elements(COALESCE(led.ledger->'rows', '[]'::jsonb)) r
    ), 0) AS as_td,
    COALESCE((
      SELECT SUM((r->>'credit')::numeric)
      FROM jsonb_array_elements(COALESCE(led.ledger->'rows', '[]'::jsonb)) r
    ), 0) AS as_tc,
    (led.ledger->>'row_count')::int AS row_count
  FROM tb t
  CROSS JOIN params p
  CROSS JOIN LATERAL (
    SELECT get_unified_account_ledger(
      p.company_id,
      t.account_id,
      p.branch_id,
      NULL::date,
      p.as_of,
      p.basis
    )::jsonb AS ledger
  ) led
)
SELECT
  (SELECT company_id FROM params) AS company_id,
  (SELECT as_of FROM params) AS as_of,
  (SELECT branch_id FROM params) AS branch_id,
  (SELECT basis FROM params) AS basis,
  COUNT(*) AS leaf_accounts,
  COUNT(*) FILTER (WHERE ABS(t.tb_nb - a.as_closing) > 1) AS mismatches,
  COUNT(*) FILTER (WHERE ABS(t.tb_nb - a.as_closing) <= 1) AS matched,
  COUNT(*) FILTER (
    WHERE ABS(t.td - a.as_td) > 1 OR ABS(t.tc - a.as_tc) > 1
  ) AS td_tc_mismatch,
  CASE
    WHEN COUNT(*) FILTER (WHERE ABS(t.tb_nb - a.as_closing) > 1) = 0
    THEN 'PASS'
    ELSE 'FAIL — see mismatch detail'
  END AS status
FROM tb t
JOIN as_close a ON a.account_id = t.account_id;

-- === Mismatch detail (empty when PASS) ===
-- Run as a second statement in the same editor (both are independent).
WITH params AS (
  SELECT
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid AS company_id,
    '2026-07-08'::date AS as_of,
    NULL::uuid AS branch_id,
    'official_gl'::text AS basis
),
tb AS (
  SELECT
    (acc->>'account_id')::uuid AS account_id,
    acc->>'account_code' AS code,
    acc->>'account_name' AS name,
    (acc->>'net_balance')::numeric AS tb_nb,
    (acc->>'total_debit')::numeric AS td,
    (acc->>'total_credit')::numeric AS tc
  FROM params p,
  LATERAL jsonb_array_elements(
    (get_unified_trial_balance(p.company_id, p.branch_id, p.as_of, p.basis)::jsonb)->'accounts'
  ) acc
  WHERE COALESCE((acc->>'is_header')::boolean, false) = false
),
as_close AS (
  SELECT
    t.account_id,
    COALESCE((led.ledger->>'period_opening_balance')::numeric, 0)
      + COALESCE((
          SELECT SUM((r->>'debit')::numeric - (r->>'credit')::numeric)
          FROM jsonb_array_elements(COALESCE(led.ledger->'rows', '[]'::jsonb)) r
        ), 0) AS as_closing,
    COALESCE((
      SELECT SUM((r->>'debit')::numeric)
      FROM jsonb_array_elements(COALESCE(led.ledger->'rows', '[]'::jsonb)) r
    ), 0) AS as_td,
    COALESCE((
      SELECT SUM((r->>'credit')::numeric)
      FROM jsonb_array_elements(COALESCE(led.ledger->'rows', '[]'::jsonb)) r
    ), 0) AS as_tc,
    (led.ledger->>'row_count')::int AS row_count
  FROM tb t
  CROSS JOIN params p
  CROSS JOIN LATERAL (
    SELECT get_unified_account_ledger(
      p.company_id,
      t.account_id,
      p.branch_id,
      NULL::date,
      p.as_of,
      p.basis
    )::jsonb AS ledger
  ) led
)
SELECT
  t.code,
  t.name,
  t.tb_nb,
  a.as_closing,
  ROUND(t.tb_nb - a.as_closing, 2) AS delta_nb,
  t.td,
  a.as_td,
  t.tc,
  a.as_tc,
  a.row_count
FROM tb t
JOIN as_close a ON a.account_id = t.account_id
WHERE ABS(t.tb_nb - a.as_closing) > 1
ORDER BY ABS(t.tb_nb - a.as_closing) DESC;

-- FAIL criterion: any row above means leaf TB ≠ AS closing (Δ > 1).
-- Expect 0 detail rows and status PASS for a healthy company.
