# ERP UI Theme Normalization

**Date:** 2026-03-14  
**Scope:** Local UI; consistent card/border/background for reports and accounting.

---

## Observed issue

After earlier performance/theme work, some screens had inconsistent card appearance, borders, and backgrounds. Goal: standardize so reports, accounting, and dashboards feel consistent without destructive cleanup.

---

## Standard (dark theme)

Use these as the default for report/accounting cards and sections:

| Element | Class / pattern |
|--------|------------------|
| **Card / section container** | `bg-gray-900/50 border border-gray-800 rounded-xl` |
| **Card with stronger contrast** | `bg-gray-950/50 border border-gray-800 rounded-xl` |
| **Table header** | `bg-gray-900/80` or `bg-gray-950/80` + `border-b border-gray-800` |
| **Table row hover** | `hover:bg-gray-800/30` |
| **Borders (divider)** | `border-gray-800` (primary), `border-gray-700` (footers / emphasis) |
| **Section spacing** | `p-4` or `p-6`; `space-y-4` or `space-y-6` between sections |
| **Sticky header (reports)** | `bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-10` |

Avoid mixing hex panel colors (e.g. `#111827`) with these Tailwind grays in the same report; dashboard can keep its existing hex layout.

---

## Where this is applied

- **Reports:** ReportActions, RoznamchaReport, DayBookReport, TrialBalancePage, SalesProfitPage, InventoryValuationPage, BalanceSheetPage, ProfitLossPage, ReportsDashboardEnhanced cards already use `bg-gray-900/50` or `bg-gray-900`, `border-gray-800`, `rounded-xl`.
- **UnifiedLedgerView:** Statement and detailed views use `bg-gray-950/50 border border-gray-800 rounded-xl` for tables.
- **Commission Report:** Uses `Card` with `bg-gray-900 border-gray-800` for consistency with other report cards.

No broad re-style was done; the standard above is documented so new report/accounting UI can follow it. If a specific screen shows odd background or border on click/open, fix that screen by aligning to the classes above (and ensure no conflicting `focus:` or `active:` styles override the card).

---

## Files touched this pass

- None required for theme-only normalization; CommissionReportPage and existing report components already follow the pattern. This doc serves as the reference for future fixes.

---

## Rollback

N/A (documentation and optional one-off fixes only).
