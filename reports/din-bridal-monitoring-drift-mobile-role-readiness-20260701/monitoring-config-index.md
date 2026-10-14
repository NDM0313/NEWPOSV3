# DIN BRIDAL monitoring configuration index

**Company ID:** `597a5292-14c8-4cd8-96bd-c61b5a0d8c92`  
**Profile ID:** `din-bridal`

## Configuration files

| Purpose | Path |
|---------|------|
| Monitoring profile + golden PKR | `scripts/single-core-ledger/monitoring-company-profiles.json` |
| Golden fixture archive | `reports/single-core-ledger/din-bridal/golden-fixtures.json` |
| Phase 2.16 browser verify | `scripts/single-core-ledger/run-phase-216-monitoring-verify.mjs` |
| Three-company orchestrator | `scripts/single-core-ledger/run-three-company-operational-monitoring.mjs` |
| R5 browser golden capture | `scripts/single-core-ledger/run-r5-golden-capture-din-bridal.mjs` |
| Browser capture evidence | `reports/single-core-ledger/din-bridal-monitoring/golden-capture/` |

## Active monitoring goldens (PKR)

| Metric | Value | Source |
|--------|-------|--------|
| Trial Balance total | 22,056,075 | Post-1100 refresh 2026-06-30 |
| Roznamcha Cash In | 1,836,350 | Browser capture 2026-06-27 |
| Roznamcha Cash Out | 917,780 | Browser capture 2026-06-27 |
| Roznamcha Closing | 918,570 | Browser capture 2026-06-27 |
| MR REHAN ALI closing | 530,000 | Browser + RPC |

## TB golden fixture references

- `monitoring-company-profiles.json` → `golden.trial_balance_debit_credit_pkr`
- `golden-fixtures.json` → `fixtures.trial_balance_debit_pkr` / `trial_balance_credit_pkr`
- Refreshed after **1100 Option C apply** (JV-000209, JV-000210) — commit `95a041d7`

## Roznamcha golden fixture references

- Monitoring uses **browser body-text regex** (`readRoznamchaSummary` in phase-216 script)
- `golden-fixtures.json` documents `rpc_proxy_baseline` separately (cash in **1,916,350** — different capture method)
- Cash Flow / BS / P&L flags are unrelated to roznamcha golden totals in monitoring

## Post-BS/P&L swap

- BS/P&L unified loaders enabled 2026-07-01 (`db499995`, `98d2f4c8`)
- Mobile Admin QA verified DIN BRIDAL BS **13,521,792** and P&L **119,992** on device — independent of roznamcha/TB monitoring goldens
- Monitoring roznamcha/TB goldens **not** updated after BS/P&L swap

## Related evidence commits

| Commit | Description |
|--------|-------------|
| `95a041d7` | DIN BRIDAL 1100 Option C apply |
| `bc1a768d` | BS/P&L recapture after 1100 |
| `db499995` | BS/P&L loader wiring |
| `5bc7d128` / `7566d294` | Mobile Admin manual QA |
