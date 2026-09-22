# Stability ledger — Day 8 sample

**Window start:** 2026-07-01  
**Sequential sample label:** Day 8  
**Run local date/time:** 2026-07-02 17:03:03 +05:00  
**Calendar days elapsed:** **1**  
**Evidence folder:** `reports/single-core-engine-stability-daily-20260708/`  
**Classification:** **STABILITY_SAMPLE_FAIL**

| Item | Status |
|------|--------|
| Monitoring | **FAIL** — `three-company-monitoring-2026-07-02T12-03-36-782Z` |
| DIN CHINA | FAIL (timeout before Roznamcha; login/flags PASS) |
| Admin Compare | not reached |
| DIN BRIDAL | FAIL (timeout before Roznamcha; login/flags PASS) |
| DIN COUTURE | FAIL (timeout before Roznamcha; login/flags PASS) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Fixture refresh | **none** (not warranted) |
| Diagnosis | **monitoring bug** — Playwright Roznamcha nav timeout |
| Tests | 328/328 unified, 124/124 unit |
| R8 legacy retirement | **BLOCKED** |
| R8 calendar note | Same-day repeated samples do **not** shorten the 2–4 week window |
| Mobile release | separate track |
| Supplier Party Discount PKR 1 | separate approval |

**Operator:** Approve retry or investigate UI flake before any fixture refresh.
