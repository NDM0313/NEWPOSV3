# ERP Accounting Architecture — Full Diagnostic Report

**Date:** 2025-03-08  
**Scope:** Database, backend services, frontend — Accounting vs Reports vs Chart of Accounts.

---

## STEP 1 — Database Architecture

### Tables involved in accounting

| Table | Source migration | Purpose |
|-------|------------------|---------|
| **accounts** | 02_clean_erp_schema, 03_frontend_driven_schema | Chart of Accounts **per company** (company_id, code, name, type). UNIQUE(company_id, code). |
| **journal_entries** | 02, 03 | Header: company_id, branch_id, entry_date, reference_type, reference_id, entry_no. **Authoritative** for double-entry. |
| **journal_entry_lines** | 02, 03 | Lines: journal_entry_id, **account_id → accounts(id)**, debit, credit. **Authoritative** for all account-level totals. |
| **ledger_entries** | 02/03 then **replaced** by ledger_master_and_entries.sql | In **current** schema: **ledger_id → ledger_master** (supplier/user sub-ledgers only). No longer account_id-based. |
| **ledger_master** | migrations/ledger_master_and_entries.sql | One row per supplier or user (entity_id). For Payables / Supplier & User ledgers. |
| **chart_accounts** | 16_chart_of_accounts.sql | **Separate** chart: code UNIQUE globally, **no company_id**. References: chart_accounts(id). |
| **account_transactions** | 16_chart_of_accounts.sql | Rows reference **chart_accounts(id)**. Not used by any app code. |
| **worker_ledger_entries** | (studio migrations) | Studio worker payables (legacy); Studio Costs uses journal first, this as fallback. |
| **payments** | 03 | payment_account_id → accounts(id). Roznamcha reads this for Cash In/Out. |

### Important migration conflict

- **16_chart_of_accounts.sql** creates `chart_accounts`, `account_transactions`, and **CREATE TABLE IF NOT EXISTS** for `journal_entries` and `journal_entry_lines`.
- Because **03** runs first, `journal_entries` and `journal_entry_lines` **already exist** (with **account_id → accounts(id)**).
- So **16 does not replace** them. The live journal tables are from **03** and reference **accounts**, not chart_accounts.
- **chart_accounts** and **account_transactions** exist in the DB but **are not used** by any frontend or backend service.

### Relationship map (simplified)

```
companies
    └── accounts (company_id, code, name, type)
            ↑
            │ account_id
            │
journal_entries (company_id, reference_type, reference_id)
    └── journal_entry_lines (journal_entry_id, account_id, debit, credit)
            ↑
            └── All accounting reports & Studio Costs read from here

ledger_master (company_id, ledger_type, entity_id)  [supplier/user]
    └── ledger_entries (ledger_id, debit, credit, balance_after, source, reference_id)
            ↑
            └── Supplier/User ledger UI only (not account ledger)

worker_ledger_entries (studio)
    └── Studio Costs fallback; primary = journal_entry_lines (5000, 2010)
```

---

## STEP 2 — Chart of Accounts dependency scan

### Where **accounts** (ERP) is used

- **Foreign keys:** journal_entry_lines.account_id, expenses.account_id, payments.payment_account_id, branches.default_*_account_id, ledger_entries (in 02/03 only; replaced later).
- **RPCs:** get_customer_ledger (10_ledger_calculations) uses accounts + journal_entry_lines; ensure_erp_accounts*, create_sales_revenue_account, etc.
- **Triggers:** Sale/Purchase/Payment/Expense posting create rows in journal_entries + journal_entry_lines using accounts.id.
- **Services:** accountService, accountingService, studioCostsService, saleAccountingService, purchaseService, refundService, accountHelperService, chartAccountService (maps **accounts** to ChartAccount UI).

### Where **chart_accounts** / **account_transactions** are used

- **No references** in `src/`. Migration 16 created them; the app never reads or writes them. **Dead code** in schema.

---

## STEP 3 — Backend services analysis

| Service | Reads from | Writes to |
|---------|------------|-----------|
| **accountingService** | journal_entries, journal_entry_lines, accounts | journal_entries, journal_entry_lines |
| **accountService** | accounts | accounts |
| **studioCostsService** | journal_entry_lines (5000, 2010), accounts, worker_ledger_entries (fallback) | — |
| **saleService** | accounts, journal_entries, journal_entry_lines | journal_entries, journal_entry_lines; **deletes** ledger_entries by reference_id (legacy: current ledger_entries has ledger_id, not sale reference) |
| **purchaseService** | accounts, journal_entries, journal_entry_lines | journal_entries, journal_entry_lines; ledger_entries (supplier) |
| **ledgerService** | ledger_master, ledger_entries (ledger_id) | ledger_entries |
| **roznamchaService** | payments | — |
| **chartAccountService** | **accounts** (via accountService), journal_entry_lines (for “has transactions”) | accounts (create default) |
| **refundService** | accounts, journal_entries, journal_entry_lines | journal_entry_lines |

**Conclusion:** No service reads **chart_accounts** or **account_transactions**. All accounting logic uses **accounts** + **journal_entries** + **journal_entry_lines**.

---

## STEP 4 — Frontend usage

| Component | Data source | API / service |
|-----------|-------------|----------------|
| **AccountingDashboard** | Transactions, Accounts, Ledger, Receivables, Payables, Studio Costs | accountingService, accountService, useAccounting |
| **AccountsTab** | accounts | accountService, chartAccountService (accounts → ChartAccount shape) |
| **LedgerTab / AccountLedgerView** | Account ledger lines | accountingService.getAccountLedger → **journal_entry_lines** + journal_entries |
| **StudioCostsTab** | Studio costs & worker breakdown | studioCostsService.getStudioCostsFromJournal → **journal_entry_lines** (5000, 2010) |
| **DayBookReport** | Journal day book | **Direct Supabase:** journal_entries + journal_entry_lines + accounts(name) |
| **RoznamchaReport** | Cash In/Out | roznamchaService.getRoznamcha → **payments** (by design) |
| **Customer Ledger (Receivables)** | AR balance & lines | accountingService.getCustomerLedgerFromJournal → **journal_entry_lines** (AR account 2000/1100) |

All accounting and report UIs that need “journal” data use **journal_entries** + **journal_entry_lines** (+ accounts). No UI uses chart_accounts or account_transactions.

---

## STEP 5 — Mismatches identified

1. **chart_accounts vs accounts**  
   - **chart_accounts** (16): global code, no company_id.  
   - **accounts** (02/03): per-company, used everywhere.  
   - **Mismatch:** Two charts in DB; only **accounts** is used. Reports and Accounting are aligned on **accounts** + journal.

2. **account_transactions vs journal_entry_lines**  
   - **account_transactions** (16): references chart_accounts, not used.  
   - **journal_entry_lines** (03): references accounts, used by all modules.  
   - **No functional mismatch:** Only journal_entry_lines is used.

3. **ledger_entries (current)**  
   - After **ledger_master_and_entries.sql**, ledger_entries has **ledger_id** (supplier/user).  
   - saleService still deletes from ledger_entries by **reference_id** (intended for old account-scoped ledger). In current schema those rows don’t exist; customer ledger is from journal. So that delete is effectively a no-op or legacy.

4. **Multi-company “duplicate” codes**  
   - Same code (e.g. 5000, 4000) in different companies is **correct** (company_id + code unique). Not a bug.

---

## STEP 6 — Unified accounting model (current state)

**Single authoritative source for accounting:**

- **journal_entries** (company_id, branch_id, entry_date, reference_type, reference_id)
- **journal_entry_lines** (journal_entry_id, account_id → **accounts(id)**, debit, credit)

**Flow:**

- Accounts (per company) → Journal entries → Journal entry lines → Reports & dashboards.

**What uses this:**

- Accounting: Transactions, Account Ledger, Receivables (customer ledger).
- Reports: Day Book (Journal Day Book).
- Studio Costs: Primary path (5000 Cost of Production, 2010 Worker Payable).

**What does not use journal (by design):**

- **Roznamcha:** Cash book from **payments** only.
- **Supplier/User ledgers:** **ledger_master** + **ledger_entries** (ledger_id).

---

## STEP 7 — Database integrity (checks to run)

- No orphan **journal_entry_lines** (every account_id exists in accounts).
- No orphan **journal_entries** (company_id exists in companies).
- **accounts**: required ERP codes (2000, 4000, 5000, 2010) per company (handled by accounting_ensure_* migrations / repair script).
- **ledger_entries**: reference ledger_master(id); no account_id in current schema.

---

## STEP 8 — Fixes applied / recommended

### Done (no code change)

- **Diagnostic only:** Confirmed Accounting and Reports both use **journal_entries** + **journal_entry_lines** + **accounts**. No switch to account_transactions or chart_accounts.

### Recommended (optional, no GitHub push per your instructions)

1. **Document or deprecate chart_accounts / account_transactions**  
   Add a migration comment or a small doc note that these tables are from migration 16 and are **not used** by the ERP app; avoid building new features on them.

2. **saleService ledger_entries delete**  
   The delete by reference_id targets old account-based ledger_entries. With current schema it deletes nothing (or wrong table). Option: remove that block or restrict to environments where legacy ledger_entries still exist. Low risk to leave as-is (no-op).

3. **journal_entries.payment_id**  
   accountingService.getAccountLedger selects `payment_id` on journal_entries. If column is missing, add it via migration or omit from select to avoid future errors.

---

## STEP 9 — Verification summary

| Check | Result |
|-------|--------|
| Studio Costs dashboard | Reads from journal_entry_lines (5000, 2010) + accounts. Fallback: worker_ledger_entries. |
| Reports (Day Book) | Reads journal_entries + journal_entry_lines + accounts. Same source as Accounting. |
| Account Ledger | accountingService.getAccountLedger → journal_entry_lines + journal_entries. |
| Customer Ledger (AR) | getCustomerLedgerFromJournal → journal_entry_lines (AR account). |
| Roznamcha | payments only (cash book). |
| Chart of Accounts UI | accountService + chartAccountService → **accounts** table. |

**Conclusion:** Accounting, Reports (Day Book, etc.), and Studio Costs all use the **same journal-based model** (journal_entries + journal_entry_lines + accounts). The only “second system” (chart_accounts + account_transactions) is **unused** in code. Multi-company rows in **accounts** (same code, different company_id) are **by design**, not duplicates.

---

## Final architecture (target state — already achieved)

```
accounts (per company)
   ↓
journal_entries (reference_type, reference_id)
   ↓
journal_entry_lines (account_id, debit, credit)
   ↓
Reports (Day Book, etc.) + Accounting (Ledger, Receivables, Studio Costs)
```

All modules that need accounting data read from this single journal-based path. No further unification required for Accounting vs Reports; only optional cleanup of unused tables (chart_accounts, account_transactions) and legacy saleService ledger_entries delete.

**Integrity check:** Run `node scripts/verify-accounting-integrity.js` to confirm orphan journal lines (0), required accounts per company (2000/4000/5000/2010), and journal counts. Sample run: 0 orphans, 8/8 required accounts, 80 journal_entries, 157 journal_entry_lines.
