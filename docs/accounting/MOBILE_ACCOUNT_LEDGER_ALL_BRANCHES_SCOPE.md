# Mobile Account Ledger — all-branches scope (2026-08-16)

## Symptom

Mobile **Account Ledger** / Ledger Activity showed **Opening balance only** (e.g. 1 entry) for Current FY on many accounts — including **1062 ZARPOSH MZ** — even when GL had in-period movements.

## Root cause

| Client | JE / line loader `branchId` |
|--------|------------------------------|
| Web Account Statement | `null` (`STATEMENT_ALL_BRANCHES_SCOPE`) — company-wide |
| Mobile (before fix) | App session branch — strict filter |

Unified RPC `_unified_ledger_strict_branch_includes_row` still counts **null-branch opening** rows for opening balance, but drops many in-period payments/JEs on other or null branches → false **LedgerPeriodEmptyCard** (“Opening only”) for every account under that branch.

Secondary: empty-state used **net-presented** line count after cancelled-pair netting, which could also fake opening-only when raw RPC rows existed.

## Fix (no migration / no RPC rewrite)

1. Shared constant [`erp-mobile-app/src/lib/ledgerBranchScope.ts`](../../erp-mobile-app/src/lib/ledgerBranchScope.ts):

   ```ts
   export const ACCOUNT_LEDGER_ALL_BRANCHES = null;
   ```

2. Pass that into GL loaders in:
   - [`AccountLedgerReport.tsx`](../../erp-mobile-app/src/components/accounts/reports/AccountLedgerReport.tsx)
   - [`LedgerV2Report.tsx`](../../erp-mobile-app/src/components/accounts/reports/LedgerV2Report.tsx)
   - [`AccountSummaryReport.tsx`](../../erp-mobile-app/src/components/accounts/reports/AccountSummaryReport.tsx)

3. Keep session `branchId` on **DateRangeBar** only for fiscal-year start resolution.

4. Empty-state / opening-only checks use **raw** `lines.length`, not presented-only.

**Unchanged:** Day Book, Trial Balance, Balance Sheet, payment write paths, party list screens.

## Verification notes

- Account **1062** (DIN BRIDAL): FY `2025-10-01` → `2026-08-16` has **81** period GL lines in DB; UI should list movements, not opening-only.
- Spot-check another bank + one expense under the same company.
- **Show all time** toggle still works.

## Deploy notes

- Logic ships with mobile Vite / Capacitor web bundle after VPS `git pull` + ERP redeploy.
- Native APK rebuild only if you need an on-device Capacitor install after merge.

## Out of scope

- No DB migration or production data repair.
- Strict branch helper in Postgres stays; callers pass `null` for account statements.
