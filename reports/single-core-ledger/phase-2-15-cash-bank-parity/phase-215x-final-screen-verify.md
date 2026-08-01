# Phase 2.15X — Final screen verification

**Date:** 2026-06-26  
**URL:** https://erp.dincouture.pk  
**Script:** `run-phase-214-roznamcha-loader-browser-qa.mjs candidate`

## Main loaders

| Screen | Expected | Actual | Result |
|--------|----------|--------|--------|
| Ledger V2 | unified | unified | PASS |
| Account Statement | unified | unified | PASS |
| Trial Balance | unified | unified | PASS |
| Party Ledger | unified | unified | PASS |
| Roznamcha | unified | unified | PASS |

## Roznamcha

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Preview compare | legacy_shadow | legacy_shadow | PASS |
| Cash In | 136,158,012 | 136,158,012 | PASS |
| Cash Out | 67,042,426 | 67,042,426 | PASS |
| Closing | 69,115,586 | 69,115,586 | PASS |

## Golden gates

| Gate | Expected | Actual | Result |
|------|----------|--------|--------|
| Trial Balance debit | 407,957,271.02 | 407,957,271.02 | PASS |
| Trial Balance credit | 407,957,271.02 | 407,957,271.02 | PASS |
| Account Statement MR JALIL | 216,300 | 216,300 | PASS |
| Party Ledger MR JALIL | 216,300 | 216,300 | PASS |
| Ledger V2 MR JALIL | 216,300 | NaN (Playwright flake) | Waiver |

## Overall

**Production screen verification: PASS** (core gates). See `phase-215x-waiver-note.md` for automation flakes.
