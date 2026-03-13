# ERP Duplicate Table Analysis (Safe Cleanup Plan)

**Purpose:** Identify canonical vs legacy tables for duplicate structures. **No schema changes in this phase** — documentation and migration plan only.

---

## 1. sale_items vs sales_items

### 1.1 Application usage

| Location | Table used | Pattern |
|----------|------------|--------|
| **saleService.ts** | `sales_items` first, fallback `sale_items` | Select, insert path tries sales_items then sale_items |
| **SalesContext.tsx** | **sales_items** for write | Delete old then insert into `sales_items`; fallback read from `sale_items` |
| **dashboardService.ts** | sales_items first, then sale_items | getSalesByCategory |
| **packingListService.ts** | sales_items first, then sale_items | Sale line items |
| **customerLedgerApi.ts** | sales_items | items:sales_items in select |
| **studioProductionService.ts** | sales_items first, sale_items fallback | Studio line add/update |
| **studioProductionInvoiceSyncService.ts** | **sales_items** | generated_invoice_item_id = sales_items.id |
| **studioCustomerInvoiceService.ts** | sales_items first, sale_items fallback | |
| **StudioSaleDetailNew.tsx** | sales_items primary, sale_items fallback insert | |
| **saleReturnService.ts** | sales_items first, sale_items fallback | sale_item_id FK points to sale_items only when items from sale_items |
| **accountingReportsService.ts** | **sale_items** only | getSalesProfit, profit by product/customer |
| **bulkInvoiceService.ts** | sales_items first, sale_items fallback | |
| **CustomerLedgerPage.tsx / ItemPurchaseTable.tsx** | sales_items first, sale_items fallback | |
| **erp-mobile-app** (sales.ts, packingList.ts, studio.ts) | sales_items insert/select, sale_items fallback | |

**Conclusion (app):** Application **prefers sales_items** for insert/select everywhere except **accountingReportsService** (which uses **sale_items** only). SalesContext and studio sync write to **sales_items**.

### 1.2 Triggers and foreign keys

| Artifact | Table | Source |
|----------|--------|--------|
| **trigger_calculate_sale_totals** | **sale_items** | db_triggers_snapshot: event_object_table = sale_items (INSERT/UPDATE) |
| **sale_final_stock_movement_trigger** | reads **sales_items** first, then **sale_items** | sale_final_stock_movement_trigger.sql |
| **RLS policies** | **sale_items** | enterprise_defaults_and_rls_isolation.sql, sales_products_rls_role_based.sql |
| **Idx** | **sales_items** | idx_sales_items_sale_id (final_web_erp_performance_indexes.sql) |
| **studio_productions.generated_invoice_item_id** | **sales_items.id** | studio_productions_generated_invoice_item.sql COMMENT |
| **sale_return_items.sale_item_id** | Can reference either; code prefers sale_items when items from sale_items | saleReturnService comment |

So: **sale_items** has the totals trigger and RLS. **sales_items** has index and is the target for studio generated line and most app writes. Both tables exist; app uses **sales_items** as primary and **sale_items** as fallback (and accountingReportsService uses only sale_items).

### 1.3 Canonical vs legacy (recommendation)

| Role | Table | Reason |
|------|--------|--------|
| **Canonical** | **sales_items** | Used for inserts (SalesContext, mobile, studio sync), preferred in reads, has is_studio_product, generated_invoice_item_id points here |
| **Legacy** | **sale_items** | Original schema (03); has trigger_calculate_sale_totals and RLS; still read by many services as fallback and by accountingReportsService exclusively |

**Dependencies to fix before any drop:**

- **accountingReportsService**: Currently uses **sale_items** only — must be switched to use **sales_items** (with fallback to sale_items) for consistency.
- **Triggers:** If consolidating to one table, either (a) move trigger_calculate_sale_totals to **sales_items** and add RLS to sales_items (if not already), or (b) keep both tables and document sale_items as legacy read-only.
- **sale_return_items.sale_item_id:** FKs may point to sale_items or sales_items depending on which table the return was created from; do not drop sale_items while returns reference it.

### 1.4 Migration plan (when applying later)

1. **Do not drop either table yet.**
2. Add **comment on table sale_items**: `COMMENT ON TABLE sale_items IS 'LEGACY: Prefer sales_items. Used as fallback and by sale_return_items.sale_item_id; trigger_calculate_sale_totals here.'`
3. Ensure **sales_items** has equivalent trigger (trigger_calculate_sale_totals) if all new writes go to sales_items and totals must be maintained; else keep both.
4. Update **accountingReportsService** to use sales_items first, then sale_items (match rest of app).
5. After all code paths use sales_items and no FKs point to sale_items, consider: (a) keeping sale_items as read-only legacy, or (b) one-time migration of remaining sale_items rows into sales_items and then deprecate sale_items (requires FK and trigger migration).

---

## 2. accounts vs chart_accounts

### 2.1 Application usage

| Location | Table | Usage |
|----------|--------|--------|
| **accountService** | **accounts** | getAllAccounts, createAccount, getAccountByCode, etc. |
| **chartAccountService** | **accounts** (via accountService) | getAllAccounts → accountService.getAllAccounts; createAccount → accountService.createAccount. Maps ChartAccount ↔ accounts row. |
| **accountingService** | **journal_entries**, **journal_entry_lines**, **accounts** | All journal logic uses accounts (journal_entry_lines.account_id → accounts) |
| **journal_entry_lines** | FK account_id | References **accounts**.id |

**chart_accounts:** No `.from('chart_accounts')` in app code. chartAccountService uses **accounts** only (through accountService).

### 2.2 Triggers / migrations

- **chart_accounts** and **account_transactions** appear in migrations (e.g. 16_chart_of_accounts.sql) and in db_triggers_snapshot (chart_accounts has trigger). Not used by current app services.

### 2.3 Canonical vs legacy

| Role | Table | Reason |
|------|--------|--------|
| **Canonical** | **accounts** | Used by accountService, chartAccountService, journal_entry_lines, accountingService, branches (default_cash_account_id, etc.) |
| **Legacy** | **chart_accounts** | Present in DB and triggers; not referenced by application code. Alternate chart from older design. |

### 2.4 Migration plan

1. **Do not drop chart_accounts.**
2. Add **comment**: `COMMENT ON TABLE chart_accounts IS 'LEGACY: ERP uses accounts + journal_entries + journal_entry_lines. This table is not used by application code.'`
3. If any report or RPC still reads chart_accounts, identify and document; otherwise keep as deprecated.
4. No code changes required for accounting path — app already uses only **accounts**.

---

## 3. journal_entries / journal_entry_lines vs ledger_master / ledger_entries

### 3.1 Application usage

| System | Tables | Usage |
|--------|--------|--------|
| **Double-entry (main)** | **journal_entries**, **journal_entry_lines** | accountingService.createEntry, all posting (sales, purchases, payments, expenses, refunds, studio, shipment). accountingService: "Journal-based accounting: journal_entries + journal_entry_lines only (no ledger_entries)." |
| **Supplier / user ledgers** | **ledger_master**, **ledger_entries** | ledgerService: "Supplier and User ledgers (ledger_master + ledger_entries). Customer ledger = customerLedgerApi (sales/payments). Worker = worker_ledger_entries (studio)." |
| **Worker ledger** | **worker_ledger_entries** | studioProductionService, studioCostsService, studioService — worker payments and due balance |

So: **journal_entries** + **journal_entry_lines** = canonical for **double-entry accounting**. **ledger_master** + **ledger_entries** = **subsidiary ledgers** for supplier/user (not replaced by journal in current design). **worker_ledger_entries** = studio worker ledger (separate).

### 3.2 Canonical vs legacy

| Role | Tables | Reason |
|------|--------|--------|
| **Canonical (accounting)** | **journal_entries**, **journal_entry_lines** | Single source of truth for all accounting posts |
| **Canonical (subsidiary)** | **ledger_master**, **ledger_entries** | Actively used for supplier/user ledgers; not duplicate of journal — complementary |
| **Canonical (studio)** | **worker_ledger_entries** | Actively used for worker balances and payments |

**Conclusion:** Not a duplicate. **ledger_master / ledger_entries** are **not legacy** — they are the intended ledger for non-customer entities. Only **chart_accounts / account_transactions** are the legacy accounting path; **accounts + journal_entries + journal_entry_lines** are the canonical accounting path.

### 3.3 Migration plan

- No deprecation of ledger_master/ledger_entries.
- Document clearly: "ERP accounting = accounts + journal_entries + journal_entry_lines. Subsidiary ledgers: ledger_master/ledger_entries (supplier/user), worker_ledger_entries (workers)."

---

## 4. document_sequences vs erp_document_sequences

### 4.1 Application usage

| Location | Table | Usage |
|----------|--------|--------|
| **creditNoteService** | **document_sequences** | Next number for credit note |
| **refundService** | **document_sequences** | Next number for refund |
| **purchaseReturnService** | **document_sequences** | Return number |
| **saleReturnService** | **document_sequences** | Return number (with fallback) |
| **settingsService** | **document_sequences** (legacy) and **erp_document_sequences** | getNumberingRules → erp_document_sequences; fallback to document_sequences |
| **numberingMaintenanceService** | **erp_document_sequences** | List, upsert numbering rules |
| **NumberingRulesTable (UI)** | **erp_document_sequences** | Settings → Numbering |

### 4.2 Canonical vs legacy

| Role | Table | Reason |
|------|--------|--------|
| **Canonical** | **erp_document_sequences** | Company/branch scoped; used by settings and numbering maintenance; preferred in settingsService |
| **Legacy** | **document_sequences** | Still used by creditNoteService, refundService, purchaseReturnService, saleReturnService (and settingsService fallback) |

### 4.3 Migration plan

1. **Do not drop document_sequences.**
2. Add **comment**: `COMMENT ON TABLE document_sequences IS 'LEGACY: Prefer erp_document_sequences for new numbering. Still used by credit notes, refunds, purchase/sale returns until migrated.'`
3. **Gradual migration:** For each document type (credit note, refund, purchase return, sale return), switch to **erp_document_sequences** (same pattern as invoice numbering). Then deprecate document_sequences for that type.
4. After all callers use erp_document_sequences, mark document_sequences as legacy only and optionally migrate remaining sequences.

---

## 5. Summary table

| Pair | Canonical | Legacy | Action |
|------|-----------|--------|--------|
| Sale line items | **sales_items** | **sale_items** | Mark sale_items legacy; align accountingReportsService; add table comment; do not drop. |
| Chart of accounts | **accounts** | **chart_accounts** | Mark chart_accounts legacy (comment); no app change. |
| Accounting vs ledger | **journal_entries** + **journal_entry_lines** | — | ledger_master/ledger_entries are not legacy; keep. |
| Document numbering | **erp_document_sequences** | **document_sequences** | Mark document_sequences legacy; migrate return/credit/refund numbering to erp_document_sequences over time. |

---

*This document is part of the safe cleanup plan. No schema or data was modified.*
