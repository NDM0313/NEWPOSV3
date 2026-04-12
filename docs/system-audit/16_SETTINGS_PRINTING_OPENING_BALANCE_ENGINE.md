# 16 — Settings, Printing, and Opening Balance Engine

> Last updated: 2026-04-12

---

## Business Purpose

The Settings module is the control plane for the entire ERP. It manages document numbering sequences (ensuring unique, collision-safe numbers across all document types), print layout configuration (page size, fields, thermal, PDF), module on/off toggles (POS, Rentals, Studio, Accounting), user permissions, inventory policies (negative stock, packing), and accounting policies (fiscal year, lock date, tax rate). The Opening Balance subsystem allows a company to post its initial GL balances (customer AR, supplier AP, worker balances, inventory, and general GL accounts) as idempotent journal entries so historical data is correctly reflected before live transactions begin.

---

## UI Entry Points

| Panel | Location in Settings |
|-------|---------------------|
| General (company details, currency, fiscal year) | Settings → General |
| Sales | Settings → Sales |
| Purchases | Settings → Purchases |
| Inventory (packing, negative stock) | Settings → Inventory |
| Accounting (fiscal year dates, lock date, default accounts) | Settings → Accounting |
| System (modules, backup, health, lead tools) | Settings → System |
| Access (users, branches) | Settings → Access |
| Workforce (employees) | Settings → Workforce |
| Numbering (rules, maintenance, audit) | Settings → Numbering |
| Printing | Settings → Printing |

**Component:** `src/app/components/settings/SettingsPageNew.tsx`

`MainTab` type: `'general' | 'sales' | 'purchases' | 'inventory' | 'accounting' | 'system' | 'access' | 'workforce' | 'numbering' | 'printing'`

---

## Frontend Files

| File | Role |
|------|------|
| `src/app/components/settings/SettingsPageNew.tsx` | Main settings shell; tab routing, form state per panel, save orchestration |
| `src/app/components/settings/NumberingPanel.tsx` | Numbering tab — sub-tabs: `rules`, `maintenance`, `audit` |
| `src/app/components/settings/NumberingRulesTable.tsx` | Editable table of prefix / padding / year_reset per document type |
| `src/app/components/settings/NumberingMaintenanceTable.tsx` | Sync analysis: DB max vs sequence `last_number`; fix out-of-sync |
| `src/app/components/settings/NumberAuditTable.tsx` | Audit log of numbering changes |
| `src/app/components/settings/PrintingSettingsPanel.tsx` | Printing configuration — page setup, field toggles, layout, thermal, PDF |
| `src/app/components/erp-permissions/ErpPermissionArchitecturePage.tsx` | Permission management (access control v2) |
| `src/app/components/settings/EmployeesTab.tsx` | Workforce / employee management |
| `src/app/components/settings/inventory/InventoryMasters.tsx` | Inventory masters sub-settings |
| `src/app/components/settings/LeadTools.tsx` | Lead management tools (system tab) |

---

## Backend Services

| Service | Key Functions |
|---------|---------------|
| `settingsService` | `getSetting()`, `setSetting()`, `getAllSettings()`, `getModuleConfig()`, `setModuleEnabled()`, `getErpDocumentSequences()`, `setErpDocumentSequence()`, `getNextDocumentNumber()`, `getAllowNegativeStock()`, `setEnablePacking()` |
| `globalSettingsService` | `getSetting<T>(companyId, key)` — cached (1-minute TTL) read from `settings` or `companies` columns; `invalidateSetting()` |
| `documentNumberService` | `getNextDocumentNumber()` → `generate_document_number` RPC; `getNextDocumentNumberGlobal()` → `get_next_document_number_global` RPC; `checkDocumentNumberExists()`; `getMaxDocumentNumber()` |
| `numberingMaintenanceService` | `analyze()` — compare DB max vs `erp_document_sequences.last_number`; detects out-of-sync |
| `printingSettingsService` | `get(companyId)`, `update(companyId, settings)`, `getMerged(companyId)` — reads/writes `companies.printing_settings` JSONB |
| `openingBalanceJournalService` | `syncFromContactRow()`, `postGlAccountOpening()`, `postInventoryOpening()` — idempotent GL posting |
| `invoiceDocumentService` | Template CRUD for `invoice_documents` table (legacy per-company template rows) |

---

## DB Tables

### `settings`
Key-value store scoped to `company_id`. Unique constraint on `(company_id, key)`.
- **Read:** `settingsService.getSetting(companyId, key)`, `globalSettingsService.getSetting(companyId, key)` (with cache).
- **Write:** `settingsService.setSetting()` — upserts on `company_id,key`.
- Notable keys: `inventory_settings` (JSONB: `{ negativeStockAllowed: bool }`), `enable_packing` (bool), `allow_negative_stock` (legacy bool).

### `modules_config`
Module toggle table scoped to `company_id`. Unique on `(company_id, module_name)`.
- Columns: `company_id`, `module_name`, `is_enabled`, `updated_at`.
- Note: `config` column does **not** exist in DB schema — `setModuleEnabled()` silently ignores `config` param and has fallback for `PGRST204` schema cache errors.
- **Read:** `getModuleConfig()`, `getAllModuleConfigs()`.
- **Write:** `setModuleEnabled()` — upserts.

### `erp_document_sequences`
Primary numbering engine table. Unique on `(company_id, branch_id, document_type, year)`.
- Columns: `company_id`, `branch_id`, `document_type`, `prefix`, `last_number`, `padding`, `year_reset`, `branch_based`, `year`, `updated_at`.
- Sentinel `branch_id = '00000000-0000-0000-0000-000000000000'` is used for company-level (non-branch-scoped) sequences.
- Numbers are generated atomically by the `generate_document_number` Supabase RPC (no client-side increments).

### `document_sequences` (legacy)
Older numbering table — `(company_id, branch_id, document_type)` with `prefix`, `current_number`, `padding`. Used as fallback when `erp_document_sequences` RPC fails.

### `document_sequences_global`
Backing store for `get_next_document_number_global` RPC. Handles `SL`, `PS`, `SDR`, `SQT`, `SOR`, `STD`, `PUR`, `PDR`, `POR`, `PAY`, `RNT`, `CUS` type prefixes at the company level.

### `companies.printing_settings`
JSONB column on the `companies` row. Contains the full `CompanyPrintingSettings` object. Read/written by `printingSettingsService.get()` / `printingSettingsService.update()`. Not a separate table.

### `journal_entries` (opening balance)
Opening balance JEs are regular journal entries with `reference_type` = one of the `OPENING_BALANCE_REFERENCE` constants and `reference_id` = the relevant entity ID.

---

## Document Numbering System

### Two engines, one canonical path

**ERP Numbering Engine (primary):**
- Function: `documentNumberService.getNextDocumentNumber(companyId, branchId, documentType)`
- RPC: `generate_document_number(p_company_id, p_branch_id, p_document_type, p_include_year)`
- Table: `erp_document_sequences`
- Format: `PREFIX-NNNN` (default) or `PREFIX-YY-NNNN` (when `includeYear = true`)
- Supported `ErpDocumentType` values: `sale`, `purchase`, `payment`, `supplier_payment`, `customer_receipt`, `expense`, `rental`, `stock`, `stock_adjustment`, `journal`, `product`, `studio`, `job`, `pos`, `customer`, `supplier`, `worker`

**Global Document Numbering (secondary, for sale-lifecycle types):**
- Function: `documentNumberService.getNextDocumentNumberGlobal(companyId, type)`
- RPC: `get_next_document_number_global(p_company_id, p_type)`
- Table: `document_sequences_global`
- Used by `SalesContext.createSale()` for all sale lifecycle stages

**Legacy fallback:**
- `settingsService.getDocumentSequence()` → `document_sequences` table → `current_number + 1` with client-side increment (not atomic).

### Which engine per document type

| Document | Service entry point | Sequence table |
|----------|--------------------|--------------:|
| New sale (final invoice) | `getNextDocumentNumberGlobal(companyId, 'SL')` | `document_sequences_global` |
| POS sale | `getNextDocumentNumberGlobal(companyId, 'PS')` | `document_sequences_global` |
| Studio sale | `getNextDocumentNumberGlobal(companyId, 'STD')` | `document_sequences_global` |
| Sale draft | `getNextDocumentNumberGlobal(companyId, 'SDR')` | `document_sequences_global` |
| Sale quotation | `getNextDocumentNumberGlobal(companyId, 'SQT')` | `document_sequences_global` |
| Sale order | `getNextDocumentNumberGlobal(companyId, 'SOR')` | `document_sequences_global` |
| Purchase | `getNextDocumentNumber(companyId, branchId, 'purchase')` | `erp_document_sequences` |
| Expense | `getNextDocumentNumber(companyId, branchId, 'expense')` | `erp_document_sequences` |
| Payment (outgoing) | `getNextDocumentNumber(companyId, branchId, 'supplier_payment')` | `erp_document_sequences` |
| Customer receipt | `getNextDocumentNumber(companyId, branchId, 'customer_receipt')` | `erp_document_sequences` |
| Rental | `getNextDocumentNumber(companyId, branchId, 'rental')` | `erp_document_sequences` |
| Journal entry | `getNextDocumentNumber(companyId, branchId, 'journal')` | `erp_document_sequences` |
| Product SKU | `documentNumberService.getNextProductSKU()` → type `product` | `erp_document_sequences` |
| Production SKU | `getNextProductionProductSKU()` — legacy: DB max + 1, no RPC | computed client-side |

---

## Numbering Formats

| Prefix | Document type | Example | Engine |
|--------|--------------|---------|--------|
| `SL-` | Sales invoice (final) | `SL-0001` | `document_sequences_global` type `SL` |
| `PS-` | POS sale | `PS-0001` | `document_sequences_global` type `PS` |
| `STD-` | Studio sale | `STD-0001` | `document_sequences_global` type `STD` |
| `SDR-` | Sale draft | `SDR-0001` | `document_sequences_global` type `SDR` |
| `SQT-` | Sale quotation | `SQT-0001` | `document_sequences_global` type `SQT` |
| `SOR-` | Sale order | `SOR-0001` | `document_sequences_global` type `SOR` |
| `PUR-` | Purchase order | `PUR-0001` | `erp_document_sequences` type `purchase` |
| `PDR-` | Purchase draft | `PDR-NNNN` | `document_sequences_global` type `PDR` |
| `POR-` | Purchase order (alt) | `POR-NNNN` | `document_sequences_global` type `POR` |
| `PAY-` | Payment | `PAY-0001` | `erp_document_sequences` type `payment`; filtered as `/^PAY-\d/i` |
| `EXP-` | Expense | `EXP-0001` | `erp_document_sequences` type `expense` |
| `REN-` | Rental booking | `REN-0001` | `erp_document_sequences` type `rental` |
| `PRD-` | Product SKU | `PRD-0001` | `erp_document_sequences` type `product` |
| `STD-PROD-` | Production product SKU | `STD-PROD-00001` | computed (DB max + 1, 5-digit pad) |
| `CUS-` | Customer | `CUS-NNNN` | `document_sequences_global` type `CUS` |
| `JE-OB-` | Opening balance journal entry | `JE-OB-{timestamp}-{rand}` | generated in `openingBalanceJournalService` |

Padding is typically 4 digits (`NNNN`). `includeYear = true` produces `PREFIX-YY-NNNN` (e.g. `SL-26-0001`).

The **Numbering Maintenance** tool (`numberingMaintenanceService.analyze()`) cross-checks `erp_document_sequences.last_number` against the actual DB max for each document type and flags `status: 'out_of_sync'` when they diverge.

---

## Printing Settings

Settings are stored as a single JSONB object in `companies.printing_settings`. The `printingSettingsService` reads and writes this column. `getMerged()` calls `mergeWithDefaults()` to layer saved values over system defaults before use by print components.

### `CompanyPrintingSettings` structure (`src/app/types/printingSettings.ts`)

| Property | Type | Default |
|----------|------|---------|
| `pageSetup.pageSize` | `'A4' \| 'Legal' \| 'Letter' \| 'Thermal58mm' \| 'Thermal80mm'` | `'A4'` |
| `pageSetup.orientation` | `'portrait' \| 'landscape'` | `'portrait'` |
| `pageSetup.margins` | `{ top, bottom, left, right: number }` | `{ top:16, bottom:16, left:16, right:16 }` |
| `fields.showLogo` | bool | `true` |
| `fields.showCompanyAddress` | bool | `true` |
| `fields.showPhone` | bool | `true` |
| `fields.showEmail` | bool | `true` |
| `fields.showCustomerAddress` | bool | `true` |
| `fields.showSku` | bool | `true` |
| `fields.showDiscount` | bool | `true` |
| `fields.showTax` | bool | `true` |
| `fields.showBarcode` | bool | `false` |
| `fields.showQRCode` | bool | `false` |
| `fields.showSignature` | bool | `false` |
| `fields.showTerms` | bool | `false` |
| `fields.showNotes` | bool | `true` |
| `fields.showStudioCost` | bool | `true` |
| `layout.header` | `{ logoPosition, companyDetailsPosition, invoiceTitlePosition }` | all `'left'`/`'center'` |
| `layout.table.columns` | `string[]` | `['product','qty','rate','amount']` |
| `thermal.showLogo` | bool | `true` |
| `thermal.showQR` | bool | `false` |
| `thermal.showCashier` | bool | `true` |
| `thermal.compactMode` | bool | `true` |
| `pdf.fontSize` | number | `12` |
| `pdf.fontFamily` | string | `'Inter'` |
| `pdf.includeWatermark` | bool | `false` |
| `defaultInvoiceType` | `'standard' \| 'packing' \| 'pieces' \| 'summary' \| 'detailed'` | `'standard'` |
| `documentTemplates` | `DocumentTemplateId[]` | see below |

Default document templates: `['sales_invoice', 'purchase_invoice', 'ledger_statement', 'payment_receipt', 'packing_list', 'delivery_note', 'courier_slip']`

A legacy system also maintains `invoice_documents` table rows via `invoiceDocumentService` with per-company template overrides (`show_sku`, `show_discount`, `show_tax`, `show_studio`, `show_signature`, `logo_url`, `footer_note`). This is separate from the unified `companies.printing_settings` JSONB path.

---

## Opening Balance Flow

`openingBalanceJournalService` posts the company's initial GL balances. All entries are **idempotent**: if an active JE already exists for the same `(reference_type, reference_id)` pair with the correct primary-account net, it is kept unchanged. Amount changes trigger: void old JE → create new JE.

### Exported service object: `openingBalanceJournalService`

**`syncFromContactRow(contactId)`** — triggered when a contact's opening balance is saved:
- Loads `contacts` row: `opening_balance` (AR), `supplier_opening_balance` (AP), worker-specific.
- For customers/both: posts **Dr AR (1100) / Cr Owner Capital (3000)** if `opening_balance > 0`.
- For suppliers/both: posts **Dr Owner Capital (3000) / Cr AP (2000)** if `supplier_opening_balance > 0`.
- For workers: posts **Dr Worker Advance (1180) / Cr Worker Payable (2010)**.
- Uses `OPENING_BALANCE_REFERENCE.CONTACT_AR`, `.CONTACT_AP`, `.CONTACT_WORKER` as `reference_type`.

**GL Account opening** (mapped to `OPENING_BALANCE_REFERENCE.GL_ACCOUNT`):
- Asset accounts: **Dr Asset account / Cr Owner Capital (3000)**.
- Liability accounts: **Dr Owner Capital (3000) / Cr Liability account**.
- Equity accounts: balanced against itself.

**Inventory opening** (`OPENING_BALANCE_REFERENCE.INVENTORY_OPENING`):
- Per `stock_movements` row tagged as opening.
- Posts **Dr Inventory Asset (1200) / Cr Owner Capital (3000)**.
- Calls `voidMisclassifiedStockAdjustmentJesForMovement()` to void any legacy `stock_adjustment` JEs for the same movement.

**Equity account resolution** (`resolveOpeningEquityAccountId`):
1. Looks up account code `3000` (Owner Capital / Capital).
2. Falls back to any `type = 'equity'` account matching `/capital|owner|opening/i`.
3. Falls back to any equity-type account.
4. Throws if none found.

**Money tolerance:** `MONEY_EPS = 0.02` — differences ≤ 0.02 are treated as matching (float rounding).

**JE format:**
```
entry_no:         JE-OB-{timestamp}-{rand4}   (or INV-OB-{prefix} for inventory)
reference_type:   opening_balance_contact_ar | opening_balance_contact_ap |
                  opening_balance_contact_worker | opening_balance_account |
                  opening_balance_inventory
reference_id:     entity UUID (contact, account, or stock_movement)
```

---

## Feature Flags Management

Feature flags are stored in `modules_config` table (`module_name`, `is_enabled`). Read/write via `settingsService.getModuleConfig()` / `setModuleEnabled()`.

The Settings → System panel exposes a `modulesForm` state object with the following toggles:

| UI label | `module_name` / form key | Notes |
|----------|--------------------------|-------|
| POS | `posModuleEnabled` | Enables/disables POS view |
| Rentals | `rentalModuleEnabled` | Enables Rentals module |
| Studio | `studioModuleEnabled` | Enables Studio/Production module |
| Accounting | `accountingModuleEnabled` | Enables full double-entry accounting |

**`localStorage`** interaction: `localStorage.removeItem('erp_modules')` is called in one Settings path to clear a cached module list (forces re-read from DB on next load). This is the only `localStorage` usage identified in the settings flow.

---

## Module Toggles

Full module list managed in `modules_config` via `settingsService.setModuleEnabled(companyId, moduleName, isEnabled)`:

- `pos` — Point of Sale terminal
- `rental` — Rentals module
- `studio` — Studio/Production module
- `accounting` — Accounting / double-entry ledger

Other ERP features (manufacturing, repairs, loyalty) are not yet exposed as `modules_config` rows in the current codebase — they may be planned or handled via `settings` key-value flags.

**Known schema issue:** `modules_config` has no `config` column. `setModuleEnabled()` contains double-retry logic: first attempt with potential `config`, on `PGRST204` error retry without. On `42501` / `PGRST301` (RLS denied) the function returns a mock object silently instead of throwing.

---

## Settings Persistence

| Setting | Storage location | Read path | Write path |
|---------|-----------------|-----------|------------|
| Company name, currency, timezone, date_format, fiscal year, logo | `companies` table columns | `globalSettingsService.getSetting()` via `COMPANY_KEYS` map | Direct update to `companies` row |
| Inventory policy (negative stock, packing) | `settings` table, keys `inventory_settings`, `enable_packing` | `settingsService.getSetting()` | `settingsService.setSetting()` |
| Accounting policy (fiscal year, lock date, tax rate, default accounts) | `settings` table, key `accounting_settings` | `settingsService.getSetting()` | `settingsService.setSetting()` |
| Module on/off | `modules_config` table | `settingsService.getModuleConfig()` | `settingsService.setModuleEnabled()` |
| Document numbering | `erp_document_sequences` (primary), `document_sequences_global` (global), `document_sequences` (legacy fallback) | `settingsService.getErpDocumentSequences()` | `settingsService.setErpDocumentSequence()` via RPC |
| Printing layout | `companies.printing_settings` JSONB | `printingSettingsService.get()` | `printingSettingsService.update()` |
| Invoice templates (legacy) | `invoice_documents` table | `invoiceDocumentService` | `invoiceDocumentService` |
| Opening balances | `journal_entries` + `journal_entry_lines` | reporting queries | `openingBalanceJournalService.*` |
| `globalSettingsService` cache | In-memory `Map` (1-minute TTL) | Automatic on read | `invalidateSetting(companyId, key)` |
| Module list (browser cache) | `localStorage` key `erp_modules` | On app load | Cleared via `localStorage.removeItem('erp_modules')` in Settings |

---

## Known Failure Points

1. **`modules_config` RLS silent failure** — `setModuleEnabled()` catches `42501`/`PGRST301` and returns a mock object without telling the user. The toggle appears to save in the UI but the DB row is never updated.

2. **Split numbering engines** — `erp_document_sequences` and `document_sequences_global` are two separate counters. If `get_next_document_number_global` is not migrated on a tenant, `SalesContext.createSale()` falls back to a client-side generated number (non-atomic), risking duplicates.

3. **Legacy `document_sequences` fallback is not atomic** — `getNextDocumentNumber()` in `settingsService` reads `current_number`, adds 1, and writes back in two separate queries. Concurrent saves can generate the same number.

4. **`printing_settings` is one JSONB blob** — partial updates via `printingSettingsService.update()` overwrite the entire JSON. If two tabs save different sub-sections simultaneously, one save will overwrite the other.

5. **Opening balance equity account required** — `resolveOpeningEquityAccountId()` throws if no `3000` or equity-type account exists. If `defaultAccountsService.ensureDefaultAccounts()` has not been run, opening balance save will hard-fail with no user-facing guidance.

6. **Opening balance `voidMisclassifiedStockAdjustmentJesForMovement()`** — voids all `stock_adjustment` type JEs for a movement ID silently. If called on a production movement that legitimately has a stock_adjustment JE, it will be voided incorrectly.

7. **`globalSettingsService` 1-minute cache** — Settings saved in one tab will not be reflected immediately in another tab or in background services that read via `getSetting()`. `invalidateSetting()` must be called explicitly after writes; it is not called automatically by `settingsService.setSetting()`.

8. **`modules_config.config` column ghost** — Dead code in `setModuleEnabled()` attempts to pass a `config` property that the DB schema does not support, requiring retry logic on every write. The `config` parameter should be removed.

---

## Recommended Standard

1. **Consolidate to a single numbering engine.** Retire `document_sequences` (legacy) entirely. Migrate all types currently in `document_sequences_global` into `erp_document_sequences` with a unified `generate_document_number` RPC, so there is one atomic counter per document type.

2. **Make `setModuleEnabled()` transparent on RLS failure.** Surface the error to the UI rather than returning a mock success. The user should know the module toggle did not save.

3. **Atomic partial updates for `printing_settings`.** Use Postgres JSONB merge (`||` operator) in an RPC instead of full replacement, to prevent concurrent panel saves from overwriting each other.

4. **Auto-invalidate `globalSettingsService` cache on write.** `settingsService.setSetting()` and `printingSettingsService.update()` should call `globalSettingsService.invalidateSetting(companyId, key)` so the 1-minute cache does not serve stale values after an in-session change.

5. **Guard opening balance posts behind account existence check.** Before calling any `openingBalanceJournalService.*` function, verify that the required accounts (1100, 2000, 3000, etc.) exist and show a setup prompt if they do not — instead of throwing an uncaught exception.

6. **Remove `modules_config.config` dead code.** Delete the `config` parameter from `setModuleEnabled()` and the dual-retry block entirely, since the column does not exist in the DB schema.
