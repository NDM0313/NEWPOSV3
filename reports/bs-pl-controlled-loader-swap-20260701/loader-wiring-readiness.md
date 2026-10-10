# Loader wiring readiness — BS/P&L controlled swap

**Date:** 2026-07-01  
**Classification:** `CODE_NOT_WIRED_BLOCKED`  
**Action taken:** No flags enabled. No frontend deploy.

## Why blocked

BS/P&L main loader swap **cannot be controlled by feature flags today**. Unified BS/P&L exists only as an **opt-in preview** path; legacy `getBalanceSheet` / `getProfitLoss` remain the authoritative main loaders.

| Check | Status |
|-------|--------|
| `unified_ledger_loader_balance_sheet` in `unifiedLedgerFlagKeys.ts` | **MISSING** |
| `unified_ledger_loader_profit_loss` | **MISSING** |
| `unified_ledger_screen_balance_sheet` | **MISSING** |
| `unified_ledger_screen_profit_loss` | **MISSING** |
| `resolveBalanceSheetMainLoaderSource.ts` | **MISSING** |
| `resolveProfitLossMainLoaderSource.ts` | **MISSING** |
| `BalanceSheetPage` main loader branch | **legacy only** (+ preview toggle) |
| `ProfitLossPage` main loader branch | **legacy only** (+ preview panel) |
| Cash Flow reference pattern | **LIVE** (`resolveCashFlowMainLoaderSource.ts`) |

## Implementation plan (before next swap attempt)

1. Add four flag keys to `unifiedLedgerFlagKeys.ts` / screen flag registry (mirror Cash Flow).
2. Add BS and P&L main-loader resolvers (mirror `resolveCashFlowMainLoaderSource.ts`).
3. Wire `BalanceSheetPage.tsx` and `ProfitLossPage.tsx` to switch main loader when loader + screen flags ON (respect kill switch).
4. Add resolver unit tests and page integration tests.
5. Add VPS SQL enable/disable scripts per company.
6. Frontend-only deploy if production bundle lacks wiring.
7. Re-run this swap procedure with operator approval on file.

**Gap reference:** `reports/single-core-ledger/remaining-optional-screens-audit/gap-analysis.md` (G-BS-02, G-PL-02).
