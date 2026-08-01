# Current implementation map — BS / P&L (pre–Phase 3A wiring)

**Generated:** 2026-06-29

## Balance Sheet

| Field | Value |
|-------|-------|
| Page | `src/app/components/reports/BalanceSheetPage.tsx` |
| Route | `ReportsDashboardEnhanced` → `balance-sheet` |
| Service | `accountingReportsService.getBalanceSheet` |
| TB source | Legacy `getTrialBalance` (journal_entry_lines) |
| Date | As-of `asOfDate` (lifetime start → as-of) |
| Branch | Optional `branchId` |
| Visibility | Void JEs excluded in legacy TB; no audit toggle on page |
| Export/print | Excel, `FinancialReportPrintShell`, WhatsApp |
| Preview insertion | After `ReportBasisBanner`; toggle default OFF |

## Profit & Loss

| Field | Value |
|-------|-------|
| Page | `src/app/components/reports/ProfitLossPage.tsx` |
| Route | `ReportsDashboardEnhanced` → `profit-loss` |
| Service | `accountingReportsService.getProfitLoss` |
| TB source | Legacy `getTrialBalance` for period |
| COGS | `COST_OF_PRODUCTION_CODES` + type heuristics |
| Date | Period + optional prior comparison |
| Export/print | Excel, print shell, WhatsApp |
| Preview insertion | After `ReportBasisBanner`; toggle default OFF |

## Phase 3A additions

| Component | Path |
|-----------|------|
| BS mapper | `src/app/lib/accounting/balanceSheetUnifiedPreviewMapper.ts` |
| P&L mapper | `src/app/lib/accounting/profitLossUnifiedPreviewMapper.ts` |
| Diff | `src/app/lib/accounting/bsPlUnifiedPreviewDiff.ts` |
| Access | `src/app/lib/accounting/bsPlUnifiedPreviewAccess.ts` |
| Service | `src/app/services/bsPlUnifiedPreviewService.ts` |
| BS panel | `src/app/components/accounting/BalanceSheetUnifiedPreviewPanel.tsx` |
| P&L panel | `src/app/components/accounting/ProfitLossUnifiedPreviewPanel.tsx` |
