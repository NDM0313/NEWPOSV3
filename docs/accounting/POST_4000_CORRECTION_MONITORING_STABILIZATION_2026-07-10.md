# Post-4000 Correction Monitoring Stabilization — 2026-07-10

## Summary

| Item | Value |
|------|-------|
| Change type | Monitoring script hardening only |
| File | `scripts/single-core-ledger/run-phase-216-monitoring-verify.mjs` |
| Runtime production source changed | **no** |
| ERP frontend deploy required | **no** |
| DB migrations | **no** |
| GL mutation | **no** |

## What changed

- `waitForAccountingShell()` — multi-marker wait for accounting tab bar
- `openAccountingTab()` — up to 3 retries with `journal_entries_navigation_retry` logging
- Fixes transient DIN CHINA Journal Entries tab timeout (not revenue/accounting logic)

## Validation

- Three-company monitoring: **PASS** (`three-company-monitoring-2026-07-10T18-42-28-347Z.md`)
- `test:unified-ledger`: PASS
- `test:unit`: PASS
- `build`: PASS

## Sales revenue watch

Canonical account remains **4000**. Post-correction sale observation: **`PASS_4000_POSTING_CONFIRMED`** — SL-0010 / JE-0316 credited **4000** (proof commit `23fb615d`). Observation window **closed**.

## Safety

- No accounting service changes
- No production data mutation
- R8-R2 not started
