# Production general smoke

**Generated:** 2026-06-29  
**URL:** https://erp.dincouture.pk

---

## Checks

| Check | Result |
|-------|--------|
| App loads | **Pass** |
| Login page renders | **Pass** |
| Login works | **Pass** (QA test account; production admin quick-login credentials not verified on this Mac) |
| Dashboard loads | **Pass** |
| Material console/RPC errors | **None observed** |
| Ledger V2 `/reports/ledger-statement-center-v2` | **Pass** |
| Unified preview toggle | **Pass** — present, role-gated (readonly checkbox) |
| Ledger filters (dates, type, party, search) | **Pass** |
| Discount filter option | **Pass** — "Discount" in transaction type dropdown |

---

## Session note

Smoke used `admin@test.com` QA account (QA Test Business Mac company) because per-company production credentials were not available on Home MacBook.

---

## Result

**PASS**
