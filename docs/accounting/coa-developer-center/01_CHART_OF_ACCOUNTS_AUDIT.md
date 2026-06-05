# Chart of Accounts — End-to-End Audit

**Phase:** A (analysis only)  
**Date:** 2026-06-03  
**GL posting rules:** Not changed in this document.

---

## 1. `accounts` table structure

### Canonical schema

| Column | Type / role | Notes |
|--------|-------------|-------|
| `id` | UUID PK | Stable; referenced by `journal_entry_lines.account_id` |
| `company_id` | UUID FK | Company scope |
| `code` | text | Stable identifier; used in `coaMapping.ts`, seed, lookups |
| `name` | text | Display name; user-editable when safe |
| `type` | `account_type` enum + operational values | See §2 |
| `subtype` | `account_subtype` enum | Cash/bank/AR/AP/inventory classification |
| `parent_id` | UUID FK → accounts | Hierarchy; COA section groups |
| `is_group` | boolean | `true` = section header, **non-posting** |
| `linked_contact_id` | UUID FK → contacts | Party subledger under 1100/2000 |
| `balance` | numeric | **Secondary** — GL truth = sum of journal lines |
| `is_active` | boolean | Inactive hides from pickers; may still have history |
| `branch_id` | UUID (optional) | Branch-scoped accounts when used |

**Key migrations:**
- `migrations/add_accounts_subtype_column.sql` — subtype enum
- `migrations/20260347_account_is_group_coa_headers.sql` — `is_group` + headers 1050–6090
- `migrations/20260364_accounts_linked_contact_party_subledger.sql` — party subledgers

**Source files:**
- `src/app/services/accountService.ts` — CRUD, payment account filter
- `src/app/data/defaultCoASeed.ts` — canonical hierarchy JSON
- `src/app/services/defaultAccountsService.ts` — idempotent seed + parent repair
- `src/app/lib/accountHierarchy.ts` — `CANONICAL_LEAF_CODES`, `auditAccountHierarchy()`

---

## 2. Account types

### Postgres `account_type` (5-class)

```
asset | liability | equity | revenue | expense
```

### Postgres `account_subtype` (selected)

```
cash, bank, mobile_wallet, accounts_receivable, accounts_payable,
inventory, sales_revenue, rental_revenue, studio_revenue,
cost_of_goods_sold, operating_expense, other, ...
```

### Runtime `accounts.type` (what services read/write)

Operational liquidity types coexist with enum values:

| Type value | Meaning | Examples |
|------------|---------|----------|
| `cash` | Cash drawer / petty | 1000, 1001 |
| `bank` | Bank account | 1010 |
| `mobile_wallet` | JazzCash, Easypaisa, etc. | 1020, 102x |
| `asset` | Non-liquidity assets | 1100, 1200, 1180 |
| `liability` | Payables | 2000, 2010, 203x |
| `equity` | Capital | 3000 |
| `revenue` | Income | 4000, 4100, 4200 |
| `expense` | Costs | 5000, 5100, 5400+ |
| `inventory` | Legacy type on some rows | Prefer `asset` + subtype |

**UI categories** (`chartAccountService.ts`): Assets, Liabilities, Equity, Income, Cost of Sales, Expenses.

---

## 3. Account groups (COA headers)

Non-posting section headers (`is_group = true`):

| Code | Name | Children (posting leaves) |
|------|------|---------------------------|
| 1050 | Cash & Cash Equivalents | 1000 Cash, 1001 Petty Cash |
| 1060 | Bank Accounts | 1010 Default Bank |
| 1070 | Mobile Wallets | 1020 Mobile Wallet |
| 1080 | Worker Advances | 1180 Worker Advance |
| 1090 | Inventory (group) | 1200 Inventory |
| 2090 | Trade & Other Payables | 2000 AP, 2010 Worker Payable, 2011 Security Deposit, 2020 Rental Advance, 2030 Courier Control |
| 3090 | Equity | 3000 Owner Capital |
| 4050 | Revenue | 4000/4100 Sales, 4110 Shipping, 4120 Extra Service, 4200 Rental Income |
| 6090 | Operating Expenses | 5000, 5010, 5100–6120, category-mapped 5400+ |

**Excluded from payment pickers:** all `COA_HEADER_CODES` (`defaultCoASeed.ts`).

**1100 AR control** is a posting leaf at root (no intermediate group parent in seed).

---

## 4. Parent/child hierarchy rules

1. Liquidity leaves (1000, 1010, 1020) must have parent in 1050/1060/1070 groups.
2. Inventory 1200 under 1090.
3. AP subtree under 2090; party children `AP-{slug}` under 2000 with `linked_contact_id`.
4. AR party children `AR-{slug}` under 1100 with `linked_contact_id`.
5. Orphan `parent_id` (points to missing account) = health violation.
6. `is_group = true` accounts must not receive journal lines.

**Audit:** `accountHierarchyAuditService.ts` → `auditAccountHierarchy()` in `accountHierarchy.ts`.

---

## 5. Account codes

### Locked canonical codes (`src/app/config/coaMapping.ts`)

| Code | Role |
|------|------|
| 1000 | Cash |
| 1010 | Bank |
| 1020 | Mobile wallet (default) |
| 1100 | AR control |
| 1200 | Inventory (canonical) |
| 1500 | Inventory legacy — avoid new posting |
| 2000 | AP control |
| 2010 | Worker Payable |
| 2020 | **Legacy — do not use** (was duplicate AP) |
| 203x | Per-courier payable |
| 2040 | Salesman Payable |
| 3000 | Owner Capital |
| 4000/4100 | Sales Revenue |
| 4110 | Shipping Income |
| 4120 | Extra Service Income |
| 4200 | Rental Income |
| 5000 | Cost of Production / COGS |
| 5010 | COGS-Inventory |
| 5100 | Shipping Expense |
| 5110 | Sales Commission Expense |
| 5200 | Discount Allowed |
| 5210 | Discount Received |
| 5300 | Extra Expense |
| 1195 | Reconciliation suspense (diagnostic flag) |

Full matrix: `docs/accounting/COA_MAPPING_MATRIX.md`.

### Duplicate / conflict risks

| Issue | Detail | Action |
|-------|--------|--------|
| AP 2000 vs 2020 | 2020 was accidental second AP | Never post to 2020 |
| Inventory 1200 vs 1500 | Purchase legacy used 1500 | Prefer 1200 |
| 5100 dual meaning | Shipping vs commission | Commission → 5110 |
| Duplicate names under same parent | e.g. two "Bank" | COA Health: flag |
| Duplicate codes | Same code twice in company | COA Health: error |

---

## 6. Control accounts

| Code | Kind | Posting rule |
|------|------|--------------|
| **1100** | AR control | Dr on credit sale; Cr on customer payment; party children for subledger |
| **2000** | AP control | Cr on purchase; Dr on supplier payment |
| **2010** | Worker Payable | Cr studio stage bill; Dr worker payment |
| **1180** | Worker Advance | Dr advance; Cr settlement |
| **2030** | Courier Payable control | Per-courier 203x leaves |
| **1195** | Reconciliation suspense | RULE_12 — review in AR/AP Center |

**Classification:** `src/app/lib/accountControlKind.ts`  
**Party resolution:** `partySubledgerAccountService.ts` — `resolveReceivablePostingAccountId`, `resolvePayablePostingAccountId`

---

## 7. Cash / bank / wallet accounts

| Method | Default code | `accounts.type` |
|--------|--------------|-----------------|
| Cash | 1000 | `cash` |
| Bank / card / cheque | 1010 | `bank` |
| Mobile wallet | 1020 | `mobile_wallet` |

**Payment picker:** `accountService.getPaymentAccountsOnly()` — excludes AR/AP, groups, revenue, expense, codes 2xxx, 1100, 2000, 2010.

**Branch defaults:** `branches.default_cash_account_id`, `default_bank_account_id`, `default_pos_drawer_account_id`.

**Roznamcha classification:** `roznamchaService.ts` → `classifyRoznamchaLiquidity()` (type + code + name heuristics).

---

## 8. AR / AP accounts

### AR (customers)

- Control: **1100**
- Party subledger: `AR-{contact_slug}` with `parent_id = 1100`, `linked_contact_id`
- Opening balance JE: `reference_type = opening_balance_contact_ar`
- Statement: AR debit lines + payment credits + synthetic rows

### AP (suppliers)

- Control: **2000** (under group 2090)
- Party subledger: `AP-{contact_slug}`
- Opening balance JE: `opening_balance_contact_ap`
- Worker payable **2010** is separate subtree (not supplier AP)

### Integrity checks

- `ar_reconcile` / `ap_reconcile` in Accounting Integrity Lab
- `partyBalanceTieOutService.ts` — operational vs GL per contact
- RULE_07: manual JE on control accounts
- RULE_13: unlinked AR/AP context

---

## 9. Party mapping (supplier / customer / worker / courier)

| Party type | Payable / Receivable account | Service |
|------------|------------------------------|---------|
| Customer | 1100 or AR child | `partySubledgerAccountService`, `saleAccountingService` |
| Supplier | 2000 or AP child | `purchaseAccountingService`, `supplierPaymentService` |
| Worker | 2010 payable, 1180 advance | `workerPaymentService`, `studioProductionService` |
| Courier | 203x per courier | `shipmentAccountingService`, `courierPaymentService` |
| Salesman | 2040 | `commissionReportService` |

---

## 10. Module-specific account usage

### Sales

| Event | Debit | Credit |
|-------|-------|--------|
| Finalize (credit sale) | 1100 / party AR | 4000/4010 product, 4110 shipping, 4120 extras |
| Discount | 5200 | (reduces revenue pool) |
| COGS | 5010 | 1200 inventory |
| Payment | 1000/1010/1020 | 1100 / party AR |

**Service:** `saleAccountingService.ts`

### Sale Return

| Event | Debit | Credit |
|-------|-------|--------|
| Return settlement | Reverses sale pattern | `sale_return`, `sale_reversal` reference types |

### Purchase

| Event | Debit | Credit |
|-------|-------|--------|
| Finalize | 1200 inventory | 2000 AP |
| Discount | (inventory reduced) | 5210 |
| Payment | 2000 / AP child | liquidity |

**Service:** `purchaseAccountingService.ts`

### Purchase Return

Settlement via `purchase_return` / `purchase_reversal` JEs.

### Rental

| Event | Debit | Credit |
|-------|-------|--------|
| Booking / charge | Party AR | 4200 Rental Income |
| Advance (legacy) | liquidity | 2020 Rental Advance |
| Payment | liquidity | party AR |
| Damage/penalty | party AR | 4200 / 5300 |

**Services:** `rentalPartyArAccounting.ts`, `rentalService.ts`

### Studio

| Event | Debit | Credit |
|-------|-------|--------|
| Stage complete | 5000 Cost of Production | 2010 Worker Payable |
| Customer invoice | 1100 | 4010 Studio Service Revenue |

**Service:** `studioProductionService.ts`, `studioCustomerInvoiceService.ts`

### Worker payments

| Event | Debit | Credit |
|-------|-------|--------|
| Pay worker | 2010 | liquidity |
| Advance | 1180 | liquidity |
| Settlement | 2010 | 1180 |

**Service:** `workerPaymentService.ts`, `workerAdvanceService.ts`

### Courier payments

| Event | Debit | Credit |
|-------|-------|--------|
| Shipment cost | 5100 | 203x courier payable |
| Pay courier | 203x | liquidity |

**Service:** `shipmentAccountingService.ts`, `courierPaymentService.ts`

### Expenses

| Event | Debit | Credit |
|-------|-------|--------|
| Paid expense | User category → 5400–5900 | liquidity |

**Service:** `expenseCategoryService.ts` (slug → COA code map); internal categories excluded from user picker.

### Customer receipts / on-account

| Event | Debit | Credit |
|-------|-------|--------|
| Receipt | liquidity | 1100 / party AR |
| On-account | Same via `record_payment_with_accounting` | `payments.reference_type = on_account` |

### Supplier payments

Dr 2000 / AP child, Cr liquidity — `supplierPaymentService.ts`

### Internal transfer

Dr destination liquidity, Cr source liquidity — `addEntryV2Service.createInternalTransferEntry`, JE `reference_type = transfer`

### Opening balance

| Entity | Debit | Credit | JE reference_type |
|--------|-------|--------|-------------------|
| Customer AR | 1100 / party | 3000 equity | `opening_balance_contact_ar` |
| Supplier AP | 3000 | 2000 / party | `opening_balance_contact_ap` |
| Worker | 1180 or 2010 | 3000 | `opening_balance_contact_worker` |
| GL account | account | 3000 (or reverse) | `opening_balance_account` |
| Inventory | 1200 | 3000 | `opening_balance_inventory` |

**Service:** `openingBalanceJournalService.ts` — idempotent one active JE per `(reference_type, reference_id)`.

### Manual journal

User-selected accounts — `reference_type = journal`

### Cash / Bank / Wallet (operational)

Not separate GL modules — liquidity legs on payments, expenses, transfers. Roznamcha and payment pickers use 1000/1010/1020 family.

---

## 11. Opening balances

- **Contact opening:** set on contact record → `openingBalanceJournalService` syncs JE
- **Chart account opening:** `AddAccountDrawer` on new account with opening amount
- **Inventory opening:** `stock_movements` with `reference_type = opening_balance` → `opening_balance_inventory` JE
- **Health check:** account has `balance` or contact has opening amount but no active opening JE → flag in COA Health

---

## 12. Branch-specific accounts

- Most COA is **company-wide**; `branch_id` on accounts is optional
- Branch **defaults** point to company liquidity accounts (`branchService`, `settingsService`)
- JEs and payments carry `branch_id` for reporting filters
- Dashboard cash/bank KPIs are **company-wide** even when branch filter applied (`DASHBOARD_BASIS_MAP.md`)

---

## 13. Company-level defaults

| Setting | Location | Accounts |
|---------|----------|----------|
| Default accounts bootstrap | `settingsService` / `defaultAccountsService` | 1000, 1010, 1100, 2000, etc. |
| Fiscal year | Settings → Accounting | Affects report periods |
| Expense category → COA | `expense_category` rows | 5400–5900 mapping |
| Branch POS drawer | `branches.default_pos_drawer_account_id` | Cash for POS |

---

## 14. Account safety classification

### Must never delete

1100, 2000, 1000, 1010, 1020, 3000, 4000/4100, 4200, 5000, 1200, 2010, canonical COA headers (1050–6090)

### System / control (structural edits blocked when lines exist)

1100, 2000, 2010, 2030, 1195, all `is_group = true` headers

### User-editable (safe fields)

- `name` (display)
- `description`
- `is_active` (with warning if lines exist)
- Reporting group / UI metadata

### Blocked without repair mode

- `code`, `type`, `parent_id`, `linked_contact_id` when `journal_entry_lines` count > 0

### Archive candidates

- Duplicate party subledgers with zero lines
- Inactive accounts with zero lines and no linked contact
- Legacy 1500, 2020 if 1200/2000 exist and no lines

### Suspicious patterns (COA Health checks)

| Check | Detection |
|-------|-----------|
| Duplicate codes | `GROUP BY code HAVING count > 1` |
| Duplicate names under parent | Same `parent_id` + normalized name |
| Missing parent | `parent_id` not null but account missing |
| Invalid type for code | e.g. 1100 not asset/AR |
| System accounts missing | `ensureDefaultAccounts` gap vs seed |
| Liquidity without group parent | 1000 not under 1050 |
| AR/AP control missing | No 1100 or 2000 |
| Inactive but used | `is_active = false` AND lines exist |
| Deleted but used | soft-delete flag + lines (if applicable) |
| Opening balance without JE | contact/account opening vs no `opening_balance_*` JE |
| `accounts.balance` vs journals | Integrity Lab `accounts_vs_journal` |
| Branch mismatch | JE branch ≠ document branch (trace tool) |

---

## 15. Read-only SQL templates (for COA Health tab)

Company-scoped; run via Developer Center or psql — **no writes**.

```sql
-- Accounts with journal activity
SELECT a.code, a.name, a.is_active, COUNT(jel.id) AS line_count,
       SUM(jel.debit) AS total_debit, SUM(jel.credit) AS total_credit,
       MIN(je.entry_date) AS first_used, MAX(je.entry_date) AS last_used
FROM accounts a
JOIN journal_entry_lines jel ON jel.account_id = a.id
JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = a.company_id
WHERE a.company_id = :company_id AND COALESCE(je.is_void, false) = false
GROUP BY a.id ORDER BY line_count DESC;

-- Duplicate codes
SELECT code, COUNT(*) FROM accounts WHERE company_id = :company_id
GROUP BY code HAVING COUNT(*) > 1;

-- Inactive but used
SELECT a.* FROM accounts a
WHERE a.company_id = :company_id AND a.is_active = false
AND EXISTS (
  SELECT 1 FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = a.id AND COALESCE(je.is_void, false) = false
);
```

Also reuse: `scripts/verify_accounting_source_of_truth_integrity.sql`.

---

## 16. Existing health check code (reuse in Developer Center)

| Check | Service / function |
|-------|-------------------|
| Hierarchy | `accountHierarchyAuditService`, `auditAccountHierarchy()` |
| Full COA audit | `fullAccountingAuditService` |
| TB / BS / P&L | `accountingReportsService` |
| accounts.balance vs GL | `accountingIntegrityLabService` → `accounts_vs_journal` |
| Module COA cert | `runModuleCertificationSuite` → `module_cert_coa` |
| RULE_07 control posting | `developerAccountingDiagnosticsService` |
| AR/AP vs subledger | `arApReconciliationCenterService` |

**Design principle:** GL balances for reporting = sum of `journal_entry_lines`; `accounts.balance` is secondary.

---

## 17. References

- `docs/accounting/COA_MAPPING_MATRIX.md`
- `docs/accounting/ERP_COA_EXECUTION_BLUEPRINT.md`
- `docs/accounting/COA_GAP_ANALYSIS.md`
- `docs/accounting/COA_UAT_RUNBOOK.md`
- `src/app/data/defaultCoASeed.ts`
- `src/app/config/coaMapping.ts`
