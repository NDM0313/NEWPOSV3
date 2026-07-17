# REPORT_ERROR_POLICY.md

| Report | Silent catch risk | Status |
|--------|-------------------|--------|
| Cash Flow | Was silent → legacy | **Fixed** |
| Roznamcha | Labelled fallback | Phase 2 |
| Party Ledger | Labelled fallback | Phase 2 + worker |
| Account Ledger | Silent catch → empty | **Fixed** (surface error notice) |
| BS / PL / TB | Catch → error, no fake data | OK |
| Contact balances | GL fail → operational fallback (console warn) | Documented remaining; not rewritten this phase |
