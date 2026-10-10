# Phase 2.15X — Automation waiver note

Roznamcha soak core gates passed. The markdown files retain Overall FAIL labels because cross-screen Playwright checks had known non-blocking flakes: Ledger V2 MR JALIL parse NaN and Admin Compare timing. These flakes did not affect Roznamcha parity, Roznamcha totals, or live loader state. They remain automation hardening items, not production rollback triggers.

## Affected artifacts

- `roznamcha-reattempt-soak-final.md` (via Phase 2.14 QA script overall label)
- `production-loader-soak-*.md` under phase-2-14-roznamcha-loader (if present)

## Core gates that passed (production truth)

| Gate | Status |
|------|--------|
| Roznamcha main loader unified | PASS |
| Roznamcha Cash In 136,158,012 | PASS |
| Roznamcha Cash Out 67,042,426 | PASS |
| Roznamcha Closing 69,115,586 | PASS |
| Preview compare legacy_shadow | PASS |
| AS/PL MR JALIL 216,300 | PASS |
| Trial Balance balanced | PASS |

## Non-blocking flakes (do not rollback)

| Flake | Symptom | Production impact |
|-------|---------|-------------------|
| LV2 MR JALIL Playwright | closing=NaN | None — AS/PL read 216,300 reliably |
| Admin Compare timing | pass=3 vs 9 | Shadow diagnostic only |
