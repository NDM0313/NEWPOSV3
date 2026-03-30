# Web vs Mobile Accounting Differences

Evidence-based mismatches and scope differences. Paths are repo-relative from `NEW POSV3/`.

---

## 1) Operational balances and branch scope

| Topic | Web | Mobile |
|-------|-----|--------|
| Contact AR/AP RPC | `src/app/services/contactService.ts` — `getContactBalancesSummary` passes **`p_branch_id`** only when valid UUID; else null | `erp-mobile-app/src/api/contactBalancesRpc.ts` — same RPC; **`customerLedger.ts` explicitly uses `fetchContactBalancesSummary(companyId, null)`** for customer balance header |
| Effect | Branch filter matches selected branch | Customer ledger **company-wide** balance even if user picked a branch |
| Evidence | `contactService.ts` ~69–82 | `customerLedger.ts` lines 1–11, `getCustomerReceivableBalance` ~103 |

---

## 2) Accounting dashboard totals vs mobile dashboard

| Topic | Web | Mobile |
|-------|-----|--------|
| Income / expense / AR / AP summary | `src/app/components/accounting/AccountingDashboard.tsx` — **derived from journal list** using **account name sets** (`INCOME_ACCOUNTS`, `AR_ACCOUNTS` includes “Accounts Receivable”, `AP_ACCOUNTS` includes “Accounts Payable” **and** “Worker Payable”) | `erp-mobile-app/src/components/dashboard/DashboardModule.tsx` — **`profit = sales - purchases`** from document totals |
| Receivables total (reports module) | Not the only web number — see §3 | `reports.ts` `getReceivables` uses **`get_contact_balances_summary`** |
| Evidence | `AccountingDashboard.tsx` ~273–310 | `DashboardModule.tsx` ~99 |

---

## 3) Receivables and payables **lists**

| Topic | Web | Mobile |
|-------|-----|--------|
| Receivables tab | **`sales.sales` with `due > 0`** from `useSales()` | Receivables report uses API layer (see `ReceivablesReport.tsx` + reports api) |
| Payables tab | **`purchases.purchases` with `due > 0`** from `usePurchases()` | **`getSuppliersWithPayable`** sums **`purchases.due_amount`** (`api/accounts.ts` ~317–356) |
| vs RPC party balance | **Not** `get_contact_balances_summary` on those tabs | Contact list uses RPC; supplier payables list uses **purchase documents** |

**Evidence:** `AccountingDashboard.tsx` ~1322–1387 (receivables), ~1390–1459 (payables); `erp-mobile-app/src/api/accounts.ts` `getSuppliersWithPayable`.

---

## 4) Payment adjustments and allocation awareness

| Topic | Web | Mobile |
|-------|-----|--------|
| Adjustments | `paymentAdjustmentService.ts`, `AccountingContext`, integrity lab — **`journal_entries.payment_id`**, adjustment reference types | `sales.ts` reads **`payment_allocations`** when computing sale display balance (~357–402); **full parity with web adjustment editor not established in this audit** |
| Risk | Web explicit | Mobile may miss edge cases if RPC/direct queries differ |

**Evidence:** `src/app/services/paymentAdjustmentService.ts`; `erp-mobile-app/src/api/sales.ts` ~357+.

---

## 5) Parent / child / party balances

| Topic | Web | Mobile |
|-------|-----|--------|
| Customer | `customerLedgerApi` + Contacts GL tab (`ContactsPage.tsx` tooltips ~1599) | Customer ledger: **RPC balance** vs **activity from sales/payments**; **opening from `contacts`** |
| Worker | Worker party: **GL 2010/1180** in `accountingService.ts`; **worker_ledger_entries** in studio paths | Worker payable from **`worker_ledger_entries`**; payment records **ledger insert** |

**Evidence:** `accountingService.ts` ~2167–2304; `erp-mobile-app/src/api/accounts.ts` ~435–647.

---

## 6) Worker payment pipeline (**high impact**)

| Step | Web | Mobile |
|------|-----|--------|
| Canonical comment | `src/app/services/workerPaymentService.ts` — **payments row → journal → worker_ledger_entries** | `WorkerPaymentFlow.tsx` calls **`recordWorkerPayment`** |
| Mobile write | — | `api/accounts.ts` **`recordWorkerPayment`** — **INSERT into `worker_ledger_entries` only** (lines ~616–646) |
| Gap | Full double-entry + `payments` | **No** `payments` / `journal_entries` in that function |

---

## 7) Opening balances

| Topic | Web | Mobile |
|-------|-----|--------|
| GL sync | `openingBalanceJournalService.ts`; `contactService.syncOpeningGlForContact` on changes | Customer ledger injects **opening row** from **`contacts.opening_balance`** (`customerLedger.ts` ~197–218) |
| Risk | Journal vs contact field | Display can match contact field **without** proving match to **opening balance JE** |

---

## 8) Day book / Roznamcha scope

| Topic | Web | Mobile |
|-------|-----|--------|
| Day book | Uses journal reports (see web `DayBookReport`) | `reports.ts` line 124: **all company entries (no branch filter)** |
| Effect | Depends on web report implementation | Mobile day book may **include** other branches’ JEs when web filters by branch |

**Evidence:** `erp-mobile-app/src/api/reports.ts` ~124–143.

---

## 9) Mock vs live accounting UI (mobile only)

| Component | `AccountingModule.tsx` |
|-----------|------------------------|
| Behavior | Hardcoded balances and journal **`useState`** ~38–102 |
| Routing | **Not referenced** by `App.tsx` or other modules (grep 2026-03-30) — **dead file** vs live **`AccountsModule`** |

**Evidence:** `erp-mobile-app/src/components/accounting/AccountingModule.tsx`; `erp-mobile-app/src/App.tsx` imports **`AccountsModule`** only.

---

## 10) Duplicated accounting logic

- **Journal insert:** `src/app/services/accountingService.ts` vs `erp-mobile-app/src/api/accounts.ts` `createJournalEntry`.
- **Contact RPC branch normalization:** `contactService.ts` vs `contactBalancesRpc.ts` (mobile documents intent to mirror web).
- **Customer ledger assembly:** `customerLedgerApi.ts` vs `customerLedger.ts` (different fallbacks).

