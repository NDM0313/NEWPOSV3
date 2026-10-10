# Mobile code audit

**Target:** `erp-mobile-app/` (Capacitor)  
**Flutter:** audit only — reports module remains placeholder

## Implemented

| Layer | Files |
|-------|-------|
| Flag resolver (read-only) | `api/featureFlags.ts`, `lib/reportLoaderSource.ts`, `lib/unifiedLedgerFlagKeys.ts` |
| RPC + loaders | `api/unifiedLedgerRpc.ts`, `api/unifiedReports.ts` |
| Mappers | `lib/unifiedReportMappers.ts`, `lib/bsPlAccountTypes.ts` |
| Screens | Balance Sheet, P&L, Trial Balance, Cash Flow, Ledger V2 |
| Hub wiring | `ReportsHub.tsx`, `AccountsModule.tsx` |
| Account Statement upgrade | `AccountLedgerReport.tsx` unified path |

## Data source

Same Supabase RPCs as web: `get_unified_trial_balance`, `get_unified_cash_bank_ledger`, `get_unified_account_ledger`, `get_unified_party_ledger`.

Cash Flow legacy fallback: `getRoznamcha` when unified flags off.
