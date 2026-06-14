# Phase 2A — Expense Payment Sync + Fix Link Apply

**Date:** 2026-06-12  
**Base commit:** `057fcbc6`  
**Status:** Implemented in Phase 2A scope only

---

## Problem A — EXP-0021 / PAY-0207 amount mismatch

### Root cause

Paid expense amount edits use `ExpenseContext.updateExpenseBody` with classifier `DELTA_ADJUSTMENT`. That path updates:

- `expenses.amount`
- `journal_entry_lines` (debit expense + credit cash/bank) in place

It does **not** update `payments.amount`. Roznamcha (`roznamchaService.fetchPaymentRows`) and transaction detail (`TransactionDetailModal` payment amount) read **`payments.amount`**, so cash book and payment metadata stay at the original posted value (e.g. Rs 13,500) while expense and JE show Rs 7,000.

`classifyPaidExpenseEdit` always set `paymentsTouch: false` even for amount changes.

### Authoritative source

| Surface | Authoritative field |
|---------|---------------------|
| Expense list/detail | `expenses.amount` |
| Account ledger | `journal_entry_lines` (liquidity credit leg) |
| Roznamcha cash-out | `payments.amount` |
| Transaction detail payment block | `payments.amount` |

**Repair rule:** JE liquidity credit total is GL truth. If `expense.amount === JE credit` but `payments.amount` differs → update **payment only**. If JE ≠ expense → block repair apply (requires separate GL review).

### Forward fix

After in-place JE line update, `syncExpenseLinkedPayment` updates linked `payments` row (`amount`, `payment_account_id` when changed) and JE header totals. No new migration.

### Backward repair

`expense.sync_linked_payment_amount` in Developer Center: dry-run shows expense / payment / JE / roznamcha amounts; apply only when JE matches expense.

---

## Problem B — JE-0168 / RCV-0001 Fix Link preview-only

### Root cause

- `RelinkDryRunWizard` had a hard-disabled **Save mapping (Phase 3)** button.
- `arApReconciliationAccess.canApplyRepair` was `false` for all roles.
- `saveJournalPartyContactMapping` existed but was never wired from UI.

### Phase 2A behavior

- `canApplyRelinkMapping` enabled for admin / owner / super-admin / developer.
- `canApplyGlRepair` stays **false** (no post / reverse / repost).
- **Save Link** / **Save Link for Trace** writes `journal_party_contact_mapping` + `party_repair_audit`.
- **Voided / reversal / `correction_reversal` rows:** metadata-only trace mapping is **allowed** (JE-0168 class). GL lines and amounts are never changed.

---

## Files changed

| Area | Path |
|------|------|
| Expense sync | `src/app/services/expensePaymentSyncService.ts` |
| Edit wiring | `src/app/context/ExpenseContext.tsx`, `src/app/lib/accountingEditClassification.ts` |
| Repair action | `src/app/lib/developerRepairActions/expenseActions.ts` |
| Fix Link | `src/app/lib/arApRelinkApply.ts`, `src/app/lib/arApReconciliationAccess.ts` |
| Fix Link UI | `RelinkDryRunWizard.tsx`, `ArApReconciliationCenterPage.tsx`, `SourceDocumentDetailModal.tsx` |
| Workflow | `src/app/services/arApRepairWorkflowService.ts` |
| Diagnostics | `scripts/sql/diag_expense_payment_amount_mismatch.sql` |

---

## Out of scope (Phase 2A)

- Cash Flow tab
- Expense Cancel / hard-delete replacement
- AR/AP GL post, reverse, repost apply
- Migrations (unless explicitly approved later)
