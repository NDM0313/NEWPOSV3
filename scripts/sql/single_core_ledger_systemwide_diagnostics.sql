-- Single Core Ledger — Phase 1.5 systemwide diagnostics (read-only SELECT)
-- Prefer RPC get_single_core_ledger_systemwide_diagnostics() after migration 20260621120000.
-- NO INSERT / UPDATE / DELETE
--
-- psql usage:
--   \i scripts/sql/single_core_ledger_systemwide_diagnostics.sql

\echo '=== Systemwide company diagnostics (view) ==='
SELECT *
FROM v_single_core_ledger_company_diagnostics
ORDER BY company_name;

\echo '=== Strict pass / fail summary ==='
SELECT
  COUNT(*) AS companies_total,
  COUNT(*) FILTER (
    WHERE branch_attribution_risk = 0
      AND payments_missing_contact_sale_linked = 0
      AND payments_wrong_party_attribution = 0
  ) AS strict_pass_count,
  COUNT(*) FILTER (
    WHERE branch_attribution_risk > 0
      OR payments_missing_contact_sale_linked > 0
      OR payments_wrong_party_attribution > 0
  ) AS strict_fail_count,
  COALESCE(SUM(branch_attribution_risk), 0) AS branch_attribution_risk_total
FROM v_single_core_ledger_company_diagnostics;

\echo '=== Branch attribution risk sample (limit 50) ==='
SELECT *
FROM v_single_core_ledger_branch_attribution_risk
ORDER BY entry_date DESC NULLS LAST
LIMIT 50;

\echo '=== RPC JSON (if migration applied) ==='
SELECT public.get_single_core_ledger_systemwide_diagnostics();

\echo '=== DONE (read-only) ==='
