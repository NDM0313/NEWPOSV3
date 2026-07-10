# Next sale return — live observation

> **SUPERSEDED for 4100-first policy** — Canonical revenue is **4000**. Future returns should debit **4000** via `getCanonicalSalesRevenueAccount()`. No post-correction returns observed yet; not blocking 4000 closeout.

**Status:** `SUPERSEDED` (4100-first observation cancelled; 4000 return observation open)  
**Observation window start:** 2026-07-10T17:06:53Z (deploy of `b7fa557d`)  
**Method:** Read-only production SQL via VPS  
**DB mutation by this diagnostic:** no

## Result

No real sale return occurred during this observation window. No artificial return created.

## Post-cutoff sale return JEs

- Count: **0**
- Revenue reversal account: n/a

## Historical context (pre-cutoff)

- DIN CHINA: 4 sale returns debited **4100** only (Rs. 1,059,903 total) — pre-standardization deploy
- DIN BRIDAL / DIN COUTURE: no sale_return revenue debits on 4000/4100 in production GL

## Verification status

| Check | Status |
|-------|--------|
| Return revenue reversal uses 4100 | **PENDING** — await next natural return |
| No split back to 4000 | **NOT OBSERVED** (no post-cutoff returns) |
| Stock/payment logic normal | n/a |
| TB balanced | n/a |

**Overall:** **PENDING OBSERVATION**
