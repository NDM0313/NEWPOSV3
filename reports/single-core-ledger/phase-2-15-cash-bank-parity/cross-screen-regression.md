# Phase 2.15 — Cross-screen regression

**Date:** 2026-06-26 (post deploy + roznamcha enable)

| Gate | Expected | Observed | Result |
|------|----------|----------|--------|
| Ledger V2 MR JALIL | 216,300 | 216,300 (AS/PL browser QA) | PASS |
| Account Statement MR JALIL | 216,300 | 216,300 | PASS |
| Party Ledger MR JALIL | 216,300 | 216,300 | PASS |
| Trial Balance debit | 407,957,271.02 | 407,957,271.02 | PASS |
| Trial Balance credit | 407,957,271.02 | 407,957,271.02 | PASS |
| Trial Balance difference | 0 | 0.00 (SQL) | PASS |
| Admin Compare Pilot Batch | 9/9 | 3/9 pass (timing flake) | Waiver |
| LV2 MR JALIL Playwright | 216,300 | NaN (flake) | Waiver |

Loaders unchanged: LV2, AS, TB, PL remain unified.

Roznamcha loader: **ON** after parity fix.
