# Mobile Report Print / PDF / WhatsApp Sync — Delivery Report

**Scope:** `erp-mobile-app/` only. No GL, migration, or web behavior changes.

## Files changed

| File | Change |
|------|--------|
| `erp-mobile-app/src/index.css` | `display:none` print isolation; `pdf-document-compact`; ledger pagination classes |
| `erp-mobile-app/src/components/shared/PdfPreviewModal.tsx` | Compact/landscape capture, preparing overlay, action debounce |
| `erp-mobile-app/src/components/shared/usePdfPreview.ts` | Refresh `getMobilePrintingSettings` + brand on every open |
| `erp-mobile-app/src/api/mobilePrintingSettings.ts` | **New** — full settings + currency + 5 min cache |
| `erp-mobile-app/src/types/printingSettings.ts` | **New** — ported web types + `mergeWithDefaults` |
| `erp-mobile-app/src/lib/formatCurrency.ts` | **New** |
| `erp-mobile-app/src/hooks/useFormatCurrency.ts` | **New** |
| `erp-mobile-app/src/lib/reportPrintConfig.ts` | **New** |
| `erp-mobile-app/src/lib/ledgerColumnLayout.ts` | **New** |
| `erp-mobile-app/src/lib/resolveLedgerPrintOptions.ts` | **New** |
| `erp-mobile-app/src/lib/buildLedgerStatementShareMessage.ts` | **New** |
| `erp-mobile-app/src/lib/buildLedgerRowShareMessage.ts` | **New** |
| `erp-mobile-app/src/lib/formatReferenceTypeLabel.ts` | **New** |
| `erp-mobile-app/src/lib/ledgerLineToStatementRow.ts` | **New** |
| `erp-mobile-app/src/components/shared/MobileLedgerStatementPdf.tsx` | **New** — 8-column Tier A renderer |
| `erp-mobile-app/src/components/shared/ReportBrandHeader.tsx` | Field visibility toggles |
| `erp-mobile-app/src/components/shared/InvoicePreviewPdf.tsx` | Settings fields + `formatCurrency` |
| `erp-mobile-app/src/api/reports.ts` | Extended `LedgerLine`; branch name enrichment |
| `erp-mobile-app/src/api/partyGlLedger.ts` | RPC row mapping (type, branch, payment, created by) |
| `erp-mobile-app/src/api/printingSettings.ts` | Delegates to `getMobilePrintingSettings` |
| `erp-mobile-app/src/components/accounts/reports/AccountLedgerReport.tsx` | New PDF + WhatsApp text |
| `erp-mobile-app/src/components/accounts/reports/PartyLedgerReport.tsx` | New PDF + WhatsApp text |
| `erp-mobile-app/src/components/sales/SalesHome.tsx` | Compact invoice PDF + currency |

## Mobile screens updated

- **Account Ledger** — 8-column GL PDF, settings-driven header/columns/orientation
- **Customer / Supplier / Worker Ledger** — same
- **Sales → Print A4 / PDF / Share** — compact single-page capture, company currency

**Unchanged (still 6-col `LedgerPreviewPdf`):** Sales Report, Purchase Report, Expense, Studio, Rental, Inventory, Day Book, Aging, Account Summary — out of plan scope for Tier A ledger sync.

## Settings consumed from `companies.printing_settings`

| Block | Mobile use |
|-------|------------|
| `fields` | Logo, address, phone, email; invoice SKU/discount/tax/notes |
| `reportExport.ledgerPrintColumns` | Ledger PDF column order |
| `reportExport.ledgerColumnWidths` | Column width % |
| `reportExport.ledgerReportOrientation` | Portrait / landscape capture |
| `reportExport.showReportHeader` / `showReportFooter` | Ledger header block + footer |
| `reportExport.reportFontSize` | Ledger table font |
| `pdf.fontFamily` | Ledger font family |
| `pageSetup.margins` | Ledger padding |
| Company row | `currency`, `currency_symbol`, `show_currency_symbol`, `decimal_precision` |

## WhatsApp text sample (ledger statement)

```
DIN Collection
(empty line)
Customer Ledger
Party/Account: Ahmed Traders
Period: 1 Jun 2026 – 30 Jun 2026
Scope: All branches (GL scope)
(empty line)
Opening balance: Rs. 12,500.00
Total debit: Rs. 45,000.00
Total credit: Rs. 38,200.00
Closing balance: Rs. 19,300.00
(empty line)
Generated: 9/6/2026, 3:45:00 pm
(empty line)
Shared from mobile ERP
```

## Duplicate-page fix

- Removed default `min-height: 297mm` on `.pdf-document`
- Invoices use `compact` on `PdfPreviewModal` → `.pdf-document-compact`
- Print CSS uses `display:none` isolation (not `visibility:hidden` + absolute positioning)

## Build

```
cd erp-mobile-app && npm run build
```

Exit code **0** (tsc + vite production build).

## Known limitations

- No mobile Settings UI for printing (read-only from web)
- No CSV/Excel export; no Ledger Center V2 UI
- Staff statement PDF not added
- iOS WhatsApp may fall back to text (Android plugin sends PDF when available)
- Account-ledger `paymentMethod` / `createdBy` show `—` unless present in journal/RPC payload
- Other tabular reports still use legacy 6-column `LedgerPreviewPdf`

## QA checklist

1. Sale SL-0015 → Print A4 → **1 page** (no blank second page)
2. Customer ledger Share → **8 columns**, header once, closing matches GL
3. Double-tap Share → buttons disabled during “Preparing report…”
4. Currency follows web Settings (hide symbol / custom symbol)
5. Web ERP print unchanged

## GL / accounting

**No** RPC, trigger, migration, or balance logic changes. Row mapping only from existing journal/RPC fields.
