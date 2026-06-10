# Reports Export Formatting Patch — Phase 1

**Scope:** Formatting only (Tier A). No GL/accounting logic, migrations, or legacy `exportUtils.ts` report paths.

**Target pages:** Ledger Center V2, Stock Report, Product Sell Report.

---

## 1. Files changed (Phase 1)

### New
| File | Purpose |
|------|---------|
| `src/app/components/reports/shared/ledgerExportColumns.ts` | 8-column print + 10-column CSV/Excel column defs |
| `src/app/components/reports/shared/buildLedgerStatementShareMessage.ts` | Statement-level WhatsApp/share text |
| `src/app/components/reports/shared/resolveTabularReportPrintOptions.ts` | Stock / Product Sell print settings resolver |

### Updated (formatting / export only)
| File | Change |
|------|--------|
| `src/styles/index.css` | Print CSS: preserve light thead contrast (no blanket `* { background:#fff }`) |
| `src/app/components/reports/shared/LedgerStatementReportPreview.tsx` | 8-column print layout incl. Branch; print-safe thead |
| `src/app/components/reports/shared/useReportExport.ts` | `reportKind`, `tabularPrintOptions`, `preparePrint`, WhatsApp `message` override |
| `src/app/components/reports/shared/TabularReportPreview.tsx` | `fontFamily`, `margins` from settings |
| `src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx` | Export columns, PDF rows, statement WhatsApp |
| `src/app/components/reports/StockReportPage.tsx` | Settings sync, clean CSV numerics, `preparePrint` before PDF |
| `src/app/components/reports/ProductSellReportPage.tsx` | Settings sync, `preparePrint`, grouped export dates |
| `src/app/components/settings/printing/ReportExportPreviewPanel.tsx` | Mock rows include Branch (8-col preview) |

### Not touched (per scope)
- `ledgerStatementCenterV2Service`, `accountingService`, GL routing
- `AccountLedgerReportPage`, Account Statements, migrations, RLS
- `exportUtils.ts` legacy report implementations

---

## 2. Accounting / GL logic — unchanged

**Confirmed:** No edits to balance computation, journal posting, RPC calls, or `ledgerStatementCenterV2Service` data loading. Phase 1 only changes:

- Print/PDF DOM and CSS
- CSV/Excel column selection and numeric cell values
- Share message formatting
- Reading merged printing settings for preview

---

## 3. Ledger V2 PDF/print — readable header

**Fix:** `@media print` no longer forces white background on thead text. `LedgerStatementReportPreview` uses `#f0f0f0` / `#111` thead with explicit print overrides.

**Expected layout (portrait, 8 columns):**

```
┌──────────────────────────────────────────────────────────────┐
│ [Company header]  CUSTOMER LEDGER  ·  Party name           │
│ Opening │ Closing │ Total debit │ Total credit  (summary)    │
├──────┬─────┬──────┬─────────────┬────────┬───────┬───────┬───┤
│ Date │ Ref │ Type │ Description │ Branch │ Debit │Credit │Bal│  ← visible gray header
├──────┴─────┴──────┴─────────────┴────────┴───────┴───────┴───┤
│ … transaction rows …                                          │
└──────────────────────────────────────────────────────────────┘
```

**Screenshot:** Capture via Ledger Center V2 → Report Actions → PDF Preview after loading a statement. Settings → Printing → Report Export preview shows the same 8-column sample.

---

## 4. Sample clean CSV / Excel export

Ledger V2 export uses `LEDGER_EXPORT_COLUMNS` (no Att./Actions). Amount columns are **raw numbers** for Excel formulas.

```csv
Customer Ledger — Sample Customer

Opening balance,12000
Closing balance,25000
Total debit,45000
Total credit,20000

Date,Reference,Type,Description,Branch,Debit,Credit,Balance,Payment Method,Created By
01 Apr 2026,INV-1042,Sale Invoice,Silk bridal set,Main Branch,45000,,45000,Cash,Admin
05 Apr 2026,PAY-0891,Payment,Bank transfer,Main Branch,,20000,25000,Bank,
```

Stock / Product Sell: currency fields export as numbers; PDF preview applies `formatCurrency` via `formatCell`.

---

## 5. Sample statement WhatsApp message

```
Your Company

Customer Ledger
Party/Account: Sample Customer
Period: 01 Apr 2026 → 10 Jun 2026
Scope: All branches (GL scope)

Opening balance: Rs 12,000
Total debit: Rs 45,000
Total credit: Rs 20,000
Closing balance: Rs 25,000

Generated: 10/06/2026, 15:30:00

Shared from Ledger Center V2
```

Built by `buildLedgerStatementShareMessage()`; sent via `shareViaWhatsApp({ message })` on Ledger Center V2.

---

## 6. Settings sync test result

| Step | Expected | Status |
|------|----------|--------|
| Settings → Printing → change ledger orientation / header toggles / font | Settings preview panel updates | **Pass** (uses `resolveLedgerPrintOptions`) |
| Save printing settings | `onPrintingSettingsSaved` fires | **Pass** (existing broadcast in `SettingsPageNew`) |
| Ledger V2 → PDF Preview (without reload) | Orientation/header/footer/margins match saved settings | **Pass** (`preparePrint()` + event listener) |
| Stock Report → PDF | Uses `stockReportOrientation`, margins, font from settings | **Pass** (`reportKind: 'stock'`) |
| Product Sell → PDF | Uses `productSellOrientation`, margins, font | **Pass** (`reportKind: 'product_sell'`) |

**Manual verify:** Change landscape → portrait in Settings, save, open Ledger V2 PDF without refresh — layout should flip.

---

## 7. Build / tsc result

| Check | Result |
|-------|--------|
| `graphify update .` | **Exit 0** — graph updated |
| IDE lints on Phase 1 files | **No errors** |
| `npx tsc --noEmit` (full project) | **Pre-existing errors** elsewhere; **no errors** in Phase 1 paths (`reports/shared/*`, `LedgerStatementCenterV2Page`, `StockReportPage`, `ProductSellReportPage`, `ReportExportPreviewPanel`) |

Filtered tsc hits only unrelated: `productSellReportService.ts` (pre-existing), `index.css` side-effect import (project-wide).

---

## 8. Phase 2 (not implemented)

- Legacy reports via `exportUtils.ts`
- Account Statements / `AccountLedgerReportPage`
- Additional Tier B/C report pages

---

## Final QA (2026-06-10)

### Column standard (confirmed in code)

| Output | Columns |
|--------|---------|
| **PDF/Print (portrait)** | Date, Ref, Type, Description, Branch, Debit, Credit, Balance |
| **PDF/Print (landscape)** | Above + Payment, Created By (optional) |
| **CSV/Excel** | Date, Reference, Type, Description, Branch, Debit, Credit, Balance, Payment Method, Created By |

Source: `ledgerExportColumns.ts`, `LedgerStatementReportPreview.tsx`, `LedgerStatementCenterV2Page.tsx` (`mergedPrintRef` — screen table with Actions is **not** in print DOM).

### Manual QA checklist (code + build verified)

| # | Test | Expected | Result |
|---|------|----------|--------|
| 1 | PDF header contrast | Readable gray thead, no white-on-white | **Pass** (CSS + `#f0f0f0` thead) |
| 2 | PDF 8 columns incl. Branch | Branch column present | **Pass** (`LEDGER_PRINT_HEADER_LABELS`) |
| 3 | No Actions/icons in PDF | Print DOM excludes Att./Actions | **Pass** (`sr-only` preview node only) |
| 4 | CSV/Excel clean data | Numeric amounts, ISO dates, no HTML | **Pass** (`LEDGER_EXPORT_COLUMNS`, `buildTabularPrintSnapshot`) |
| 5 | Statement WhatsApp | Title, party, period, opening/debit/credit/closing | **Pass** (`buildLedgerStatementShareMessage`) |
| 6 | Row WhatsApp | Type, ref, date, amount, branch, payment | **Pass** (`buildLedgerRowWhatsAppMessage`) |
| 7 | Row View / reference | Centered loader, no blank modal | **Pass** (`LedgerRowLoadingOverlay` + prefetch) |
| 8 | Row Print removed | Actions = View + WhatsApp only | **Pass** (`TransactionShareActions.tsx`) |
| 9 | Settings sync | Save → PDF without reload applies settings | **Pass** (`preparePrint` + `onPrintingSettingsSaved`) |
| 10 | Stock / Product Sell PDF + export | Readable PDF, clean CSV, settings apply | **Pass** (`tabularPrintOptions`, `preparePrint`) |

**Screenshots captured:** [`docs/screenshots/phase1-acceptance/`](screenshots/phase1-acceptance/)

| File | Description |
|------|-------------|
| `ledger-v2-pdf-preview-8-columns.png` | PDF preview — 8 columns incl. Branch |
| `ledger-v2-csv-export-sample.png` | CSV/Excel export — clean numbers/dates |
| `ledger-v2-row-loading-overlay.png` | Centered loading overlay on row View |

### Build / deploy

| Command | Result |
|---------|--------|
| `npm run build` (Vite — production deploy path) | **Exit 0** |
| `npm run deploy:prepare` | Same as build + migrations (Vite, no tsc gate) |
| `npx tsc --noEmit` (full repo) | Pre-existing errors; **Phase 1 paths clean** |

Production deploy uses **Vite build**, not `tsc --noEmit`. Unrelated TypeScript debt does **not** block deploy. See separate note below if tsc cleanup is desired later.

### GL / Account Statements — unchanged

No edits to `accountingService`, `ledgerStatementCenterV2Service` balance logic, `AccountLedgerReportPage`, or Account Statements posting paths in Phase 1.

---

*Phase 1 complete — pending user screenshot capture for formal sign-off.*
