# Current implementation map — Cash Flow (Phase 3B audit)

**Generated:** 2026-06-29T14:00:00.000Z

---

## Page / component paths

| Item | Path |
|------|------|
| Cash Flow page | `src/app/components/reports/CashFlowReportPage.tsx` |
| Accounting dashboard lazy load | `src/app/components/accounting/AccountingDashboard.tsx` |
| Print preview builder | `src/app/components/reports/shared/buildCashFlowPrintPreview.ts` |
| Phase 3B preview panel | `src/app/components/accounting/CashFlowUnifiedPreviewPanel.tsx` |

---

## Service / helper paths

| Item | Path | Role |
|------|------|------|
| Cash Flow report service | `src/app/services/cashFlowReportService.ts` | **Main loader** — `getCashFlowReport` |
| Roznamcha legacy | `src/app/services/roznamchaService.ts` | Underlying stream for legacy CF |
| Cash Flow pure logic | `src/app/lib/cashFlowReportLogic.ts` | Summary, filters, status, visibility |
| Roznamcha unified main | `src/app/services/roznamchaUnifiedMainService.ts` | Live unified Roznamcha (not wired to CF) |
| Roznamcha unified preview | `src/app/services/roznamchaUnifiedPreviewService.ts` | **Preview source** for Phase 3B |
| Phase 3B preview service | `src/app/services/cashFlowUnifiedPreviewService.ts` | Parallel preview loader |
| Phase 3B mapper | `src/app/lib/accounting/cashFlowUnifiedPreviewMapper.ts` | Unified rows → CF summary |
| Phase 3B diff | `src/app/lib/accounting/cashFlowUnifiedPreviewDiff.ts` | Legacy vs preview compare |
| Visibility contract | `src/app/lib/reportVisibilityContract.ts` | Normal vs audit row gates |

---

## Current data source (main)

`getCashFlowReport` → `roznamchaService.getRoznamcha` → payment/journal enrichment → `cashFlowReportLogic`

**Known gap (Phase 3 audit):** Cash Flow does **not** use `roznamchaUnifiedMainService` when unified Roznamcha loader is ON.

---

## Filters

| Filter | Behavior |
|--------|----------|
| Date range | Global header or page override |
| Branch | ERP global branch selector |
| Liquidity | `all` / `cash` / `bank` / `wallet` (`AccountFilter`) |
| Payment account | Optional single ledger account |
| Source module | sales_receipts, expenses, etc. |
| Audit mode | Normal vs audit visibility |
| Search | UI-only row filter (does not change summary) |

---

## Visibility / reversal

- Normal mode: `shouldIncludeInNormalCashMovement` / `reportVisibilityContract`
- Audit mode: voided/reversal rows visible with badges
- Status: `live` / `voided` / `reversed` via `resolveCashFlowRowStatus`

---

## Running balance

`recomputeCashFlowRunningBalance` from opening balance after source-module filter.

---

## Export / print

- CSV via `ReportActions` + `buildCashFlowCsvRows`
- PDF via `useReportExport` + `CashBookReportPreview`

---

## Finance risks

1. Legacy roznamcha path may diverge from unified cash/bank RPC when loaders differ
2. Source-module inference is heuristic (referenceType + row type)
3. Running balance changes when UI filters active (documented in UI)
4. GL tie-out panel compares net movement to `getCashFlowStatement` — separate from unified preview

---

## Safe preview insertion point

After `ReportBasisBanner`, before `ReportActions` — matches BS/P&L/Roznamcha preview pattern. Toggle default **OFF**; legacy table unchanged.
