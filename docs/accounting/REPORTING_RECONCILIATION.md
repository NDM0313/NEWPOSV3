# Reporting Reconciliation Layer (Phase 7)

**Status:** Locked from Phase 7. All financial screens read from one consistent accounting truth.  
**References:** ACCOUNTING_SOURCE_LOCK.md, COA_MAPPING_MATRIX.md, PAYMENT_ISOLATION_RULES.md, SALE_ACCOUNTING_CONTRACT.md, PURCHASE_ACCOUNTING_CONTRACT.md, INVENTORY_VALUATION_AND_COST_FLOW.md.

---

## 1. One accounting truth

| Truth | Source | Used by |
|-------|--------|--------|
| **GL balances** | `journal_entries` + `journal_entry_lines` only (voided JEs excluded) | Trial Balance, P&L, Balance Sheet, Accounts screen, Account Ledger, Day Book, Journal Entries list |
| **Account balance per account** | Sum of (debit − credit) from journal lines for that account | Accounts tab, Account Ledger opening/running balance |
| **Receivables (AR)** | Account 1100 balance from journal | Trial Balance, Balance Sheet; should match sum of (sales − payments) when posting is correct |
| **Payables (AP)** | Account 2000 balance from journal | Trial Balance, Balance Sheet; should match sum of (purchases − payments) when posting is correct |
| **Inventory (BS)** | Account 1200 balance from journal | Balance Sheet; should align with Inventory Valuation report total when purchase/COGS flows are correct |
| **Roznamcha** | `payments` table | Cash/bank movement; payment JEs post to journal for GL |

---

## 2. Trial Balance

- **Source:** `journal_entry_lines` joined to `journal_entries` (company, date range, branch); voided entries excluded.
- **Difference:** totalDebit − totalCredit. When every journal entry is double-entry balanced, **difference = 0**.
- **Rounding:** Totals use raw sums then round once; per-row rounding for display only.

---

## 3. Profit & Loss and Balance Sheet

- **Source:** Trial balance (same journal source). P&L = revenue/cost/expense accounts in date range; Balance Sheet = asset/liability/equity as at date; net income included in equity.
- **Balance sheet equation:** Assets = Liabilities + Equity (with net income); difference should be 0 when TB is balanced.

---

## 4. Accounts screen and Account Ledger

- **Accounts tab:** Balance shown = **journal-derived** (getAccountBalancesFromJournal). Fallback to `accounts.balance` if journal balances call fails.
- **Account Ledger:** Opening/running balance = sum of (debit − credit) from **journal lines only** (voided JEs excluded). No use of `accounts.balance` for ledger math.

---

## 5. Day Book and Journal Entries

- **Source:** `journal_entries` + `journal_entry_lines` + `accounts`. Same journal truth; void handling per existing Day Book / JE list behavior.

---

## 6. Receivables and Payables screens

- **Receivables tab:** Document truth = sales with `due > 0` (total − paid). **GL truth** = account 1100 balance from trial balance. When all sale/payment JEs are posted, sum of due amounts should match AR balance.
- **Payables tab:** Document truth = purchases with `due > 0`. **GL truth** = account 2000 balance. Same reconciliation expectation.

---

## 7. Customer Ledger and Supplier Ledger

- **Customer ledger:** Built from sales + payments (and rentals where applicable); RPC/document source. AR balance from journal (1100) should match customer ledger total when posting is correct.
- **Supplier ledger:** Built from `ledger_master` + `ledger_entries` (UI layer, synced from purchases/payments). AP balance from journal (2000) should match supplier ledger total when posting is correct.

---

## 8. Inventory: Balance Sheet vs Valuation report

- **Balance sheet inventory:** Account **1200** balance from trial balance (journal).
- **Inventory Valuation report:** Sum of (quantity × unit cost) from `stock_movements` (see INVENTORY_VALUATION_AND_COST_FLOW.md).
- **Reconciliation:** When purchase JEs (Dr Inventory 1200, Cr AP) and sale COGS (Dr COGS, Cr Inventory 1200) are complete and correct, GL 1200 balance and valuation report total should align. Phase 8 may run formal reconciliation/repair.

---

## 9. Mixed-source behavior (removed)

- **Before Phase 7:** Accounts tab used `accounts.balance`; Account Ledger used `accounts.balance` for opening balance; voided JEs could be included in trial balance.
- **After Phase 7:** Accounts tab and Account Ledger use journal-derived balances only; trial balance (and thus P&L, Balance Sheet, getAccountBalancesFromJournal) excludes voided JEs. One source for GL reporting.

---

## 10. Files

| File | Role |
|------|------|
| `accountingReportsService.ts` | getTrialBalance (exclude voided); getAccountBalancesFromJournal; P&L, Balance Sheet, Inventory Valuation |
| `accountingService.ts` | getAccountLedger (current/opening balance from journal only); Day Book / JE list source |
| `AccountingContext.tsx` | loadAccounts merges journal balances into account list for Accounts tab |
| `DayBookReport.tsx` | Day Book from journal_entries + journal_entry_lines |
