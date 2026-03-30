# PHASE2A Implementation Report

Date: 2026-03-30  
Mode: Non-destructive parity fix (no DB/table deletion)

## Change Set Summary

### A) Worker payment parity fixed (mobile)

**Changed files**
- `erp-mobile-app/src/api/accounts.ts`
- `erp-mobile-app/src/components/accounts/WorkerPaymentFlow.tsx`
- `erp-mobile-app/src/components/accounts/AccountsModule.tsx`

**What changed**
- Replaced mobile `recordWorkerPayment` write path from single-table insert (`worker_ledger_entries`) to canonical multi-step flow:
  1. insert/find `payments` row
  2. insert/find `journal_entries` row linked by `payment_id`
  3. insert corresponding two `journal_entry_lines` (Dr worker payable/advance, Cr selected payment account)
  4. insert/find `worker_ledger_entries` payment row
- Added branch/user/payment-account context from UI flow to API call.
- Added duplicate guards across all 4 layers.

**Backend objects affected**
- Tables: `payments`, `journal_entries`, `journal_entry_lines`, `worker_ledger_entries`, `accounts`

**Reason**
- Audit identified highest-severity mismatch: mobile worker payment was bypassing payment + GL layers.

**Expected accounting effect**
- Mobile worker payment now appears in Roznamcha/payment layer and GL, not only worker ledger.
- Worker/studio balances reconcile better with web.

**Remaining risk**
- Web has additional logic (`shouldDebitWorkerPayableForPayment`) based on stage-bill context; mobile currently chooses payable/advance via account availability heuristic.

---

### B) Branch scope parity applied to mobile customer ledger

**Changed files**
- `erp-mobile-app/src/api/customerLedger.ts`
- `erp-mobile-app/src/components/ledger/LedgerModule.tsx`
- `erp-mobile-app/src/App.tsx`

**What changed**
- `getCustomersWithBalance` and `getCustomerReceivableBalance` now accept `branchId` and pass through to balance RPC helper.
- `getCustomerLastTransactions` now accepts `branchId` and applies branch filter to payment queries where possible.
- `LedgerModule` and app route now pass selected branch id.

**Backend objects affected**
- RPC: `get_contact_balances_summary`
- Table reads: `payments` (branch constrained in customer ledger transaction fetch)

**Reason**
- Audit flagged mobile using company-wide null branch while web uses selected branch policy.

**Expected accounting effect**
- Same branch context should now produce closer web/mobile customer balance parity.

**Remaining risk**
- Low: edge cases where historical rows lack `branch_id` alignment — branch filter behavior is verified at runtime (see Final verification below).

---

### C) AR/AP source semantics made explicit and less mixed

**Changed files**
- `src/app/components/accounting/AccountingDashboard.tsx`
- `erp-mobile-app/src/components/accounts/ReceivablesReport.tsx`
- `erp-mobile-app/src/components/accounts/PayablesReport.tsx`

**What changed**
- Web accounting cards now explicitly labeled as GL-derived.
- Web receivables/payables tabs now explicitly labeled as operational document due.
- Mobile receivables total now computed from the same invoice due list used in the page (removed silent total/list source mismatch).
- Mobile payables page now explicitly labeled as document due source.

**Backend objects affected**
- `sales`, `purchases`, `journal_entries`, `journal_entry_lines`

**Reason**
- Audit identified silent mixed-source behavior causing confusion and mismatch perceptions.

**Expected accounting effect**
- Users can distinguish operational vs GL totals and reduce false “bug” reports caused by mixed semantics.

**Remaining risk**
- Screens still intentionally show different semantics for different jobs (collection workflow vs reconciliation).

---

### D) Dashboard parity direction applied (mobile financial cards)

**Changed files**
- `erp-mobile-app/src/components/dashboard/DashboardModule.tsx`

**What changed**
- Mobile dashboard financial cards changed from document margin (`sales - purchases`) to GL-style journal-derived cards:
  - Total Income (GL)
  - Total Expense (GL)
  - Net Profit (GL)
  - Receivables (GL)
  - Payables (GL)
- Kept `Total Orders` document-based.

**Backend objects affected**
- `journal_entries`, `journal_entry_lines` (via existing mobile `getJournalEntries`)
- existing inventory/sales summary calls unchanged for non-financial cards

**Reason**
- Audit called out dashboard semantics mismatch between web and mobile.

**Expected accounting effect**
- Financial cards now use same accounting meaning family (GL-derived) as web accounting dashboard.

**Remaining risk**
- Current mobile derivation is account-name based and may still differ from dedicated finance RPC totals.

---

### E) Dead/mock accounting UI review

**Checked**
- `erp-mobile-app/src/components/accounting/AccountingModule.tsx`

**Finding**
- No references found in `erp-mobile-app/src` (grep check).
- Not removed in phase 2A (review-only per instruction).

---

## Legacy Safety Check

- No new references added to:
  - `chart_accounts`
  - `account_transactions`
  - `accounting_audit_logs`
  - `automation_rules`
  - `ledger_master`
  - `ledger_entries`

- No DB structure change performed.
- No destructive script executed.

---

### F) Phase 2A.1 sync/offline payload alignment (minimal patch)

**Changed files**
- `erp-mobile-app/src/lib/registerSyncHandlers.ts`

**What changed**
- Updated offline `payment` sync handler worker branch to match current `recordWorkerPayment(...)` contract:
  - now requires `paymentAccountId` for worker payment replay
  - forwards `branchId`, `paymentMethod`, `userId`, `workerName`, `paymentReference`, and optional `stageId`
- Kept supplier payment sync contract unchanged.
- No queue schema refactor; no new offline table/state introduced.

**Reason**
- After worker payment parity hardening, `recordWorkerPayment` requires `paymentAccountId`; old sync handler replay path could submit invalid payload and fail retries.

**Expected effect**
- Pending offline worker payment records that include payment account now replay with same accounting intent as online submission.
- Prevents contract mismatch between queue payload and API layer.

**Risk / limitation**
- Existing queued worker payment records created by older app builds (without `paymentAccountId`) will continue to fail sync and remain visible as sync errors until manually re-posted.

---

### G) Phase 2A.2 — Branch-aware customer ledger RPC + dashboard operational AR/AP

**Changed files (application)**
- `migrations/20260370_phase2a2_ledger_sales_branch_dashboard_contact_ar_ap.sql` (new)
- `erp-mobile-app/src/api/customerLedger.ts` — `get_customer_ledger_sales` always called with `p_branch_id`; fallback `sales` query respects branch
- `erp-mobile-app/src/api/financialDashboard.ts` — passes `p_branch_id` via `safeRpcBranchId`; surfaces optional `ar_ap_basis` / `ar_ap_scope`
- `erp-mobile-app/src/components/dashboard/DashboardModule.tsx` — passes branch into metrics RPC; copy explains operational roll-up
- `erp-mobile-app/src/components/accounts/ReceivablesReport.tsx`, `PayablesReport.tsx` — explicit “compare only within same source” notes
- `src/app/services/customerLedgerApi.ts` — `ledgerSalesRpcBranchId`, `CustomerLedgerQueryOptions.branchId`, all internal `fetchCustomerLedgerSalesForRange` paths pass `p_branch_id`
- `src/app/services/accountingService.ts` — `fetchCustomerLedgerSalesForRange(..., ledgerSalesRpcBranchId(branchId))`
- `src/app/services/financialDashboardService.ts` — `getFinancialDashboardMetrics(companyId, branchId?)`, fallback passes branch; parses `ar_ap_basis` / `ar_ap_scope`
- `src/app/components/dashboard/Dashboard.tsx` — executive AR/AP titles + semantics footnote
- `src/app/components/accounting/AccountingDashboard.tsx` — GL vs operational vs `get_contact_balances_summary` legend
- `src/app/components/test/LedgerDebugTestPage.tsx` — `p_branch_id: null` on RPC probe

**Exact SQL / function changes (in migration file)**

1. **`get_customer_ledger_sales`**  
   - **Before:** `public.get_customer_ledger_sales(uuid, uuid, date, date)` — no branch filter.  
   - **After:** `public.get_customer_ledger_sales(uuid, uuid, date, date, uuid default null)` — `AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)`.

2. **`get_financial_dashboard_metrics`**  
   - **Before:** `public.get_financial_dashboard_metrics(uuid)` — `receivables` / `payables` from raw `SUM(sales.due_amount)` and `SUM(purchases.due)` with `due > 0` (`20260342`).  
   - **After:** `public.get_financial_dashboard_metrics(uuid, uuid default null)` — `receivables` / `payables` = `SUM` over `get_contact_balances_summary(p_company_id, p_branch_id)`; JSON adds `ar_ap_basis`, `ar_ap_scope`.

3. **`get_dashboard_metrics`**  
   - **After:** Calls `get_financial_dashboard_metrics(p_company_id, p_branch_id)` and overwrites AR/AP with the same contact-summary sums for the selected branch scope (replaces prior `SUM(sales.due_amount)` overwrite in `20260352`).

**Before / after semantics**

| Surface | Before (typical) | After (2A.2) |
|--------|-------------------|--------------|
| Executive dashboard Receivables / Payables | Raw positive document due columns | Operational party roll-up = SUM(`get_contact_balances_summary`) |
| Customer ledger sales RPC | Company-wide all branches | Optional branch filter via `p_branch_id` |
| Accounting dashboard top cards | GL journal (unchanged) | GL journal (unchanged); legend clarifies vs tabs vs contact summary |

**Risk**
- Payables total on executive dashboard can **increase** vs old card when worker/studio payables were excluded from purchase-only sum — UI labels state operational basis.

---

## Final verification (2026-03-30) — phase gate closed

Recorded in `docs/accounting/PHASE2A_QA_EVIDENCE.md` with example company `db1302ec-a8d7-4cff-81ad-3c8d7cb55509`.

| Check | Result |
|--------|--------|
| Migration applied on DB | **YES** — `migrations/20260370_phase2a2_ledger_sales_branch_dashboard_contact_ar_ap.sql` |
| RPC signatures at runtime | **PASS** — `get_customer_ledger_sales(uuid, uuid, date, date, uuid)`; `get_financial_dashboard_metrics(uuid, uuid)` |
| Worker payment canonical chain + duplicate counts | **PASS** — `PAY-0038` / worker `d208e44f-bf49-4288-8c01-d486ecb6da5c`: `payments_ct=1`, `je_ct=1`, `jel_ct=2`, `worker_ledger_ct=1` |
| Branch-aware ledger RPC | **PASS** — customer `45e60a2e-9b1a-478c-8f75-cf09d29a0eba`: company_scope `row_ct=2`, branch_scope `row_ct=2` |
| Executive dashboard AR/AP JSON | **PASS** — `ar_ap_basis=get_contact_balances_summary`, `ar_ap_scope=branch`, `receivables=18000.03`, `payables=464302.00`; aligned to branch-scoped contact-summary sums |

**Phase gate:** **READY FOR PHASE 2B LEGACY FREEZE = YES** (see `docs/accounting/PHASE2A_SIGNOFF.md`).

