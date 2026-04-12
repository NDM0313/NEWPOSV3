# 23 — Duplicate Table Usage Verification

**Date:** 2026-04-12
**Status:** Evidence-based audit — findings require remediation before legacy retirement

---

## 1. Purpose

This document catalogues every case where two tables (or a table and a derived field) store the same logical value, identifies which is canonical, and rates the risk of the duplicate being out of sync with the canonical source.

---

## 2. Findings

---

### 2.1 sale_items vs sales_items

**Severity: P1**

| Table | Role | Evidence |
|-------|------|---------|
| sales_items | CANONICAL | SalesContext.tsx:1419/1429 — all POS INSERTs and DELETEs go here |
| sale_items | LEGACY FALLBACK | saleService.ts:378, saleReturnService.ts:398, studioProductionService.ts:381/704/710 |

**Commentary in source:**
- accountingReportsService.ts:10: `"Canonical sale line table: sales_items; fallback: sale_items (legacy)"`

**Active writes to the legacy table (P1 — should be eliminated):**

| Location | Operation |
|----------|-----------|
| studioProductionService.ts:710 | INSERT into sale_items (legacy write path) |
| AccountingIntegrityLabPage.tsx:931/933 | UPDATE sale_items directly |
| studioCustomerInvoiceService.ts:116 | INSERT into sale_items (dead code path, but still wrong) |

**Double-count risk:**
- dashboardService.ts reads BOTH tables in revenue/COGS queries. If a sale line exists in both tables (e.g., written by legacy service then re-synced), the dashboard will double-count that line's revenue and cost.

**Action required:**
1. Eliminate all writes to sale_items outside of explicitly flagged migration paths.
2. Ensure dashboardService.ts queries use UNION de-duplication or restrict to sales_items only.
3. Audit all rows in sale_items that have a matching sale_id in sales_items — flag duplicates.

---

### 2.2 inventory_balance vs stock_movements

**Severity: P3**

| Source | Role | Evidence |
|--------|------|---------|
| stock_movements | CANONICAL | inventoryService.ts:5: "Stock = movement-based only" |
| inventory_balance | DERIVED CACHE | Maintained by trigger trigger_sync_inventory_balance_from_movement |

**Application code usage:**
- ZERO instances of `.from('inventory_balance')` found in app code.
- The table is maintained entirely by the database trigger and is never queried by any service.

**Risk:** The trigger may lag or fail silently during bulk imports or direct DB inserts that bypass the trigger stack. The cached table is currently unused by the app, so the immediate risk is low.

**Action required:**
- Document the trigger dependency.
- Either promote inventory_balance to an active query target (and add a staleness check) or drop the trigger + table once confirmed unused.

---

### 2.3 products.current_stock

**Severity: P3**

| Source | Role | Evidence |
|--------|------|---------|
| stock_movements (summed) | CANONICAL | productService.ts:5 |
| products.current_stock | STALE CACHE / DISPLAY FALLBACK | POS.tsx:339/372 display fallback only |

**Evidence of intentional suppression:**
- productService.ts:59: current_stock is excluded from SELECT clauses.
- productService.ts:206-209: current_stock is stripped from the object before any DB write.
- POS.tsx:339/372: uses current_stock only as a display fallback when movement-based total is not yet loaded.

**Risk:** If POS.tsx renders the fallback before movement totals load, it may show a stale stock level. No financial calculation depends on this field.

**Action required:**
- Confirm no financial guard (e.g., prevent oversell) reads products.current_stock.
- If safe, deprecate the field and remove the POS.tsx fallback.

---

### 2.4 contacts.current_balance

**Severity: P1**

| Source | Role | Evidence |
|--------|------|---------|
| journal_entry_lines (summed via RPC) | CANONICAL | RPC get_contact_party_gl_balances |
| contacts.current_balance | DERIVED CACHE — written by triggers AND manual service code | Multiple |

**Trigger writes:**
- trigger update_contact_balance_on_sale: increments contacts.current_balance by due_amount when sale.status = 'final'
- trigger update_contact_balance_on_purchase: decrements contacts.current_balance by due_amount when purchase.status = 'final'

**Manual service writes (outside triggers — high risk):**

| Location | Operation |
|----------|-----------|
| studioProductionService.ts:1411 | Direct write to contacts.current_balance |
| studioProductionService.ts:1663 | Direct write to contacts.current_balance |
| studioProductionService.ts:1758 | Direct write to contacts.current_balance |
| studioProductionService.ts:1798 | Direct write to contacts.current_balance |
| studioProductionService.ts:1904 | Direct write to contacts.current_balance |

**UI reads that rely on the cached field:**

| Location | Context |
|----------|---------|
| ContactsPage.tsx:263-272 | Contact list balance display |
| AddEntryV2.tsx:209/220/229/240 | Entry form balance display / pre-fill |

**Risk:** The cached balance diverges from the canonical GL whenever:
- A studio stage is completed without a corresponding JE (all V3 orders, currently).
- A return or void is posted without the trigger firing (e.g., purchase returns — see 2.5).
- Manual writes in studioProductionService apply business logic that the trigger does not replicate.

**Action required:**
1. Replace all UI reads of contacts.current_balance with calls to get_contact_party_gl_balances.
2. Remove all manual writes to contacts.current_balance in studioProductionService.
3. Audit trigger logic to confirm it is not double-counting with manual writes.
4. Add a reconciliation check (see verification SQL scripts).

---

### 2.5 purchase_return — Missing Journal Entries

**Severity: P1**

**Finding:** The purchase return finalization path does not call createEntry() or documentPostingEngine. No JE is ever posted for a purchase return.

**Evidence:**
- finalizePurchaseReturn: no accounting service call present.
- voidPurchaseReturn: searches for journal_entries with reference_type='purchase_return' — returns ZERO rows because none are ever created.
- Stock movements of type 'purchase_return' exist (stock is reversed correctly) but no corresponding GL entry exists to debit Accounts Payable and credit Inventory.

**Financial impact:** Every finalized purchase return understates Accounts Payable and overstates Inventory on the balance sheet until a manual journal is posted.

**Action required:**
1. Add JE posting to finalizePurchaseReturn: Dr Inventory(1200) / Cr AP or Expense account.
2. Run the verification SQL (verify_purchase_return_missing_journal_entries.sql) to enumerate all affected records.
3. Post corrective JEs for historical purchase returns.

---

### 2.6 Studio V1 / V2 / V3 Overlap

**Severity: P1 (accounting gap) / P2 (mixed state)**

| Finding | Severity | Detail |
|---------|----------|--------|
| V3 stage completion posts no JE | P1 | studioProductionV3Service has no accounting service calls |
| studioCostsService reads V1 tables only | P1 | Cost dashboard is blind to all V3 orders |
| studioCustomerInvoiceService is dead code | P1 | The only service with correct AR/Revenue JEs has zero importers |
| V2 UI pages still exist | P2 | StudioProductionV2Pipeline.tsx, StudioProductionV2Dashboard.tsx |
| V1 service still imported by 14 files | P2 | Cannot retire cleanly |

**Action required:**
1. Wire JE posting into V3 stage completion and V3 invoicing (see doc 22 for account codes).
2. Rewrite studioCostsService to read V3 tables.
3. Decide whether to wire studioCustomerInvoiceService into V3 or rewrite equivalent logic.
4. Gate V2 UI pages behind a feature flag and schedule deprecation.

---

### 2.7 Document Sequences — Dual System

**Severity: P2**

| Table | Function | Used for |
|-------|----------|---------|
| erp_document_sequences | getNextDocumentNumber() | Primary, payment-safe |
| document_sequences_global | getNextDocumentNumberGlobal() | SL, PUR, PAY, STD numbering |

**Evidence:**
- documentNumberService.ts:4: `"PAY refs: use erp_document_sequences only"`
- Both tables are actively used, meaning document numbers are generated from two separate counters depending on document type.

**Risk:** Gap or duplication in document number sequences if a document type ever switches tables without resetting the counter in the other. Cross-table uniqueness is not enforced by a DB constraint.

**Action required:**
1. Migrate all document types to erp_document_sequences.
2. Freeze document_sequences_global with a migration lock comment.
3. Add a DB constraint or application check to prevent duplicate numbers across types.

---

### 2.8 Accounting Guards — Soft Enforcement Only

**Severity: P3**

**Finding:** accountingCanonicalGuard.ts issues console.warn() for all guard violations. Hard failures only occur if environment variable VITE_ACCOUNTING_LEGACY_HARD_FAIL=true is set.

**Risk:** Legacy write paths are silently permitted in production unless the flag is explicitly set. The guard exists but provides no production enforcement.

**Action required:**
1. Set VITE_ACCOUNTING_LEGACY_HARD_FAIL=true in staging to identify all remaining legacy paths.
2. After all P1 legacy writes are eliminated, enable hard-fail in production.

---

## 3. Summary Table

| Finding | Canonical Source | Legacy Source | Severity | Action |
|---------|-----------------|--------------|---------|--------|
| sale_items vs sales_items | sales_items | sale_items | P1 | Eliminate legacy writes; fix dashboard query |
| inventory_balance vs stock_movements | stock_movements | inventory_balance (trigger) | P3 | Document; decide promote or drop |
| products.current_stock vs movements | stock_movements sum | products.current_stock | P3 | Confirm no financial guards; deprecate field |
| contacts.current_balance vs GL | journal_entry_lines (RPC) | contacts.current_balance | P1 | Replace UI reads; remove manual service writes |
| purchase_return no JE | journal_entry_lines | (none — missing) | P1 | Add JE posting; post historical corrections |
| V3 no JE on stage/invoice | journal_entry_lines | (none — missing) | P1 | Wire accounting into V3 service |
| Dual document sequences | erp_document_sequences | document_sequences_global | P2 | Migrate all types; freeze global table |
| Accounting guard soft-fail | N/A | accountingCanonicalGuard.ts | P3 | Enable hard-fail after P1 fixes |
