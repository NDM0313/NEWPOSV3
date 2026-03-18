# Accounting Engine Audit

**Project:** NEW POSV3 ERP  
**Date:** 2026-03-13  
**Phase:** 1 — Accounting Engine Hardening (Master Roadmap)

---

## 1. Schema validation

### journal_entries

| Column         | Type         | Notes |
|----------------|--------------|--------|
| id             | UUID         | PK |
| company_id     | UUID         | NOT NULL, FK companies |
| branch_id      | UUID         | nullable, FK branches |
| entry_no       | VARCHAR(100) | optional |
| entry_date     | DATE         | NOT NULL |
| description    | TEXT         | |
| reference_type | VARCHAR(50)  | e.g. 'sale', 'purchase', 'payment', 'expense', 'refund' |
| reference_id   | UUID         | links to source document |
| created_by     | UUID         | nullable, FK users |
| created_at     | TIMESTAMPTZ  | |
| updated_at     | TIMESTAMPTZ  | |
| total_debit    | DECIMAL(15,2)| added via add_journal_entries_columns |
| total_credit   | DECIMAL(15,2)| |
| is_posted      | BOOLEAN      | |
| posted_at      | TIMESTAMPTZ  | |
| is_manual      | BOOLEAN      | |

**Indexes:** company_id, entry_date DESC, (reference_type, reference_id).

### journal_entry_lines

| Column           | Type         | Notes |
|------------------|--------------|--------|
| id               | UUID         | PK |
| journal_entry_id | UUID         | NOT NULL, FK journal_entries CASCADE |
| account_id       | UUID         | NOT NULL, FK accounts |
| debit            | DECIMAL(15,2)| default 0 |
| credit           | DECIMAL(15,2)| default 0 |
| description      | TEXT         | |
| created_at       | TIMESTAMPTZ  | |
| account_name     | VARCHAR(255) | optional (add_journal_entries_columns) |

**Indexes:** journal_entry_id, account_id.

---

## 2. Double-entry rules

- **Application:** `accountingService.createEntry()` enforces `total_debit === total_credit` (with 0.01 tolerance) before insert.
- **Database:** Trigger `validate_journal_entry_balance` in `supabase-extract/migrations/16_chart_of_accounts.sql` enforces balance on `journal_entry_lines` (AFTER INSERT OR UPDATE). **Action:** Ensure this trigger is applied via migration (see Phase 1 fix).
- **Ledger integrity:** Reports and RPCs use `SUM(debit - credit)` per account; balanced entries keep ledger consistent.

---

## 3. Modules generating journal entries

| Module            | Generates journal? | Where | reference_type |
|------------------|--------------------|--------|----------------|
| **Sales**        | Yes                | SalesContext (frontend), trigger `auto_post_sale_to_accounting` on sales.status = 'final' | sale |
| **Purchases**    | Yes                | RPC/function in 06_purchase_transaction_with_accounting.sql | purchase |
| **Payments**     | Yes                | RPC `record_customer_payment` (58_record_customer_payment_rpc.sql), ensure_ar_1100_and_fix_payment_journal | payment |
| **Refunds**      | Yes                | refundService.ts: createRefund() — Dr AR, Cr Cash/Bank | refund |
| **Expenses**     | Yes                | 09_expense_transaction.sql, APPLY_FUNCTION_FIX_NOW / expense RPCs | expense |
| **Stock adjustments** | No (gap)      | AdjustStockDialog / InventoryDashboardNew only create stock_movements; no journal entry. | — |

---

## 4. Gaps and fixes

### 4.1 Debit = credit validation

- **Check:** Trigger `validate_journal_entry_balance` would run per row; the app inserts journal lines one-by-one, so a per-row balance trigger would fail after the first line.
- **Fix:** Migration `migrations/accounting_validate_journal_balance_trigger.sql` adds a **validation function** `check_journal_entries_balance()` that returns unbalanced entries (for reports/admin). Use: `SELECT * FROM check_journal_entries_balance();`

### 4.2 Stock adjustments

- **Gap:** Stock adjustments create only `stock_movements` (movement_type = 'adjustment'). No journal entry for inventory value or audit trail.
- **Fix:** Migration `migrations/stock_adjustment_journal_entries.sql` adds a trigger on `stock_movements` that, for `movement_type = 'adjustment'`, creates a journal entry (reference_type = 'stock_adjustment', reference_id = movement id) with:
  - Dr/Cr Inventory (or configured inventory account) and Cr/Dr Stock adjustment account (or expense), using movement unit_cost × quantity (or 0 if no cost), so every adjustment has a journal trail and remains balanced.

### 4.3 No transaction without journal

- Sales, purchases, payments, refunds, expenses are covered.
- After applying the stock-adjustment migration, every listed transaction type will generate a journal entry.

---

## 5. Required checks summary

| Check                         | Status |
|------------------------------|--------|
| No transaction without journal | Partial — stock adjustments fixed by migration |
| Debit = credit validation    | Application-layer (accountingService) + DB function check_journal_entries_balance() for auditing |
| Ledger balance integrity     | Satisfied when all entries are balanced and trigger is active |

---

## 6. Outputs

- This audit: `docs/ACCOUNTING_ENGINE_AUDIT.md`
- Migrations applied: see `docs/ERP_SYSTEM_IMPLEMENTATION_LOG.md` (Phase 1 step).
