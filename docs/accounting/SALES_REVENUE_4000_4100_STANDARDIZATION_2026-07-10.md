# Sales Revenue 4000/4100 Standardization — 2026-07-10

## Decision
Canonical Sales Revenue account: **4100**

## Why
- 4100 is the seeded/detail Sales Revenue account
- DIN CHINA imported history is mostly 4100
- Sale returns align better with 4100
- Future posting should stop growing the 4000/4100 split

## What changed
- Future sales revenue posting prefers 4100
- 4000 remains fallback only
- Sale returns use same canonical revenue account logic
- No historical balances moved

## What did not change
- No transfer JE
- No DB migration
- No production GL/data mutation
- 4000 not deleted
- 4000 not deactivated
- P&L may still show old 4000/4100 split until approved reclass phase

## Future Phase 2
Historical merge/reclass is approval-gated and company-by-company:
1. DIN COUTURE low-risk review
2. DIN BRIDAL review
3. DIN CHINA reclass only after written approval

## R8 relationship
R8-R1 operational retirement is complete. This sales revenue standardization is separate and must not start R8-R2 or delete legacy code.

## Safety
- R8-R2 run: no
- DB migrations: no
- Repairs: no
- Transfer JE: no
- Production GL/data mutation: no

## Implementation
- Web: `src/app/lib/canonicalSalesRevenueAccount.ts` — `getCanonicalSalesRevenueAccount()`
- Wired in: `saleAccountingService.ts`, `AccountingContext.tsx` (sale returns), `studioCustomerInvoiceService.ts`
- Mobile: `erp-mobile-app/src/lib/canonicalSalesRevenueAccount.ts` + `saleEditAccounting.ts`
- Tests: `src/app/lib/canonicalSalesRevenueAccount.test.ts`
