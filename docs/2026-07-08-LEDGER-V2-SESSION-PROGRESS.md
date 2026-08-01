# Session progress — 8 Jul 2026

Ledger Statement Center V2, courier ledger, appearance settings, and related fixes.

## Completed

### Ledger Statement Center V2 — Payment & Created by

- Added `enrichLedgerV2PaymentAndAuthorship()` in [`src/app/services/ledgerStatementCenterV2Service.ts`](../src/app/services/ledgerStatementCenterV2Service.ts)
- Pure helpers in [`src/app/lib/ledgerStatementV2Enrichment.ts`](../src/app/lib/ledgerStatementV2Enrichment.ts): counter-account pick, transfer description parse, authorship from JE/payments
- Wired enrichment into **legacy** (`getLedgerStatementV2`) and **unified** (`getLedgerStatementV2UnifiedMain`) loaders
- Fixed unified mapper stub: no longer maps viewed GL `accountName` into Payment; `createdBy` enriched instead of hardcoded `—`
- [`LedgerTable.tsx`](../src/app/features/ledger-statement-center-v2/LedgerTable.tsx): Payment clickable when `paymentId`; tooltips for full labels

### Payment column — short display labels

- `shortenLedgerPaymentLabel()` strips `Receivable —`, `Payable`, `(AR-…)`, `(AP-…)`, numeric COA codes e.g. `(2031)`
- Table shows short name; hover tooltip keeps full COA label
- Unit tests: [`src/app/lib/ledgerStatementV2Enrichment.test.ts`](../src/app/lib/ledgerStatementV2Enrichment.test.ts)

### YAQOOB courier step ledger (VPS repair + UI)

- **VPS applied:** void lump PAY-0005/6/7; restored 32 remediation transfers as `courier_payment` on account 2031; delta JE Rs 136,440; balance tie-out PASS
- Scripts: [`scripts/sql/diag_yaqoob_courier_step_ledger.sql`](../scripts/sql/diag_yaqoob_courier_step_ledger.sql), [`repair_yaqoob_courier_step_ledger.sql`](../scripts/sql/repair_yaqoob_courier_step_ledger.sql), [`verify_yaqoob_courier_step_ledger.sql`](../scripts/sql/verify_yaqoob_courier_step_ledger.sql)
- Migration: [`migrations/20260708120000_courier_ledger_step_columns.sql`](../migrations/20260708120000_courier_ledger_step_columns.sql) — `journal_entry_id` / `journal_entry_line_id` on `courier_ledger` view
- UI: [`CourierReportsTab.tsx`](../src/app/components/accounting/CourierReportsTab.tsx) ascending dates, Accrued/Paid filter, stable keys
- Service: [`shipmentAccountingService.ts`](../src/app/services/shipmentAccountingService.ts) ascending order + new columns

### Appearance settings — explicit Save

- Draft state + Save button in [`AppearanceSettingsPanel.tsx`](../src/app/components/settings/AppearanceSettingsPanel.tsx)
- [`useErpTheme.ts`](../src/app/hooks/useErpTheme.ts): `previewPreferences()` / `commitPreferences()`
- [`erpThemePresets.ts`](../src/app/lib/erpThemePresets.ts): `areErpUiPreferencesEqual()`
- Wired in [`SettingsPageNew.tsx`](../src/app/components/settings/SettingsPageNew.tsx)

### Bug fixes

- [`TransactionDetailModal.tsx`](../src/app/components/accounting/TransactionDetailModal.tsx): duplicate React keys (`jel-{id}-{idx}` / `eff-{id}-{idx}`)
- [`StockMovementFilterPanel.tsx`](../src/app/components/reports/stock-movement-history/StockMovementFilterPanel.tsx): missing `cn` import (runtime crash fix)

### Build / tests

- `npm run build` — pass
- `npx tsx --test src/app/lib/ledgerStatementV2Enrichment.test.ts` — 9 tests pass
- `graphify update .` run after code edits

### Follow-up batch (9 Jul 2026)

- Branch column enrichment from JE / sale / purchase / company-wide label
- Short payment labels in CSV, PDF, and WhatsApp export
- VPS verify script: all YAQOOB courier gates PASS

---

## Remaining / follow-up

| Item | Status |
|------|--------|
| **Branch column `—`** | Done — `enrichLedgerV2BranchFromDocuments()` resolves JE branch, sale/purchase branch, or `All branches` for company-wide JEs |
| **Created by on legacy JEs** | Data gap — rows with no `created_by` and no `payment_id` stay `—` (no safe backfill without audit migration) |
| **VPS migration deploy** | Done — `courier_ledger` view has `journal_entry_id` / `journal_entry_line_id` on VPS |
| **Courier ledger smoke test** | Done — all verify gates PASS (34 rows, balance 0, 2031 net 0) — see VPS run 9 Jul 2026 |
| **Export/WhatsApp Payment text** | Done — `shortenLedgerPaymentLabel()` in CSV/PDF export + WhatsApp messages |
| **Unified RPC fields** | Optional future migration: `created_by`, `payment_id`, counter account in `get_unified_*_ledger` RPCs |
| **VPS frontend deploy** | Run `deploy-erp-domain.sh` on VPS after push to ship Ledger V2 UI changes to production |

---

## Key IDs (YAQOOB / DIN CHINA)

| Entity | UUID |
|--------|------|
| Company | `30bd8592-3384-4f34-899a-f3907e336485` |
| YAQOOB contact | `3d2e27d1-3cc8-49dc-8efc-2213b0b03877` |
| YAQOOB 2031 payable | `82f2a9a6-fc80-4af0-b63b-06b932c312e4` |
| Clearance total | Rs 24,573,440 |
| Legacy pool delta | Rs 136,440 |

---

## Files touched (this session — core)

```
src/app/lib/ledgerStatementV2Enrichment.ts
src/app/lib/ledgerStatementV2Enrichment.test.ts
src/app/services/ledgerStatementCenterV2Service.ts
src/app/services/ledgerStatementCenterV2UnifiedMainService.ts
src/app/lib/ledgerStatementV2UnifiedMapper.ts
src/app/features/ledger-statement-center-v2/LedgerTable.tsx
src/app/components/accounting/CourierReportsTab.tsx
src/app/components/accounting/TransactionDetailModal.tsx
src/app/components/reports/stock-movement-history/StockMovementFilterPanel.tsx
src/app/components/settings/AppearanceSettingsPanel.tsx
src/app/hooks/useErpTheme.ts
src/app/lib/erpThemePresets.ts
src/app/services/shipmentAccountingService.ts
migrations/20260708120000_courier_ledger_step_columns.sql
scripts/sql/diag_yaqoob_courier_step_ledger.sql
scripts/sql/repair_yaqoob_courier_step_ledger.sql
scripts/sql/verify_yaqoob_courier_step_ledger.sql
```
