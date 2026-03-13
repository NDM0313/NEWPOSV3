# ERP Accounting Structure (Safe Cleanup Plan)

**Goal:** ERP must use **only** **accounts**, **journal_entries**, **journal_entry_lines** for double-entry accounting. This document verifies that all modules post through the central path and documents triggers/RPCs.

**No schema changes in this phase** — verification and documentation only.

---

## 1. Canonical accounting tables

| Table | Purpose |
|-------|--------|
| **accounts** | Chart of accounts (company-scoped). Referenced by journal_entry_lines.account_id, branches (default accounts), expenses (payment_account_id). |
| **journal_entries** | Header: company_id, branch_id, entry_date, description, reference_type, reference_id, payment_id, created_by. |
| **journal_entry_lines** | Lines: journal_entry_id, account_id, debit, credit, description. |

All posting must flow into these three tables (plus optional payment_id / reference_id linkage). **ledger_master** / **ledger_entries** are subsidiary ledgers (supplier/user), not the double-entry books; **worker_ledger_entries** is for studio workers. They remain in use but are **not** the replacement for journal_entries.

---

## 2. Verification: who posts via accountingService.createEntry

| Module | Service / location | Creates journal_entries + journal_entry_lines? |
|--------|---------------------|------------------------------------------------|
| **Sales** | saleAccountingService | Yes — createEntry(entry, lines) for sale post |
| **Sales (trigger)** | DB trigger trigger_auto_post_sale_to_accounting | Yes — INSERT into journal_entries + journal_entry_lines (migrations) |
| **Purchases** | PurchaseContext / purchaseService | Yes — journal creation on confirm (context or service) |
| **Payments** | AccountingContext (receive payment, pay supplier, worker payment, advance) | Yes — createEntry for each |
| **Payments (trigger)** | create_payment_journal_entry (fix_payment_journal_ar_account_code.sql) | Yes — INSERT journal_entries + lines for payment |
| **Expenses** | AccountingContext.createEntry (expense entry flow) | Yes |
| **Refunds / sale returns** | refundService, SaleReturnForm, StandaloneSaleReturnForm | Yes — createEntry for reversals |
| **Studio (stage cost / invoice)** | studioProductionService, studioCustomerInvoiceService | Yes — createEntry |
| **Studio (worker payment)** | AccountingContext (worker payment) | Yes — createEntry; syncs to worker_ledger_entries |
| **Shipment** | shipmentAccountingService | Yes — createEntry for shipping income/expense/courier |
| **Credit notes** | creditNoteService | Yes — INSERT journal_entry_lines (and header) |
| **Stock adjustment** | DB trigger trigger_post_stock_adjustment_to_accounting (stock_adjustment_journal_entries.sql) | Yes — INSERT journal_entries + lines |
| **Manual entry** | ManualEntryDialog → AccountingContext.createEntry | Yes |

**Conclusion:** All identified flows either call **accountingService.createEntry** or a DB function that inserts into **journal_entries** and **journal_entry_lines**. No application path was found that writes only to **chart_accounts** or **account_transactions** for primary posting.

---

## 3. Sales accounting

- **Trigger:** `trigger_auto_post_sale_to_accounting` on **sales** (INSERT/UPDATE). Creates journal entry when sale is finalized (e.g. reference_type = 'sale', reference_id = sale.id).
- **App:** saleAccountingService also calls accountingService.createEntry (e.g. for (re)posting or when trigger is not used). SalesContext/flow finalizes sale; trigger or explicit post creates the JE.
- **Verification:** Sales accounting uses **journal_entries** + **journal_entry_lines**; accounts used via account_id on lines. **OK.**

---

## 4. Purchase accounting

- **App:** PurchaseContext / purchaseService create journal entries on confirm/post (logic in context or service calling accountingService or equivalent).
- **Trigger:** purchase_final_stock_movement_trigger on purchases (stock only; no separate “purchase accounting” trigger found). So purchase JEs are created from **application code**, not a dedicated trigger.
- **Verification:** Purchases post to **journal_entries** + **journal_entry_lines**. **OK.**

---

## 5. Payments

- **Trigger:** create_payment_journal_entry (and possibly trigger_auto_create_payment_journal or similar) creates Dr Cash/Bank, Cr A/R (or equivalent) when payment is inserted/updated.
- **App:** AccountingContext createEntry for “receive payment”, “pay supplier”, “worker payment”, “advance”, etc. All go through accountingService.createEntry.
- **Verification:** Payments use **journal_entries** + **journal_entry_lines** (and payments.payment_id link where present). **OK.**

---

## 6. Expenses

- **App:** AccountingContext expense entry flow calls createEntry. expenseService may use RPC that also inserts into journal_entries (to be confirmed per deployment).
- **Verification:** Expenses post via **createEntry** (and possibly RPC) to **journal_entries** + **journal_entry_lines**. **OK.**

---

## 7. Stock adjustment journals

- **Trigger:** `trigger_post_stock_adjustment_to_accounting` on **stock_movements** (stock_adjustment_journal_entries.sql). When movement type is adjustment, inserts journal_entries + journal_entry_lines.
- **Verification:** Stock adjustments use **journal_entries** + **journal_entry_lines**. **OK.**

---

## 8. Other posting flows

| Flow | Table / RPC | Uses journal_entries? |
|------|-------------|------------------------|
| Courier/shipment | shipmentAccountingService | Yes — createEntry |
| Studio stage cost | studioProductionService | Yes — createEntry |
| Studio customer invoice | studioCustomerInvoiceService | Yes — createEntry |
| Worker payment | AccountingContext | Yes — createEntry (+ worker_ledger_entries sync) |
| Rental advance / income | AccountingContext | Yes — createEntry |
| Credit note | creditNoteService | Yes — direct INSERT into journal_entries + journal_entry_lines |
| Refund / sale return | refundService, SaleReturnForm | Yes — createEntry (reversal) |

---

## 9. Integrity and balance

- **check_journal_entries_balance()** (accounting_validate_journal_balance_trigger.sql): Returns unbalanced journal entries. No DB trigger **enforcing** balance (allows multi-line insert in one transaction).
- **journal_entry_lines** triggers: e.g. trigger_update_account_balance (INSERT/UPDATE/DELETE) to maintain account balances if present.
- Reports (accountingReportsService, DayBookReport, etc.) read from **journal_entries** + **journal_entry_lines** + **accounts** only.

---

## 10. Legacy / alternate paths (do not use for new posting)

| Item | Status |
|------|--------|
| **chart_accounts** | Not used by app for posting. Mark as legacy (see ERP_DUPLICATE_TABLE_ANALYSIS.md). |
| **account_transactions** | Part of 16_chart_of_accounts; not used by current app. |
| **ledger_master / ledger_entries** | Subsidiary ledgers for supplier/user; **keep**. Not duplicate of journal; do not use for primary double-entry. |
| **worker_ledger_entries** | Studio worker ledger; **keep**. Synced from worker payments (journal-based). |

---

## 11. Summary

- **Canonical accounting:** **accounts** + **journal_entries** + **journal_entry_lines**.
- All modules that post accounting do so via **accountingService.createEntry** or DB triggers/functions that insert into **journal_entries** and **journal_entry_lines**.
- Sales: trigger + saleAccountingService. Purchases: app. Payments: trigger + AccountingContext. Expenses: AccountingContext (and possibly RPC). Refunds/returns: createEntry. Studio: createEntry. Shipment: createEntry. Stock adjustment: trigger. Credit note: direct INSERT.
- No cleanup of tables required for “accounting only” goal; ensure no new code posts to chart_accounts/account_transactions. Mark chart_accounts as legacy in comments.

---

*This document is part of the safe cleanup plan. No schema or data was modified.*
