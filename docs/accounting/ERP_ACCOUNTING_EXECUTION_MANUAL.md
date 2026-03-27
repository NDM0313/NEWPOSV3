# ERP Accounting — Execution Manual

**Project:** NEWPOSV3  
**Last updated:** 2026-03-27  
**Audience:** Developers, finance operators, support  
**Purpose:** Operational truth for **what happens in the system** when business events occur — not high-level strategy only.

---

## 1. Executive summary

- **Accounting truth** for balances and financial reports is **double-entry journals**: `journal_entries` + `journal_entry_lines`, scoped by `accounts` and `company_id`. Voided journal headers (`is_void = true`) are **excluded** from standard Trial Balance / P&L / Balance Sheet math.
- **Operational truth** for “who owes what on which invoice” lives in **source documents** and subsidiary structures (`sales`, `purchases`, `payments`, `payment_allocations`, `worker_ledger_entries`, `rentals`, etc.). These must **reconcile** to GL; they do not replace GL for TB/BS/P&L.
- The **frontend** should stay simple: effective balances, clear party names, minimal technical clutter.
- **Audit** views preserve adjustments, reversals, and void markers without forcing that noise into every operational screen.
- This manual ties **backend tables**, **journal shapes**, and **UI expectations** together so “where did this amount come from?” has one answer path.

---

## 2. Accounting principles used in this ERP

| Principle | Meaning |
|-----------|---------|
| **Journal-based GL** | TB/BS/P&L and account ledger run from summed journal lines, not `accounts.balance` as primary truth. |
| **Control + subledger** | `1100`/`2000` roll up; party detail on `AR-*`/`AP-*` with `linked_contact_id` when possible. |
| **No casual delete** | Financial correction favors void, reversal, or adjustment layers — not silent row delete. |
| **Header-only vs financial edit** | Date/notes/reference may update without new economics; amount/account/qty changes drive **delta** or **reversal+repost** per module. |
| **Effective vs audit** | Effective = net outcome void-aware; audit = full JE chain and flags. |
| **No double counting on BS** | AR/AP **child** rows are **rolled into** control on Balance Sheet (implementation in `accountingReportsService.getBalanceSheet`). |
| **Payment isolation** | Document JEs (sale/purchase) do not use `payment_id`; payment JEs link payments (`PAYMENT_ISOLATION_RULES.md`). |

---

## 3. Source of truth model

| Question | Source of truth |
|----------|-----------------|
| TB / BS / P&L / GL account balance | Sum of **`journal_entry_lines`** (non-void JE) |
| Chart structure | **`accounts`** |
| Payment row for Roznamcha / tracing | **`payments`** (+ linked JE when posted) |
| How customer payment applied to invoices | **`payment_allocations`** (and sale `paid`/due fields) |
| Open invoice amounts | **`sales`** (and related payment aggregates) — **operational** |
| Party GL AR balance | Journal activity on **`AR-*` or `1100`** for that party |
| Inventory GL | Typically account **`1200`** |
| Worker operational due | **`worker_ledger_entries`** + studio rules |
| Rental operational due | **`rentals`** + **`rental_payments`** |

---

## 4. Effective view vs audit view

| View | Shows | Hides or collapses |
|------|-------|---------------------|
| **Effective** | Net position, final invoice/charge lines, running balance that matches “what is owed now” | Voided JEs in TB; raw `sale_adjustment` noise where UI groups; `correction_reversal` as primary line item (depends on screen) |
| **Audit** | All JEs, void flags, adjustment reference types, reversal pairings | Nothing by default |

**Unified edit routing:** `src/app/lib/unifiedTransactionEdit.ts` — voided and `correction_reversal` entries block direct “edit this line” and point to source documents.

---

## 5. Backend stores vs frontend shows (matrix)

| Scenario | Backend | Normal (effective) UI | Audit UI |
|----------|---------|----------------------|----------|
| Final sale | `sales`, `sales_items`, JE `reference_type: sale` | Invoice total, due, one business row per invoice in customer view | JE list + lines; `sale_adjustment` if edited |
| Sale + later payment | `payments`, `journal_entries` with `payment_id`, allocations | Payment row | Payment + JE + void state |
| Purchase + supplier pay | `purchases`, `payments`, JE | Bill balance, payment history | Purchase + payment JEs |
| Manual customer receipt | `payments`, possibly `manual_receipt` JE | Receipt in customer statement | Full journal |
| Expense paid | `payments` ref `expense`, JE Dr expense Cr bank | Expense list | JE + payment |
| Rental payment | `rental_payments`, JE `reference_type: rental` (when posted) | Rental paid/due | rental_payments + JE + void |
| Worker payment | `payments` / worker flow, JE `worker_payment`, `worker_ledger_entries` | Worker ledger payment row | JE lines on `2010`/`1180` |

---

## 6. Module-by-module workflows (summary)

### A) Sales

| Stage | JE? | Typical lines |
|-------|-----|----------------|
| Finalize | Yes (document) | Dr AR (`AR-*`/`1100`), Cr `4000`/revenue + `4110` if shipping + Cr discount if any; Dr `5000` Cr `1200` COGS |
| Payment | Yes | Dr Cash/Bank, Cr AR |
| Edit (financial) | Delta `sale_adjustment` | Partial lines for changed components only |
| Cancel | `sale_reversal` or reversal JE | Mirror document |

### B) Purchases

| Stage | JE? | Lines |
|-------|-----|-------|
| Post bill | Yes | Dr `1200` Cr AP (`AP-*`/`2000`) + discount/extra per service |
| Pay supplier | Yes | Dr AP Cr bank |

### C) Customer receipts

- **Allocated:** `payment_allocations` tie amounts to `sale_id` (FIFO or manual per product rules).
- **On-account:** Customer CR balance / unapplied — see `on_account` / `manual_receipt` paths in `accountingService`.
- **GL:** Cr AR (child preferred).

### D) Supplier payments

- **Purchase-linked:** `reference_type` purchase + `reference_id`.
- **Manual / Add Entry:** `manual_payment` pattern; still Dr AP Cr bank when paying supplier.

### E) Expenses

- Paid expense: **Dr expense category account, Cr payment account**; `payments` row often `reference_type: expense` for Roznamcha alignment.
- **Edit amount/account:** Expense service / adjustment — may create new JE or void+replace per implementation; always preserve audit.

### F) Rental

- **Booking:** Primarily operational row; stock movements on pickup/return.
- **Payment:** `rental_payments` + JE (`reference_type: rental`); void path reconnects `rental_payments` (`rentalService.voidRentalPaymentByReversedJournal`).

### G) Worker / payroll

- **Advance:** Dr `1180`, Cr cash.
- **Stage bill:** Dr `5000`, Cr `2010`.
- **Payment:** Dr `2010` (if bill) else `1180`, Cr cash.
- **Operational:** `worker_ledger_entries` sync.

### H) Manual journal / Add Entry

- Pure GL: `reference_type` journal/manual lines as entered.
- **Party impact:** Only if lines hit AR/AP/worker accounts and references populated — treat as **sensitive** (Integrity Lab rules).

### I) Inventory / opening / production

- **Opening inventory:** `openingBalanceJournalService` → `opening_balance_inventory`.
- **Stock adjustment:** DB trigger path → JE.
- **Studio cost:** Dr `5000` Cr `2010`.

---

## 7. Per-event template (use for any new feature)

For each **business event**:

1. **Business event** — name  
2. **Source tables** — list  
3. **Journal created?** — Y/N + `reference_type`  
4. **Debit accounts** — codes/roles  
5. **Credit accounts** — codes/roles  
6. **Party linkage** — contact id / subledger account  
7. **Payment/allocation** — tables touched  
8. **Effective UI** — what user should see  
9. **Audit UI** — extra rows  
10. **Edit** — header vs financial  
11. **Reversal** — void vs reversing JE  
12. **Report impact** — TB/BS/P&L/statement  
13. **Numeric example** — optional  

*(Full worked examples in Section 11.)*

---

## 8. Edit / reverse / adjustment rulebook

### A) Header-only

- Update document/JE header fields where allowed (`journalTransactionDateSyncService` if date propagates).
- **No** new lines required for pure memo/reference — effective views unchanged.

### B) Financial

- **Sales/Purchases:** `sale_adjustment` / `purchase_adjustment` deltas preferred over blanket delete.
- **Payments:** Void payment → void/reversal chain; allocations reversed per service.

### C) Reversal

| Layer | Effective TB | Audit |
|-------|--------------|-------|
| Void JE | Excluded | Visible with `is_void` |
| `correction_reversal` | Net with original | Both entries visible |
| Rental payment void | `rental_payments.voided_at`; due recomputed | History preserved |

---

## 9. Report impact matrix (by event)

| Event | TB | BS | P&L | GL | Customer stmt | Supplier | Worker | Cash stmt |
|-------|----|----|-----|-----|---------------|----------|--------|-----------|
| Sale finalize | AR↑ rev↑ COGS↑ inv↓ | AR, Inv, equity via NI | Rev, COGS | Lines | Debit sale | — | — | — |
| Sale payment | Cash↑ AR↓ | Same | — | Lines | Credit pay | — | — | Cash |
| Purchase | AP↑ inv↑ | AP, Inv | — (BS only timing) | Lines | — | Debit bill | — | — |
| Supplier pay | Cash↓ AP↓ | Same | — | Lines | — | Credit pay | — | Cash |
| Expense | Exp↑ cash↓ | (via NI) | Expense | Lines | — | — | — | Cash |
| Worker pay | 2010/1180↓ cash↓ | Liab/adv | — | Lines | — | — | Ledger | Cash |

---

## 10. Party / subledger rules

- **AR:** Control `1100`; post to **`AR-{contact}`** when customer known (`partySubledgerAccountService`).
- **AP:** Control `2000`; post to **`AP-{contact}`** when supplier known.
- **Worker:** Global `2010`/`1180`; party resolution via `reference_id` / worker id on JE — **not** the same child pattern as AR/AP today.
- **Statements:** **Operational** statement ≠ **GL** statement — label both (`PARTY_LEDGER_UNIFICATION_PLAN.md`).
- **Voided payments:** Excluded from effective running balance math where implemented; still in audit.

---

## 11. Reconciliation rules

- TB debits = credits per company (sanity).
- **Contacts recon:** Operational receivable vs GL `1100` family (tolerance / timing documented on recon screen).
- **Inventory:** GL `1200` vs valuation report when COGS/purchase complete.
- **Worker:** Do not equate `2010` net to sum of arbitrary party nets without breakdown service notes.

---

## 12. Worked examples (numbers)

### Sale + payment + edit

1. Sale **10,000** cash to customer (simplified): Dr AR **10,000**, Cr Revenue **10,000**.  
2. Payment **10,000**: Dr Bank **10,000**, Cr AR **10,000**.  
3. Edit sale down by **1,000** (adjustment): Dr Revenue **1,000**, Cr AR **1,000** (delta pattern).  
**Effective:** Customer sees net sale **9,000** and payment **10,000** only if allocations/refunds reflect business rules — *always validate refund workflow separately.*

### Purchase + freight + discount

- Subtotal Dr Inventory, Cr AP; discount Dr AP Cr `5210`; freight capitalized Dr Inventory Cr AP (per purchase service snapshot).

### Customer receipt FIFO

- Payment **30,000** applies to Invoice A **20k** + Invoice B **10k** → two allocation rows; AR drops by **30k** total; GL matches.

### Reversed payment

- Original payment JE voided; AR increases (uncollected again); effective statement shows payment row **voided** or removed per UI policy — **audit** shows both.

### Rental advance

- Dr Cash, Cr liability/revenue per rental accounting mapping; due on `rentals` decreases.

### Worker advance + settlement

- Advance Dr `1180` Cr Cash; bill Cr `2010` Dr `5000`; settlement Dr `2010` Cr `1180` up to cap (`workerAdvanceService`).

---

## 13. Known risks / edge cases

- **Dual revenue codes** `4000`/`4100` — revenue split across accounts until merged.  
- **Legacy shipping** credited to `4100` before `4110` existed — historical data.  
- **Rental** JE excluded from some customer journal merge paths — synthetic rows possible.  
- **Branch filter:** NULL `branch_id` JEs still include company-wide — explain in UI.

---

## 14. Final implementation checklist

- [ ] Every new posting path calls `accountingService.createEntry` or approved trigger.  
- [ ] Party sales/purchases use subledger resolvers.  
- [ ] Payment JEs set `payment_id` when required.  
- [ ] Void flows update dependent tables (`rental_payments`, allocations).  
- [ ] UI labels distinguish operational vs GL statements.  
- [ ] `unifiedTransactionEdit` used from journal drill-downs.

---

## Return: open questions

1. **Commission batch:** Exact `reference_type` and accounts when “Generate to Ledger” runs — confirm per deployment.  
2. **Rental revenue recognition timing:** Full policy per booking vs pickup (accounting vs tax).  
3. **FIFO vs manual allocation** default on customer receipts — product flag.

## Modules benefiting from a dedicated contract doc

- **Rental** — single `RENTAL_ACCOUNTING_CONTRACT.md` (if not already complete vs scattered notes).  
- **Payment allocations** — extend `PAYMENT_ISOLATION_RULES.md` with FIFO diagrams.  
- **Expense edit/versioning** — `expenseEditTrace` vs GL alignment.

---

*End of execution manual.*
