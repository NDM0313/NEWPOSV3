# Ledger & Statement Center V2 — Technical Note

**GL alignment report:** [LEDGER_V2_GL_ALIGNMENT_REPORT.md](./LEDGER_V2_GL_ALIGNMENT_REPORT.md)  
**Data source comparison (historical + post-alignment):** [LEDGER_V2_VS_ACCOUNT_STATEMENTS_DATA_SOURCES.md](./accounting/LEDGER_V2_VS_ACCOUNT_STATEMENTS_DATA_SOURCES.md)

## Purpose

Read-only unified statement center at `/reports/ledger-statement-center-v2`. **Official balance uses posted GL** — same `accountingService` methods as Accounting → Account Statements. Operational/document adapters are used **only** for optional developer diagnostic comparison.

## Tables / RPCs (read-only)

| Source | Used for |
|--------|----------|
| `journal_entries`, `journal_entry_lines` | All statement types via `accountingService` GL methods |
| `payments` | Attachment flags / preview |
| `sales`, `rentals`, `purchases` | Attachment flags / preview (via GL row links) |
| `contacts` | Customer / supplier entity lists |
| `accounts` | Chart of accounts selector |
| `studio_workers` (via `studioService`) | Worker list |
| `companies` | PDF/print branding |

No new migrations. No destructive SQL.

## Services reused (unchanged contracts)

- `accountingService.getCustomerLedger` — customer GL statement
- `accountingService.getSupplierApGlJournalLedger` — supplier AP GL
- `accountingService.getWorkerPartyGlJournalLedger` — worker party GL
- `accountingService.getAccountLedger` — account / COA GL
- `customerLedgerAPI`, `ledgerDataAdapters` — **diagnostic comparison only** (`ledgerStatementCenterV2Diagnostic.ts`)
- `contactService`, `accountService`, `studioService` — entity lists
- `documentShareService` — WhatsApp / share messages
- `printingSettingsService`, `getCompanyBrand` — report export branding

## V2 services

- `src/app/services/ledgerStatementCenterV2Service.ts`
  - `STATEMENT_ALL_BRANCHES_SCOPE` — matches Account Statements (undefined branchId)
  - `listLedgerEntitiesV2()`
  - `getLedgerStatementV2()` — GL-only official path; `basis: 'gl'`
  - `openLedgerRowDetailV2()` — dispatches `openTransactionDetail`
  - `getLedgerAttachmentsV2()` — JE, payment, sale, rental, purchase attachments
- `src/app/services/ledgerStatementCenterV2Diagnostic.ts`
  - `compareGlWithDocumentsV2()` — developer-only GL vs document diff

## Components reused

- `TransactionDetailModal` — reference drill-down (read-only: `autoLaunchUnifiedEdit={false}`)
- `ReportActions`, `TabularReportPreview`, `PdfPreviewModal`, `useReportExport`
- `AttachmentViewer` (as `AttachmentPreviewDialog`)
- `SearchableSelect`, `DatePicker`

## New components

Under `src/app/features/ledger-statement-center-v2/`:

- `LedgerStatementCenterV2Page` — basis banner, diagnostic toggle
- `LedgerFilterBar` — branch disabled (all branches GL scope)
- `LedgerDocumentComparisonPanel` — developer diagnostic panel
- `LedgerSummaryCards`, `LedgerTable`, `LedgerReferenceCell`, `AttachmentPreviewDialog`, `TransactionShareActions`

## Old files NOT touched

- `LedgerHub.tsx`, `GenericLedgerView.tsx`, `CustomerLedgerPageOriginal.tsx`
- `AccountLedgerReportPage.tsx`, `AccountLedgerPage.tsx`, `AccountLedgerView.tsx`
- `customerLedgerApi.ts`, `ledgerDataAdapters.ts`, `accountingService.ts` (contracts)
- All migrations / GL triggers / RLS policies

## Balance logic (post GL alignment)

- **All statement types:** posted GL via `accountingService`; rows mapped with `glToRows()`.
- **Opening / closing:** derived from GL `running_balance` on first/last row (same as account path in Account Statements).
- **Branch:** always all branches (`STATEMENT_ALL_BRANCHES_SCOPE`); branch shown per row.
- **Diagnostic:** operational adapters loaded on demand when developer toggles document comparison — does not affect official balance.

## Known limitations

1. Transaction-type and search filters apply client-side after GL fetch (same pattern as filtered views elsewhere).
2. Attachment batch queries capped at 200 IDs per table per load.
3. Document comparison requires `canAccessDeveloperIntegrityLab` role gate.
