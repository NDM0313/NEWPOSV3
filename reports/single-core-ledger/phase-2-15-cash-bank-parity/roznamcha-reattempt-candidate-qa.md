# Phase 2.15 — Roznamcha re-attempt candidate QA

**Date:** 2026-06-26  
**Flags:** `unified_ledger_loader_roznamcha` ON, `unified_ledger_screen_roznamcha` ON

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Main loader | unified | unified | PASS |
| Preview compare | legacy_shadow | legacy_shadow | PASS |
| Cash In | 136,158,012 | 136,158,012 | PASS |
| Cash Out | 67,042,426 | 67,042,426 | PASS |
| Closing | 69,115,586 | 69,115,586 | PASS |

**Result:** PASS (roznamcha golden gate)

Known non-blocking flakes: Ledger V2 MR JALIL Playwright NaN; Admin Compare timing.
