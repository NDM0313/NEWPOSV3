# Transaction Actions — Unified UX & Implementation Plan

**Date:** 2026-06-12  
**Product:** DIN Collection ERP  
**Status:** Plan only — **awaiting approval before any code changes**  
**Related:** [transaction-actions-analysis.md](./transaction-actions-analysis.md) · [cash-flow-plan.md](./cash-flow-plan.md)

---

## 1. Purpose

Define a **single user-facing vocabulary** and a **shared action system** for all transaction surfaces in Accounting and source modules, without changing backend behavior in Phase 1.

**Business anchor:** Source documents (Sale, Purchase, Rental, Studio work order) are **never** cancelled or deleted from Accounting surfaces. Users get **Open Source Document** + trace/audit only.

---

## 2. User-facing vocabulary (standard action set)

| Action | User label | Hide from normal UI |
|--------|--------------|---------------------|
| Edit | **Edit Payment** / **Edit Entry** | — |
| Cancel | **Cancel Payment** / **Cancel Expense** / **Cancel Entry** | Delete, Void (as primary label) |
| Undo | **Undo Last Change** | — |
| Fix metadata | **Fix Customer Link** / **Fix Supplier Link** / **Fix Branch** / **Fix Account Link** | RPC names, relink internals |
| Read-only | **View Trace** / **View Audit** | — |
| Navigate | **Open Source Document** | — |

**Never show to normal Accounting users:**

- Reverse / repost (as primary action)
- `correction_reversal` terminology
- Dry-run / Phase 2 / Phase 3
- Developer repair action IDs

**Admin/developer surfaces** may retain advanced tools but should **reuse the same labels** where an action is surfaced to admins.

---

## 3. Rules by source type and status

| Source type | Draft / unposted | Posted / final | Voided / cancelled | Allowed from Accounting |
|-------------|------------------|----------------|--------------------|-------------------------|
| **Sale / Purchase / Rental / Studio WO** (document JE) | N/A | **Open Source Document** only | Open Source + View Trace/Audit | **No** cancel, delete, or reverse |
| **Customer / Supplier / Worker payment** | Edit if allowed | Edit, Cancel, Undo, Fix Link | View Trace/Audit only | Yes |
| **Expense** | Delete draft | **Cancel Expense** (not hard delete) | View Audit | Same panel on Expense module + Accounting |
| **Manual journal entry** | Delete draft | Cancel Entry + Fix Link | View Audit | Yes |
| **Transfer** | — | Cancel Entry | View Audit | Yes |

### 3.1 Payment chain rules (PF-14)

- **Edit:** Only when chain tail allows (`paymentChainMutationGuard`)
- **Undo Last Change:** Only when `transaction_mutations` has restorable prior state and user is on chain tail
- **Cancel Payment:** Full chain void via existing `createReversalEntry` / `voidPaymentAfterJournalReversal` — **rename UI only in Phase 1**

### 3.2 Expense decision (Phase 2)

Two paths exist today:

| Path | Behavior |
|------|----------|
| `expenseService.deleteExpense` (current UI) | Void JEs + **hard delete** expense row |
| `cancellationService.cancelExpense` (unused) | Soft `status=rejected` only — **no GL void** |

**Recommended:** Phase 2 wires **Cancel Expense** to void JEs + soft status (no hard delete for posted). Keep hard delete for **draft-only** expenses. Document this explicitly before implementation.

---

## 4. Shared action system design (future implementation)

### 4.1 Planned API

```typescript
// src/app/lib/transactionActionRules.ts (new, future)
// NOT implemented in documentation phase

export type TransactionActionContext =
  | 'journal'
  | 'statement'
  | 'payment_page'
  | 'expense_page'
  | 'trace'
  | 'cash_flow';

export interface TransactionAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  severity: 'default' | 'destructive' | 'secondary';
  requiresReason: boolean;
  handlerRef: string; // maps to existing service call — no new mutation paths in Phase 1
  visibleWhen: (row: TransactionRow, ctx: TransactionActionContext) => boolean;
}

export function getTransactionActions(
  row: TransactionRow,
  context: TransactionActionContext,
  userRole: UserRole
): TransactionAction[];
```

### 4.2 Components (future)

| Component | Role |
|-----------|------|
| `TransactionActionPanel` | Inline button group for row / modal footer |
| `TransactionActionDrawer` | Mobile / dense layouts |
| `TransactionActionResult` | Success/error toast + audit reference id |

### 4.3 Delegation to existing policy

`getTransactionActions` must **delegate** to:

- [`journalEntryEditPolicy.ts`](../../src/app/lib/journalEntryEditPolicy.ts) — block cancel/reverse on source documents
- [`unifiedTransactionEdit.ts`](../../src/app/lib/unifiedTransactionEdit.ts) — edit routing
- [`paymentChainMutationGuard.ts`](../../src/app/lib/paymentChainMutationGuard.ts) — chain tail rules
- [`arApReconciliationAccess.ts`](../../src/app/lib/arApReconciliationAccess.ts) — Fix Link apply gating

**Phase 1 rule:** New panel calls **existing handlers only** — no new RPCs or migrations.

---

## 5. Integration points (ordered)

| Priority | Surface | Phase |
|----------|---------|-------|
| 1 | `TransactionDetailModal` | 1 |
| 2 | `AccountingDashboard` journal row menus | 1 |
| 3 | `ExpensesDashboard` / `ExpenseDetailSheet` | 2 |
| 4 | Sale/purchase payment rows (Delete → Cancel) | 2 |
| 5 | `AccountLedgerReportPage` / Ledger V2 row menus | 3 |
| 6 | `FinancialTraceCenterPage` | Cross-link only (read-only) |
| 7 | Developer Center / AR/AP | Share labels; keep advanced tools |

---

## 6. Backend safety rules

1. **No hard delete** of posted `payments`, `journal_entries`, or final `expenses` (after Phase 2)
2. **Cancel** = void + reversal chain via existing [`paymentLifecycleService`](../../src/app/services/paymentLifecycleService.ts) and [`createReversalEntry`](../../src/app/services/accountingService.ts)
3. **Fix Link** = metadata-only mutations audited to existing tables; **amounts unchanged** unless a separate **Correction** action is approved (admin-gated, future)
4. **Fix Link wizard** reuses Developer Center repair RPCs with dry-run preview (Phase 3)
5. **Source document JEs:** policy layer returns empty cancel/reverse actions; UI never shows disabled destructive buttons

---

## 7. Audit requirements

Every **Cancel**, **Undo**, and **Fix Link** must record:

- User id
- Timestamp
- Reason (optional or required by severity)
- Before/after JSON snapshot
- Source reference (payment_id, journal_entry_id, expense_id)
- Linked audit row id

| Action type | Preferred audit store |
|-------------|----------------------|
| Payment edit / undo / cancel | Extend `transaction_mutations` |
| Fix Link / metadata repair | `developer_repair_audit` |
| AR/AP mapping | `journal_party_contact_mapping` + workflow status |

**Future:** Unified **View Audit** drawer reads from all stores (Phase 4).

---

## 8. Phased implementation roadmap

| Phase | Scope | Risk | Migrations |
|-------|-------|------|------------|
| **0** | Documentation (this task) | None | None |
| **1** | `getTransactionActions` + `TransactionActionPanel`; wire TransactionDetailModal + journal tab; label normalization | Low | None |
| **2** | Expense Cancel replaces hard delete for posted; align sale/purchase **Cancel Payment** wording | Medium | None (behavior change only) |
| **3** | Fix Link user wizard (metadata-only) reusing developer repair dry-run | Medium | None |
| **4** | Global report audit mode contract + shared filter helper | Medium | None |
| **5** | Cash Flow tab Phase A (operational) — see [cash-flow-plan.md](./cash-flow-plan.md) | Low–medium | None |
| **6** | Cash Flow Phase B (GL summary via `getCashFlowStatement`) | Low | None |

**Explicitly out of scope until separate approval:**

- AR/AP Phase 3 apply enablement (`canApplyRepair: true`)
- Database rename of `correction_reversal`
- FX / multi-currency app

---

## 9. Rollback plan

- Feature flag: `VITE_TRANSACTION_ACTION_PANEL=1`
- Phase 1: existing handlers remain callable from old UI paths until flag is default-on
- Revert = remove panel shell only; **no schema rollback** needed for Phase 1–3
- Phase 2 expense behavior: flag `VITE_EXPENSE_CANCEL_SOFT=1` to gate cancel vs delete

---

## 10. Testing checklist (post-implementation)

### Payment PF-14 chain

- [ ] Edit payment amount → delta JE posted
- [ ] Undo Last Change → tail voided, payment restored
- [ ] Cancel Payment → full chain voided, reports hide in normal mode

### Cross-surface consistency

- [ ] Cancel from Accounting journal = Cancel from sale/purchase drawer (same outcome)
- [ ] TransactionDetailModal shows same actions as journal row menu

### Expense

- [ ] Draft delete removes row (no posted GL)
- [ ] Posted Cancel voids JE, soft status, row retained in audit mode

### Manual JE

- [ ] Draft delete
- [ ] Posted Cancel Entry

### Source documents

- [ ] Sale/purchase/rental document JE: only **Open Source Document** + View Trace visible
- [ ] No disabled Reverse button (hidden entirely)

### Fix Link

- [ ] Dry-run shows before/after; apply writes `developer_repair_audit`
- [ ] GL line amounts unchanged

### Reports

- [ ] Normal mode hides voided/cancelled
- [ ] Audit mode shows paired original + cancellation rows

### Roles

- [ ] Staff: Edit/Cancel where allowed; no Fix Link apply
- [ ] Admin: Fix Link wizard
- [ ] Developer: full Developer Center unchanged

---

## 11. Label migration map (Phase 1)

| Current label | New label | Surface |
|---------------|-----------|---------|
| Delete Payment | Cancel Payment | Sale/purchase drawers, PaymentDeleteConfirmationModal |
| Void / Cancel | Cancel Payment / Cancel Entry | TransactionDetailModal |
| Reverse | *(hidden for normal users)* | Journal tab, detail modal |
| Delete Expense | Cancel Expense (posted) / Delete (draft) | ExpensesDashboard |
| Undo edit | Undo Last Change | AccountingDashboard |

---

## 12. Approval gate

**Do not implement Phases 1–6 until this plan is reviewed and approved.**

After approval, start with Phase 1 only (UI shell + label normalization, zero backend change).

See [transaction-actions-analysis.md](./transaction-actions-analysis.md) for current-state evidence and [cash-flow-plan.md](./cash-flow-plan.md) for the Cash Flow tab that will consume the shared action panel on row click.
