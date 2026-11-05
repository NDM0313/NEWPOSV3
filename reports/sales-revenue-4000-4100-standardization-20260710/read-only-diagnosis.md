# Sales Revenue 4000 vs 4100 — read-only diagnosis (standardization phase)

**Date:** 2026-07-10  
**Scope:** OLD ERP production (read-only SQL + code audit)  
**Script:** `scripts/sql/diag_sales_revenue_4000_4100_split.sql`  
**Prior report:** `reports/sales-revenue-4000-4100-diagnosis-20260710/diagnosis.md`  
**Safety:** No GL mutation, no COA merge, no repairs, no transfer JE

## Executive summary

| Finding | Detail |
|---------|--------|
| Root cause | Dual revenue codes — import/legacy → **4100**; newer sale engine → **4000** |
| Canonical decision (this phase) | Future posting → **4100**; **4000** fallback only if 4100 absent |
| Historical transfer | **Not in scope** — balances stay on existing accounts |
| Same-sale double credit | **0** rows (no sale credits both 4000 and 4100 on one document JE) |

---

## DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)

| Code | All-time net revenue (JE) | Sale document credits | Return debits |
|------|-------------------------|------------------------|---------------|
| **4000** | Rs. 1,573,600 | 3 SL sales | 0 |
| **4100** | Rs. 49,685,321.98 | 92 DC import sales | Rs. 1,059,903 (4 returns) |

- **4000 cohort:** SL-0001 … SL-0003 (new-format invoices, finalized July 2026)
- **4100 cohort:** DC-00xx bulk import (June 2026)
- Combined merchandise revenue: Rs. 51,258,921.98

## DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)

- Both **4000** and **4100** exist in COA (seed standard)
- Production JE activity is low vs DIN CHINA; no material 4000/4100 split observed in prior audit
- Future sales should post to **4100** per standardization (prevents split growth)

## DIN COUTURE (`2ab65903-62a3-4bcf-bced-076b681e9b74`)

| Code | All-time net (JE) | Notes |
|------|-------------------|--------|
| 4000 | Rs. 21,250 | 1 sale (SL-0001) |
| 4100 | 0 | Account exists, no JE activity |

- Small 4000 balance from one sale; 4100 ready as canonical target for future posting

---

## Sale return account usage

- DIN CHINA sale returns debited **4100** only (4 JEs, Rs. 1,059,903)
- Return settlement paths in code previously mixed 4100-first (discount path) vs 4000-only (simple fallback) — standardized to canonical **4100** resolver in this phase

---

## Posting paths found in code (pre-fix → post-fix)

| Path | Before | After (this phase) |
|------|--------|-------------------|
| Web sale finalize | `saleAccountingService` → 4000 | **4100** via `getCanonicalSalesRevenueAccount()` |
| Studio customer invoice | hardcoded 4000 | **4100** canonical |
| Mobile sale edit | 4000 then 4100 | **4100** then 4000 fallback |
| Sale return settlement | mixed 4000/4100 | **4100** canonical via shared helper |
| COA seed | 4100 under 4050 | unchanged |

Shared helper: `src/app/lib/canonicalSalesRevenueAccount.ts` (web), `erp-mobile-app/src/lib/canonicalSalesRevenueAccount.ts` (mobile mirror).

---

## Confirmation: no DB mutation

| Item | Status |
|------|--------|
| DB migrations | not run |
| Transfer / reclass JE | not run |
| Account deactivation | not run |
| Production GL/data mutation | none |
| Historical JEs rewritten | no |

---

## Phase 2 (deferred)

Historical merge/reclass remains approval-gated and company-by-company. See `docs/accounting/SALES_REVENUE_4000_4100_STANDARDIZATION_2026-07-10.md`.
