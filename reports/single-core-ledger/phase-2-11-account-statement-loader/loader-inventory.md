# Phase 2.11 — loader inventory

| Component | Path | Role |
|-----------|------|------|
| Main page | `src/app/components/reports/AccountLedgerReportPage.tsx` | Loader resolution + main table + exports |
| Preview panel | `src/app/components/reports/AccountStatementUnifiedPreviewPanel.tsx` | Compare UI + QA attributes |
| Main loader resolver | `src/app/lib/resolveAccountStatementMainLoaderSource.ts` | Flag gate priority |
| Preview compare resolver | `src/app/lib/resolveAccountStatementPreviewCompareSource.ts` | Inverted compare source |
| Legacy main service | `src/app/services/accountStatementLegacyMainService.ts` | Default + shadow compare |
| Unified main service | `src/app/services/accountStatementUnifiedMainService.ts` | Unified RPC main (shadowForce: false) |
| Legacy shadow service | `src/app/services/accountStatementLegacyShadowPreviewService.ts` | Preview when main unified |
| Unified preview service | `src/app/services/accountStatementUnifiedPreviewService.ts` | Preview when main legacy |
| Mapper | `src/app/lib/accountStatementUnifiedMapper.ts` | Unified row → AccountLedgerEntry |
| Flag key | `unified_ledger_loader_account_statement` | L1 loader switch |
| Screen flag | `unified_ledger_screen_account_statement` | Screen gate |
| Exports | `exportToPDF` / `exportToExcel` via `presentedEntries` from main `entries` | Active main rows authority |
| Role gate | `canAccessAccountStatementUnifiedPreview` | Preview toggle admin-only |

**Ledger V2:** unchanged; separate flag `unified_ledger_loader_ledger_v2`.
