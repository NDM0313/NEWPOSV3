# AR/AP control vs contact subledger — full audit & fix plan (NEW POSV3)

**Audience:** Senior ERP accounting / PostgreSQL audit.  
**Related:** [`JOURNAL_ENGINE_MASTER_PLAN.md`](./JOURNAL_ENGINE_MASTER_PLAN.md) (journal as GL source of truth).

---

## Executive summary — root cause

**Contacts totals and Trial Balance AR/AP will not match** in the current design because they are **two different definitions**:

| Layer | What it measures | Source in this repo |
|--------|------------------|---------------------|
| **Contacts screen** | “Operational” open balance per party | **Not journal:** `get_contact_balances_summary` RPC = `sales`/`purchases` **due fields** + **contact opening** + **worker_ledger** (workers path) |
| **Trial Balance / COA / GL** | Net on control accounts | **`journal_entry_lines`** joined to `journal_entries` (`accountingReportsService.getTrialBalance`, void + date + branch filters) |

**There is no `contact_id` (or equivalent) on `journal_entry_lines`.** Subledger linkage to a party is **indirect**: `journal_entries.reference_type` / `reference_id` (e.g. `sale`, `purchase`, `manual_receipt`, `customer_payment`, `worker_payment`) and sometimes `payment_id`. That makes “sum of all AR lines attributable to customer X” a **derived** query, not a first-class column.

**Symptom you saw (AR credit-heavy / negative in TB while Contacts receivables are large and positive)** is consistent with:

1. **More credits than debits posted to the AR account** (receipts, credit notes, reversals, mis-posted Dr/Cr, or duplicate Cr AR).
2. **Sales / `due_amount` updated** in a way that **does not mirror** every movement on account 1100 (e.g. payments without matching JE, manual JEs on AR not tied to a sale row, legacy migration).
3. **Branch / void / date range** applied differently (TB uses JE `entry_date` + optional `branch_id`; Contacts RPC filters **sales/purchases by `branch_id`** but worker ledger is company-wide).

So the mismatch is **not a single bug in one formula** — it is **two sources of truth** until the product explicitly chooses **journal-only** for “financial truth” and demotes invoice math to **reconciliation / operational** only.

---

## Step 1 — Current Contacts receivable / payable logic (exact)

### Primary path (production Contacts page)

- **File:** `src/app/components/contacts/ContactsPage.tsx`  
- **RPC:** `contactService.getContactBalancesSummary` → PostgreSQL `public.get_contact_balances_summary(p_company_id, p_branch_id)`.

**Migrations / SQL:**

- `migrations/get_contact_balances_summary_rpc.sql` (base definition)
- `migrations/get_contact_balances_summary_worker_ledger_fix.sql` (worker payables: `worker_ledger_entries` + `workers.current_balance` fallback)

**Receivables (customer / both):**

- `GREATEST(0, contacts.opening_balance)`  
- `+ SUM` over **non-cancelled** `sales` for `customer_id = contact.id`:  
  `GREATEST(0, COALESCE(due_amount, total - paid_amount))`  
- Optional **`p_branch_id`** filter on `sales.branch_id`.

**Payables (supplier / both):**

- Supplier opening + sum of purchase dues (same due/total/paid pattern), branch filter on purchases.

**Payables (worker):**

- If any `worker_ledger_entries` for `worker_id = contact.id`: sum **unpaid** amounts.  
- Else `workers.current_balance` / contact fields.

**Does not use:** `journal_entries` / `journal_entry_lines` for customer/supplier AR/AP totals.

### Fallback path (RPC failure)

- **Same file:** `convertFromSupabaseContact` + `saleService.getAllSales` / `purchaseService.getAllPurchases` — same **invoice math**, plus `workers` map for worker opening path.

### Conclusion vs GL

| Contacts (RPC) | Trial Balance AR (1100) |
|----------------|-------------------------|
| Invoice + opening subledger | Σ(debit − credit) on **one** AR account for all parties + all non-invoice JEs |

They **should** align only if **every** economic event that changes real AR/AP is **double-entered** on 1100/2000 **and** `sales`/`purchases` **due** fields stay in lockstep with those journals — which strict journal-only governance does not guarantee today.

---

## Step 2 — AR/AP control accounts (journal-only rebuild)

### Resolution in app

- **AR:** `saleAccountingService` / `ensureARAccount` — typically code **1100** (“Accounts Receivable”).  
- **AP:** `purchaseAccountingService` — resolves **2000** or name match “Accounts Payable”.

### Rebuild balance (already implemented for reporting)

- **`accountingReportsService.getTrialBalance`** — per-account `debit`, `credit`, `balance = debit - credit` for lines where:
  - `journal_entries.company_id` matches  
  - `is_void IS NOT TRUE`  
  - `entry_date` in `[startDate, endDate]`  
  - optional `branch_id` on **journal entry** (not on line)

### Cross-check helper (Contacts vs GL strip)

- **`accountingReportsService.getArApGlSnapshot`** — life-to-date TB slice for reconciliation UI; **not** a second truth, only GL read.

### Typical causes of “negative AR” (asset, Dr−Cr &lt; 0)

- Customer receipts **Cr AR** without matching **Dr AR** from sale (or sale JE missing / voided while sale still “open”).  
- **Pure journal** or **adjustment** crediting AR.  
- **Wrong account** selected on payment (Cr AR twice, or Dr wrong account).  
- **Legacy / import** data.

**Audit SQL (run in Supabase / psql):**

```sql
-- Lines hitting AR account (replace :ar_id)
SELECT je.entry_no, je.entry_date, je.reference_type, je.reference_id, je.is_void,
       jel.debit, jel.credit, jel.description
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id = :ar_id
  AND je.company_id = :company_id
ORDER BY je.entry_date, je.created_at;
```

Repeat for AP account id.

---

## Step 3 — Contact linkage to accounting

### How linkage works today

| Mechanism | Where |
|-----------|--------|
| **Sale → AR** | JE `reference_type = 'sale'`, `reference_id = sale.id`; AR line has no `customer_id` |
| **Customer receipt** | `addEntryV2Service.createCustomerReceiptEntry`: `reference_id = customerId`, lines Dr cash / Cr AR |
| **Purchase → AP** | JE `reference_type = 'purchase'`, `reference_id = purchase.id` |
| **Supplier payment** | Canonical paths in `purchaseService` / `supplierPaymentService` — JEs with payment refs |

### Gaps (reconciliation blind spots)

- **No `contact_id` on `journal_entry_lines`** → subledger by contact = **rules** (join via sale/payment/customer id), not a single column.  
- **Manual / pure journal** on AR/AP: visible in **account ledger**, may not appear in **Contacts** totals.  
- **getCustomerLedger** (`accountingService.getCustomerLedger`) mixes **journal lines** with **RPC sales/payments** and synthetic rows — UI ledger is **not** “GL lines only” (by design for completeness).

### Bypass risk

Any path that updates `sales.due_amount` / `paid_amount` **without** a balanced JE to 1100 (or updates AR via wrong account) creates variance.

---

## Step 4 — Proposed reconciliation SQL (views / RPCs)

Implement in phases; all must respect **`company_id`**; branch policy must be **documented** (see Step 5).

### 4.1 `v_gl_ar_lines` / `v_gl_ap_lines` (optional thin views)

- Filter `journal_entry_lines` joined to `journal_entries` where `account_id` in (AR id, AP id) for company, `is_void = false`.

### 4.2 Customer **journal-derived** open balance (conceptual)

For each `contacts.id` where type in (`customer`,`both`):

- **Debits to AR** where JE links to this customer: e.g. `reference_type = 'sale'` and `sales.customer_id = contact`, plus rules for `manual_receipt` / payments with `reference_id = customerId`, etc.  
- **Credits to AR** similarly.

This requires a **documented mapping table** of `reference_type` → how to resolve `contact_id`. Until then, automated “journal subledger” is **fragile**.

### 4.3 `v_reconciliation_ar_control_vs_subledger`

- **Column A:** TB net on AR (from lines).  
- **Column B:** Sum of journal-derived customer balances (once 4.2 exists).  
- **Variance:** A − B (or define sign convention in UI).

### 4.4 `v_journals_ar_ap_without_subledger_mapping`

- Lines on AR/AP where `reference_type` / `reference_id` **cannot** be resolved to a contact or document (heuristic list: `pure_journal`, unknown ref, etc.).

### 4.5 `v_contacts_rpc_vs_journal_customer` (QA)

- Join `get_contact_balances_summary` receivables to 4.2 per customer where both exist — flag `ABS(diff) > tolerance`.

**Note:** Worker payables already split between **operational** (`worker_ledger`) and **GL** (e.g. 2010 Worker Payable + cash); same **definition** problem unless you define “official” worker AP.

---

## Step 5 — Correct production design (target)

### Chart of Accounts

- Shows **control accounts** only for AR/AP (1100, 2000, and separate **Worker Payable 2010** if used) — **not** one GL account per supplier/customer (see explicit answer below).

### Contacts screen

- **Primary display for operations:** contact list, credit limits, collections.  
- **Financial truth (if journal-only policy):** show **“GL-aligned balance”** from journal-derived subledger **when available**, plus **“Invoice balance”** from current RPC as secondary or “pending sync” until backfill completes.  
- **Reconciliation strip:** already partially done (Contacts vs GL snapshot) — extend with **“unmapped AR/AP activity”** count/link.

### Ledger drill-down

- From **COA / TB row AR** → `AccountLedgerView` (all lines on 1100).  
- From **Contact** → customer/supplier ledger that can offer **tabs:** “Subledger (journal-based)” vs “Documents (sales/purchases)” until merged.

### Reconciliation workflow

1. TB AR = X (journal).  
2. Sum of journal-derived customer balances = Y.  
3. Unmapped journals = Z (explain X − Y).  
4. Optional: invoice subledger sum = W (explain operational vs GL).

### Branch & void

- **Single rule:** either TB and subledger both filter `journal_entries.branch_id`, or both use **company-wide** GL with a note. **Sales** branch filter on Contacts must match the **same** convention or variance is expected.  
- **Void:** `is_void = true` excluded everywhere for “business” totals.

---

## Step 6 — Refactor plan (backend)

### Phase A — Measurement (low risk)

1. Deploy reconciliation **views/RPCs** (read-only).  
2. Extend **Integrity Lab** or admin report: variance histogram, top unmapped JEs.  
3. No change to Contacts numbers yet.

### Phase B — Single “contact balance” service (medium risk)

1. New module e.g. `contactBalanceReconciliationService.ts`:  
   - `getOperationalBalance(contactId)` → current RPC / fallback (rename clearly).  
   - `getJournalAlignedBalance(contactId)` → new SQL/RPC (incremental).  
2. **Contacts UI** labels: “Invoice / operational” vs “GL (journal)”.  
3. **Do not** remove RPC until journal subledger covers **all** posting paths you care about.

### Phase C — Posting enforcement (higher risk)

1. **Idempotent** sale/purchase/payment JEs only path to move AR/AP (already largely true; audit exceptions).  
2. **Block or warn** manual JE to 1100/2000 without **dimension** (see Step 7 optional schema).  
3. Deprecate authoritative **`accounts.balance`** for reporting (per master plan).

### Phase D — Optional schema (highest clarity)

- Add nullable **`journal_entry_lines.party_contact_id`** (or `subledger_dimension`) populated by posting layer for **every** line that hits AR/AP/worker payable.  
- Enables trivial rollups and reconciliation without inferring from `reference_type`.

---

## Step 7 — Deliverables checklist

### 7.1 Root cause report

- **Two truths:** invoice/RPC subledger vs journal control accounts; no line-level party key.  
- **Negative AR:** accounting meaning = credits &gt; debits on 1100; fix is **posting / data repair**, not changing TB formula.

### 7.2 Files / services / functions

| Item | Role |
|------|------|
| `migrations/get_contact_balances_summary_rpc.sql` + worker fix | Contacts totals RPC |
| `src/app/components/contacts/ContactsPage.tsx` | Calls RPC, fallback convert, GL strip |
| `src/app/services/contactService.ts` | `getContactBalancesSummary` |
| `src/app/services/accountingReportsService.ts` | TB, `getArApGlSnapshot` |
| `src/app/services/saleAccountingService.ts` | Sale → Dr AR |
| `src/app/services/purchaseAccountingService.ts` | Purchase → Cr AP |
| `src/app/services/addEntryV2Service.ts` | Manual receipt → Cr AR |
| `src/app/services/accountingService.ts` | `getCustomerLedger` (hybrid journal + RPC) |
| `migrations/20260326_journal_sot_validation_views.sql` | Journal integrity views |

### 7.3 SQL / view changes required

- Reconciliation views/RPCs in Step 4 (incremental).  
- Optional `party_contact_id` on lines (Step 6D).  
- Backfill job: infer party from `reference_*` for historical rows (one-off).

### 7.4 Backend refactor plan

- Phases A–D above; **service rename** so “operational” vs “GL” is explicit.

### 7.5 UI behavior plan

- **COA:** control accounts only; actions “Ledger”, “Reconciliation”.  
- **Contacts:** dual metric + variance badge; link to Integrity Lab / unmapped JEs.  
- **TB:** keep credit-heavy asset warning (already in `TrialBalancePage.tsx`).

### 7.6 Validation checklist

- [ ] TB total debit = credit (existing).  
- [ ] `check_journal_entries_balance()` or `v_accounting_unbalanced_journals` empty.  
- [ ] For sample company: sum journal-derived customer AR ≈ TB AR (within tolerance after unmapped bucket).  
- [ ] Every `sale` final has canonical sale JE; every payment has payment JE to AR.  
- [ ] Branch filter documented and consistent on Contacts vs Reports.  
- [ ] Voided JEs excluded from business totals everywhere.

### 7.7 Recommended implementation order (lowest risk)

1. **Read-only** reconciliation views + admin/Integrity Lab.  
2. **Label + UI** honesty (operational vs GL) — no posting change.  
3. **Posting audit** (grep all `journal_entry_lines` inserts touching AR/AP accounts).  
4. **Data repair** scripts for known bad periods (company-specific).  
5. Optional **`party_contact_id`** + backfill + roll Contacts “official” number to journal.  
6. Remove duplicate truth from **primary** financial headline when stakeholders sign off.

---

## Explicit answers (product / accounting)

### Should suppliers appear as individual rows in Chart of Accounts?

**No** for a standard ERP COA. **Suppliers should not be separate GL accounts** in the master chart. Use:

- **One (or few) AP control account(s)** (e.g. 2000), and  
- **Subledger / party dimension** (contact id) for detail, aging, and supplier statements.

Exceptions (advanced): intercompany or legal-entity requirements may add dedicated GL accounts — that is explicit policy, not default.

### How should customer/supplier balances be shown so users trust both Contacts and Financial Reports?

1. **Financial reports (TB, BS, P&amp;L):** **Journal only** — one sentence in UI: *“Balances follow posted journals.”*  
2. **Contacts:** show **two numbers** until fully aligned:  
   - **“Open invoices / documents”** (current RPC — operations/collections).  
   - **“GL (Accounts Receivable)”** per contact once journal subledger exists; or company-level **“AR control = Σ journals”** with drill-down.  
3. **Variance:** always visible with link to **unmapped journals** and **Integrity Lab**.  
4. After backfill + posting discipline: **collapse to one “official” balance = journal**, keep invoice view as **document list**, not a second total.

---

## Summary one-liner

**Fixing the mismatch is not “correcting one query” — it is choosing journal as the only financial truth, making subledger derivable from journals (or explicitly labeled as non-GL until then), and surfacing variance + unmapped activity in UI and SQL.**

---

*Document version: 2026-03-12. Maintainer: align with `JOURNAL_ENGINE_MASTER_PLAN.md` when implementation phases complete.*
