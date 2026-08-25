# Phase 2.14 — Roznamcha loader final report

**Status:** `PHASE 2.14 ROZNAMCHA LOADER FAILED — rolled back to legacy`

| Field | Value |
|-------|-------|
| Phase 2.13 commit | `a7a4b727` |
| Phase 2.14 commit | _(pending local commit)_ |
| Deploy label | `phase-214-prod` @ `https://erp.dincouture.pk` |
| Rollback | L1 loader OFF + L2 screen OFF executed |

## Golden gate failure (root cause)

| Metric | Legacy golden (baseline) | Unified main (candidate) |
|--------|--------------------------|---------------------------|
| Cash In | 136,158,012 | 135,736,321 |
| Cash Out | 67,042,426 | 126,854,008 |
| Closing | **69,115,586** | **8,882,313** |

Wide-range (2000–today, All Branches) legacy `getRoznamcha` vs unified `getUnifiedCashBankLedger` totals diverge materially. Phase 2.6 preview documented row-key/basis differences between payment-based Roznamcha and GL liquidity RPC — **Cash/Bank parity (Phase 2.9A-CB) was not completed** before loader swap.

## QA summary

| Phase | Roznamcha | Cross-screen |
|-------|-----------|--------------|
| Baseline (legacy) | PASS — golden captured | AS/PL/TB PASS; LV2 closing read flake |
| Candidate (unified) | **FAIL** golden totals | AS/PL/TB unchanged |
| L1 rollback | PASS — legacy restored | — |

## Production flag state (post-rollback)

- `unified_ledger_loader_roznamcha` **OFF**
- `unified_ledger_screen_roznamcha` **OFF**
- LV2 / AS / TB / Party Ledger loaders **ON** (unchanged)

## Blocked future items

- Roznamcha loader re-enable blocked until Cash/Bank parity closes legacy vs unified totals
- Cash/Bank parity work (Phase 2.9A-CB) required next

## Implementation retained

Code, tests (223 PASS), SQL artifacts, and QA scripts committed for future parity completion — not enabled in production.
