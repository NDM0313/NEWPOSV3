# PF-14.1 Global Posted Document Edit Engine – Implementation Plan

## Design rules

1. **Draft / unposted**: In-place overwrite; no adjustment JEs.
2. **Posted**: Never delete or renumber original JEs; use linked reversal/delta adjustments only.
3. **User-facing**: Document screens show **effective** (current) values only; payment history shows **effective** payment rows.
4. **Reporting**: Business reports = effective state; accounting/audit reports = raw JEs + adjustments.
5. **Scope**: Sales, Purchases, Rentals, Studio, Expenses, Payments – same pattern.

## Architecture

### A. Effective document state

- **Source of truth**: Document table (`sales`, `purchases`, `rentals`, `expenses`) is the effective state after any edit. We do **not** derive “current” totals from journal entries.
- **getEffectiveDocumentState(referenceType, referenceId)**:
  - `'sale'` → `saleService.getSaleById(referenceId)` (includes charges, items).
  - `'purchase'` → `purchaseService.getById` / equivalent.
  - `'rental'` → `rentalService.getById` / equivalent.
  - `'expense'` → `expenseService.getById` / equivalent.
- **Usage**: Document detail UIs, business reports, and any code that must show “current document” must use this (or the underlying service). Never use JE aggregates for “current” document totals.

### B. Effective payment state

- **Source of truth**: Payment rows in `payments` for that document. When a payment is **edited** (e.g. amount 30,000 → 27,000), we **update the payment row** so the effective value is 27,000. No duplicate “active” rows.
- **getEffectivePaymentState(referenceType, referenceId)**:
  - `'sale'` → `saleService.getSalePayments(referenceId)`.
  - `'purchase'` → `purchaseService.getPayments(referenceId)` (or equivalent).
  - Future: if we add `supersedes_payment_id`, filter to “active” only (e.g. not superseded).
- **Usage**: Payment history section, “total paid” on document, business reports.

### C. Payment edit accounting

- When user edits a **posted** payment (e.g. amount 30,000 → 27,000):
  1. **Update** `payments` row (amount = 27,000) so effective = 27,000.
  2. **Do not** delete or change the original payment JE.
  3. **Post** a delta JE:
     - If new amount < old: reversal (e.g. Dr Cash 3,000, Cr AR 3,000) so net effect = 27,000.
     - If new amount > old: additional (e.g. Dr AR 2,000, Cr Cash 2,000) so net effect = new.
  4. Optionally link adjustment JE to payment (e.g. `reference_type = 'payment_adjustment'`, `reference_id = paymentId`).

### D. Document edit accounting (already done in PF-14)

- Sale edit: original sale JE unchanged; delta adjustment JEs only; document table updated.
- Document screen: reads from document table + effective payments → shows final values only.

### E. DB migrations (minimal)

- **None required** for Phase 1. Effective state = current document + payment rows.
- **Optional later**: `journal_entries.adjustment_of_entry_id`, `payments.supersedes_payment_id` for richer audit grouping.

### F. Day Book / Journal

- Keep raw JEs; no change to existing entries.
- Adjustments already have clear descriptions (e.g. “Sale adjustment – discount change – SL-0004”).
- Optional: group by `(reference_type, reference_id)` in UI so one document’s JEs are visually grouped.

## Files to update

| Area | File | Change |
|------|------|--------|
| **Effective state** | `src/app/services/effectiveDocumentService.ts` | **New**. getEffectiveDocumentState(type, id). getEffectivePaymentState(type, id). |
| **Payment edit** | `src/app/services/saleService.ts` | In updatePayment: when amount changes, call payment adjustment JE (delta). |
| **Payment edit** | `src/app/services/purchaseService.ts` | Same pattern when payment amount changes. |
| **Accounting** | `src/app/services/accountingService.ts` or new | postPaymentAdjustmentJE(referenceType, referenceId, paymentId, oldAmount, newAmount, …). |
| **Document UI** | Already correct | ViewSaleDetailsDrawer uses getSaleById + getSalePayments (effective). Ensure refresh after edit. |
| **Reports** | Business reports | Use getEffectiveDocumentState / getEffectivePaymentState where “current” document/payment is needed. |
| **Verification** | `scripts/verify-pf14-1-effective-state.sql` | Queries to assert document totals vs sum of JEs (effective = document row). |
| **Doc** | `docs/PF14_1_RESULT.md` | Result, checklist, acceptance. |

## Acceptance criteria (checklist)

- [ ] Editing a posted sale: UI shows only final effective document values (subtotal, discount, shipping, total, paid, due).
- [ ] Original sale JE remains untouched; JE number never changes.
- [ ] No component “disappears”; adjustments keep trail.
- [ ] No business screen shows duplicate active values from raw delta JEs.
- [ ] Payment edit 30,000 → 27,000: effective payment shown = 27,000 everywhere; accounting has original JE + reversal/delta.
- [ ] Same pattern reusable for purchase, rental, expense (effective state service + payment delta when implemented).
