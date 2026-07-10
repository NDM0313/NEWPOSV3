# Sales Revenue Canonical Correction — 4000

## Correction
Previous 4100-first decision (`b7fa557d`) is **superseded** after operator confirmation and read-only production audit.

## Updated decision
Canonical future Sales Revenue account: **4000**

## Why
- DIN COUTURE native/live sales use **4000**
- DIN BRIDAL native/live sales use **4000**
- DIN CHINA newer native SL sales used **4000**
- DIN CHINA **4100** activity is mainly imported/converted DC history (92 sales)
- Therefore **4100** should not be treated as global canonical future account

## New rule
- Future posting prefers **4000**
- **4100** remains fallback only if **4000** is missing
- Historical **4100** entries remain untouched

## What did not change
- No transfer JE
- No DB migration
- No production GL/data mutation
- No account deletion
- No deactivation of **4000** or **4100**

## Implementation
- `src/app/lib/canonicalSalesRevenueAccount.ts` — `CANONICAL_SALES_REVENUE_CODE = '4000'`, fallback `'4100'`
- Wired in: `saleAccountingService.ts`, `AccountingContext.tsx`, `studioCustomerInvoiceService.ts`
- Mobile: `erp-mobile-app/src/lib/canonicalSalesRevenueAccount.ts`, `saleEditAccounting.ts`

## Future Phase 2
DIN CHINA historical **4100** may later be reclassed/rolled up to **4000** only after written approval:

```
APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2
```

## Production proof (2026-07-10)

- Invoice **SL-0010** (DIN CHINA) → JE **JE-0316** → revenue **4000** Cr 500.00
- Status: **`PASS_4000_POSTING_CONFIRMED`** — see [`reports/sales-revenue-canonical-account-correction-20260710/`](../../reports/sales-revenue-canonical-account-correction-20260710/)
- Closeout: [`closeout.md`](../../reports/sales-revenue-canonical-account-correction-20260710/closeout.md)

## Safety
- R8-R2: not started
- DB migration: no
- Repair: no
- Transfer JE: no
