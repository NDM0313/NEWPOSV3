# Contacts / AR / AP / Ledger / Statement — single-source read-path audit

**Date:** 2026-03-29  
**Scope:** Repository trace + live Postgres (`supabase-db` on VPS) function versions.  
**Related migrations:** `20260430` (operational RPC), `20260431` (allocated manual parity), `20260410` (AR/AP subtree party GL).

---

## Legend

| Tag | Meaning |
|-----|---------|
| **OP** | Operational (open documents / RPC subledger rules) |
| **GL** | Journal-derived (`journal_entries` + `journal_entry_lines`) |
| **RPC** | Postgres function invoked via `supabase.rpc` |

---

## A. Contacts page (`ContactsPage.tsx`)

| Widget / section | React | Service / hook | SQL / RPC | Basis | Notes |
|------------------|-------|------------------|-----------|--------|-------|
| Grey RECV / PAY header cards | `ContactsPage` | Sums `filteredContacts[].receivables` / `payables` | **`get_contact_balances_summary`** via `contactService.getContactBalancesSummary` merged into rows | **OP** | No silent merge with raw sales/purchases after parity fix. |
| Per-row operational recv/pay | Same | Same merge by `contact.uuid` | **`get_contact_balances_summary`** | **OP** | |
| Per-row GL subline (violet) | `contactPartyGlReceivableSigned` / `contactPartyGlPayableSigned` | `partyFormBalanceService` → `getContactPartyGlBalancesMap` | **`get_contact_party_gl_balances`** | **GL** | AR uses **1100 subtree**; AP uses **2000 subtree** (migration `20260410` on live). |
| Reconciliation strip (3 cards) | `reconSnapshot` from `contactBalanceReconciliationService` / control rollup | `arApReconciliationCenterService`, `controlAccountBreakdownService` | **`get_contact_balances_summary`** + **`get_contact_party_gl_balances`** + optional `fetchControlAccountBreakdown` | **OP vs GL** | Amber when variance ≠ 0. |

**Fallbacks:** None for operational row amounts when RPC succeeds. If RPC returns 0 rows, UI applies 0/0 per contact (not merged document math).

---

## B. Customer ledger (`CustomerLedgerPageOriginal.tsx` + `customerLedgerApi`)

| Tab / section | Source | SQL / path | Basis |
|---------------|--------|------------|--------|
| Operational / transactions | `customerLedgerAPI.getTransactions`, `getLedgerSummary`, etc. | `sales`, `payments`, `customer_ledger` views / RPCs as implemented in `customerLedgerApi.ts` | **OP** (document-level) |
| GL tab (if present in embedded views) | Account statement path may use `get_customer_ar_gl_ledger_for_contact` via `accountingService` when opened from Accounting | RPC in `20260410` | **GL** |
| Reconciliation in `GenericLedgerView` | N/A for pure customer in `LedgerHub` — **Customer** full-screen uses `CustomerLedgerPageOriginal`, not `GenericLedgerView`. | — | Customer statement GL is often reached via **Accounting → Account Statements** or ledger hub. |

**Note:** Customer ledger **operational** stack is **not** the same code path as **Supplier `GenericLedgerView`**; both are intentional (sales vs purchases domain).

---

## C. Supplier / user / worker ledger (`GenericLedgerView.tsx`)

| Engine | Loader | SQL / RPC | Basis |
|--------|--------|-----------|--------|
| Operational tab | `getSupplierOperationalLedgerData` / `getUserLedgerData` / `getWorkerLedgerData` (`ledgerDataAdapters.ts`) | `purchases`, `payments`, `worker_ledger_entries`, etc. | **OP** |
| GL tab | `accountingService.getSupplierApGlJournalLedger` / `getWorkerPartyGlJournalLedger` | RPC-backed journal lists (`get_supplier_ap_gl_ledger_for_contact`, worker analogue) | **GL** |
| Reconciliation | `getSingleSupplierPartyReconciliation` / worker variant (`contactBalanceReconciliationService.ts`) | **`get_contact_balances_summary`** vs **`get_contact_party_gl_balances`** | **OP vs GL** |

---

## D. Accounting → Account Statements (`AccountLedgerReportPage.tsx`)

| Mode | Loader | SQL / RPC | Basis |
|------|--------|-----------|--------|
| Party AR child / customer filter | `accountingService.getCustomerArGlJournalLedger` | `get_customer_ar_gl_ledger_for_contact` (`20260410`) | **GL** |
| Party AP / supplier | `getSupplierApGlJournalLedger` | `get_supplier_ap_gl_ledger_for_contact` | **GL** |
| Generic account ledger | `accountingService.getAccountLedger` | `journal_entry_lines` + `journal_entries` for account id | **GL** |

`payment_adjustment` rows appear when posted; statement filters should include adjustments when “include adjustments” is on.

---

## E. Journal Entries & Day Book (`AccountingDashboard.tsx`, `DayBookReport.tsx`)

| Screen | Source | Basis |
|--------|--------|--------|
| Journal Entries list | `AccountingContext.entries` (from journal loader / merge in context) | **GL** (aggregated to `AccountingEntry`) |
| Day Book | `journal_entries` + lines query in `DayBookReport.tsx` | **GL** |

Edit policy: `journalEntryEditPolicy.ts` — document rows blocked; payment-linked rows allowed.

---

## F. COA / Accounts hierarchy (`AccountingDashboard` + `useAccountsHierarchyModel.ts`)

| Surface | Source | Authority |
|---------|--------|-----------|
| Party row under AR/AP control | `partyGlByContactId` from **`get_contact_party_gl_balances`** when provided | **GL (canonical for party)** |
| Fallback when map null | `account.balance` from COA | **Cache only — non-authoritative** for party AR/AP (comment in `useAccountsHierarchyModel.ts`) |

---

## G. Dashboard executive metrics (`Dashboard.tsx`)

| Metric | Source |
|--------|--------|
| Receivables / payables headline | Sum of **`get_contact_balances_summary`** per branch scope (documented in UI copy) | **OP** |

---

## Canonical truth rules (enforced in code + DB)

1. **Contacts operational columns:** **`get_contact_balances_summary`** only.  
2. **Contacts GL sublines & reconciliation GL side:** **`get_contact_party_gl_balances`** (AR/AP subtree + party resolution).  
3. **Journal / Day Book / account statement party ledgers:** `journal_entries` + `journal_entry_lines` (via RPCs that wrap the same).  
4. **`accounts.balance`:** Not used as truth for contact AR/AP when party RPC is available.

---

## Live DB verification

`get_contact_party_gl_balances` on VPS includes **`ar_subtree`** / **`ap_subtree`** (confirmed via `pg_get_functiondef` — recursive CTE under 1100/2000). Operational parity migrations **`20260430`**, **`20260431`** are assumed applied per prior reports.
