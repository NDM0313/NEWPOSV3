# Phase 2.10 — Ledger V2 loader swap inventory

**Generated:** 2026-06-25  
**Scope:** Ledger Statement V2 (`LedgerStatementCenterV2Page`) — DIN CHINA pilot only  
**Current state:** Main table = legacy; unified = manual preview toggle only  

---

## 1. Main data load path (today)

| Layer | File | Function / hook | Behavior |
|-------|------|-----------------|----------|
| Page | `src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx` | `loadStatement()` | Always calls `getLedgerStatementV2` → `setResult(data)` |
| Service | `src/app/services/ledgerStatementCenterV2Service.ts` | `getLedgerStatementV2` | `loadGlEntries` → `glToRows` → enrich attachments/names → summary |
| Trigger | Same page | `useEffect` on `[companyId, entityId, statementType, fromDate, toDate]` | Reloads on entity/period change |
| Filters passed to loader | Same | `branchId: 'all'`, `transactionType: 'all'`, `search: ''` | Display filters applied **client-side** after load |

**Stage 2 flags do not branch `loadStatement`.** Resolver mode affects banners/preview only.

---

## 2. Unified preview path (parallel, manual toggle)

| Layer | File | Function | Behavior |
|-------|------|----------|----------|
| Page | `LedgerStatementCenterV2Page.tsx` | `loadUnifiedPreview()` | Runs only when `unifiedPreviewEnabled === true` |
| Service | `src/app/services/ledgerStatementCenterV2UnifiedPreviewService.ts` | `loadLedgerV2UnifiedPreview` | `getUnifiedPartyLedger` / `getUnifiedAccountLedger` with **`shadowForce: true`** |
| Mapper | `src/app/lib/ledgerStatementV2UnifiedMapper.ts` | `mapUnifiedRowsToLedgerV2` | Unified RPC row → `LedgerStatementV2Row` (no `glEntry`, no attachments) |
| Diff | `src/app/lib/ledgerStatementV2UnifiedPreviewDiff.ts` | `compareLedgerV2UnifiedPreview` | Golden MR JALIL check in preview panel |
| UI | `LedgerV2UnifiedPreviewPanel.tsx` | — | Compare-only panel; export JSON labeled non-official |

**Comment in preview service (line 3):** *"never imported by getLedgerStatementV2"* — intentional separation today.

---

## 3. Engine / flag resolution (banner only today)

| File | Role |
|------|------|
| `src/app/lib/unifiedLedgerEngineState.ts` | `resolveUnifiedLedgerEngineState` — `mode: unified` when engine + screen flag ON and toggle OFF |
| `src/app/lib/unifiedLedgerFlagKeys.ts` | Flag key constants (no loader flag yet) |
| `src/app/hooks/useUnifiedLedgerEngineState.ts` | Hook used by Ledger V2 page |
| `src/app/lib/ledgerV2UnifiedPreviewAccess.ts` | Admin/developer role gate for preview toggle |

**`engineState.mode` usages on Ledger V2:** badges/banners in `LedgerV2UnifiedPreviewPanel` only — **not** main table routing.

---

## 4. Derived UI state (all consume `result.rows`)

| Consumer | Source rows | Notes |
|----------|-------------|-------|
| `LedgerTable` | `rows` (filtered `allRows`) | On-screen table + running balance column |
| `LedgerSummaryCards` | `summary` from `summarizeLedgerV2Rows` | Opening/closing, type-specific totals |
| `buildExportData()` | `rows` + `summary` | Excel/CSV |
| `LedgerStatementReportPreview` | `rows` + `summary` | PDF / print preview |
| `ReportActions` WhatsApp (full statement) | `summary` closing + share message builder | Full-statement share |
| `handleWhatsAppRow` | Individual `LedgerStatementV2Row` | Per-row share |
| `handleOpenRowDetail` | `prefetchLedgerRowTransaction(row)` | Needs `referenceNo` / `journalEntryId` / optional `glEntry` |
| `handlePreviewAttachments` | `getLedgerAttachmentsV2(row)` | Uses `journalEntryId` |
| `compareGlWithDocumentsV2` (diagnostic) | `result.rows` + summary | Developer integrity lab only |
| Preview diff | legacy `result.rows` vs `previewResult.rows` | Compare when toggle ON |

---

## 5. Legacy loader internals (`getLedgerStatementV2`)

| Statement type | Underlying loader (`loadGlEntries`) | Basis |
|----------------|-------------------------------------|-------|
| `customer` | Hybrid customer ledger API | Effective-party hybrid (not pure GL) |
| `supplier` | Supplier AP GL journal | GL |
| `worker` | Worker party GL journal | GL |
| `account` | Account ledger (`getAccountLedger`) | Official GL |

Unified preview RPC mapping (Phase 2.3 report):

| Type | Unified RPC | Default basis |
|------|-------------|---------------|
| customer/supplier/worker | `get_unified_party_ledger` | `effective_party` |
| account | `get_unified_account_ledger` | `official_gl` |

**Parity note:** Customer legacy path is hybrid; unified uses effective-party RPC. Stage 2 golden check (MR JALIL 216,300) passes in preview compare — main-table swap must re-verify per type.

---

## 6. Export / print / share paths

| Output | Entry | Row source | Totals source |
|--------|-------|------------|---------------|
| PDF / print | `handlePrint` → `LedgerStatementReportPreview` | Filtered `rows` | `summary` / `printOpening` |
| Excel | `exportToExcel(buildExportData())` | Filtered `rows` + summary lines | `summary` |
| CSV | `exportToCSV(buildExportData())` | Same | Same |
| Full WhatsApp | `buildLedgerStatementShareMessage` | `summary.closingBalance` etc. | `summary` |
| Row WhatsApp | `shareLedgerRowViaWhatsApp` | Single row fields | Row running balance |
| Preview JSON | `LedgerV2UnifiedPreviewPanel` download | Preview payload only | Non-official |

**All production exports today = legacy `result.rows`.** Loader swap would route exports through whichever rows populate `result` unless explicitly dual-sourced.

---

## 7. Filters, period, branch

| Input | Applied where | Loader impact |
|-------|---------------|---------------|
| `fromDate` / `toDate` | Passed to loader; embedded Accounting tab may override global header | Must match preview/production parity tests (wide range 2000→today for MR JALIL) |
| `statementType` | Entity list + loader branch | Changes RPC (party vs account) |
| `entityId` | Loader | Required |
| `transactionType` / `search` | Client `applyLedgerV2DisplayFilters` only | Does not re-fetch; summary recalculated on filtered subset |
| Branch | Fixed `all` for statements (`STATEMENT_ALL_BRANCHES_SCOPE`) | Unified RPC uses same all-branches scope |

---

## 8. Permission / role gates

| Surface | Gate |
|---------|------|
| Ledger V2 page | Standard accounting access (embedded in Accounting dashboard) |
| Unified preview toggle | `canAccessLedgerV2UnifiedPreview` — admin developer center OR integrity lab |
| Admin Compare | Admin tie-out access |
| Diagnostic doc comparison | `canAccessDeveloperIntegrityLab` |

Staff users: preview toggle hidden (waived in 2.9C soak). **Loader swap must not expose preview controls to staff**; main unified table would be visible to all users with Ledger V2 access — requires ops sign-off.

---

## 9. Proposed swap touchpoints (implementation — not in this phase)

| # | File | Change |
|---|------|--------|
| 1 | `unifiedLedgerFlagKeys.ts` | Add `LOADER_LEDGER_V2: 'unified_ledger_loader_ledger_v2'` |
| 2 | New helper e.g. `resolveLedgerV2MainLoader.ts` | `legacy` \| `unified` from loader flag + engine + screen + kill |
| 3 | `ledgerStatementCenterV2UnifiedPreviewService.ts` | Add `loadLedgerV2UnifiedMain` (`shadowForce: false`) or parametrize |
| 4 | `LedgerStatementCenterV2Page.tsx` | Branch `loadStatement` on loader resolution |
| 5 | Optional | When main=unified, preview toggle compares **legacy shadow** vs unified main (reverse compare) |
| 6 | SQL scripts | Enable/rollback loader flag DIN CHINA only |
| 7 | QA scripts | `run-phase-210-stage3-loader-browser-qa.mjs` (future) |

---

## 10. Out of scope (explicit)

- Account Statement, Trial Balance, Roznamcha, Party Ledger, Cash/Bank screens
- Other companies
- Mobile / POS clients (unless they embed Ledger V2 page — verify before any swap)
- `feature_flags` writes in this planning phase
