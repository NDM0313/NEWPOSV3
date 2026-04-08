# Supplier ledger / statement / edit refresh / edit permissions — unification fix report

**Date:** 2026-03-29  
**Related prior work (do not regress):**  
- [CONTACTS_OPERATIONAL_GL_PARITY_FIX_REPORT.md](./CONTACTS_OPERATIONAL_GL_PARITY_FIX_REPORT.md) — `get_contact_balances_summary`, Contacts UI, no silent RPC fallback.  
- [PURCHASE_PAYMENT_CONTACTS_GL_FIX_REPORT.md](./PURCHASE_PAYMENT_CONTACTS_GL_FIX_REPORT.md) — grouped journal amounts, party AP posting, supplier opening row credit convention, RPC allocation parity.

## 1. Root causes addressed in this change set

### A) Supplier operational running balance inverted (`getSupplierOperationalLedgerData`)

Purchases are stored as **credit** (increase payable); supplier payments as **debit** (decrease payable). Cumulative **amount owed** must follow:

`running += credit − debit`

The implementation used `running += debit − credit`, which **subtracts** purchases and **adds** payments — the opposite of payable economics. That made the classic operational tab (summary cards + row running balances) disagree with user expectations and with the GL tab’s stated convention (“what we owe”).

**Fix:** Both the pre-window carry loop and the in-window loop now use `+ credit − debit`. Closing balance matches `openingAtFrom + totalCredit − totalDebit` for events in range.

### B) Stale UI after payment save/edit from `UnifiedPaymentDialog`

On success, the dialog called `dispatchContactBalancesRefresh(companyId)` but **not** `dispatchAccountingEditCommitted`. Many screens listen for `accountingEntriesChanged` / `ledgerUpdated` (e.g. `AccountingContext`, `GenericLedgerView`) and would not reload journal-derived data until a full refresh.

**Fix:** After a successful payment (create or edit), call `dispatchAccountingEditCommitted` with `{ customerId }` or `{ supplierId }` when `entityId` is present, so journal lists, supplier statement tabs, and related views bump without reload.

### C) Generic accounting “Edit” on source-document journal rows

Journal Entries and Day Book offered **Edit** for all non-reversal rows, including sale/purchase/rental principals and opening/inventory/stock adjustment types. That pushed users into generic flows instead of source modules.

**Fix:** Central policy in `journalEntryEditPolicy.ts`:

- **Allow** unified edit when the row is linked to a **payment** (`metadata.paymentId` / `payment_id`), or when `reference_type` is not in a blocked set (manual journal, expense, transfer, payment types, etc.).
- **Block** sale, purchase, rental, sale/purchase adjustments, opening-balance and inventory-related `reference_type` values when there is **no** payment link.
- **Journal Entries:** show **Open source** (sale/purchase drawer or rentals navigation) when blocked but a document id is available; otherwise only View/Reverse.
- **Day Book:** load `payment_id`; per line, show Edit only when the policy allows; otherwise “—”.

### D) Misleading supplier operational summary copy

`ModernSummaryCards` used customer-oriented sublabels (“Payment received”, generic invoice copy) on the supplier statement operational tab.

**Fix:** Optional `variant` prop; `GenericLedgerView` passes `ledgerType` so supplier sees payable-oriented labels (opening payable, payments made, purchase bills, closing payable operational).

## 2. Classic supplier ledger vs canonical engines

- **Operational tab** remains the subledger view (purchases + payments tables), **not** merged GL lines. It is now **mathematically aligned** with payable semantics (positive running balance ≈ we owe more after purchases, less after payments).
- **GL tab** remains canonical **AP party slice** journal truth (unchanged).
- **Reconciliation tab** remains RPC vs GL comparison (unchanged).

We did **not** remove the operational tab; we fixed the wrong running-balance formula and clarified labels so it is not a “second fake GL.”

## 3. Files changed

| File | Change |
|------|--------|
| `src/app/services/ledgerDataAdapters.ts` | Supplier operational running balance: `+ credit − debit`. |
| `src/app/components/shared/UnifiedPaymentDialog.tsx` | `dispatchAccountingEditCommitted` on success (+ existing contact refresh). |
| `src/app/components/customer-ledger-test/modern-original/ModernSummaryCards.tsx` | `variant` for supplier (and other ledger types) copy. |
| `src/app/components/accounting/GenericLedgerView.tsx` | Pass `variant={ledgerType}` to summary cards. |
| `src/app/lib/journalEntryEditPolicy.ts` | **New** — edit allowlist + source-document open target. |
| `src/app/components/accounting/AccountingDashboard.tsx` | Conditional Edit / Open source; `handleOpenJournalSourceDocument`. |
| `src/app/components/reports/DayBookReport.tsx` | Select `payment_id`; conditional Edit column. |

## 4. SQL / migrations

No new SQL in this change set. Prior parity fixes remain in migrations such as `20260430_get_contact_balances_operational_recv_pay_parity.sql` and related party GL work documented in the reports above.

## 5. Refresh / invalidation

| Event | Emitted by |
|--------|------------|
| `CONTACT_BALANCES_REFRESH_EVENT` | `dispatchContactBalancesRefresh` (unchanged on payment success) |
| `accountingEntriesChanged` | `dispatchAccountingEditCommitted` (**added** from `UnifiedPaymentDialog` success) |
| `paymentAdded` | same |
| `ledgerUpdated` | same when `customerId` / `supplierId` passed |

`GenericLedgerView` already listens to `CONTACT_BALANCES_REFRESH_EVENT`, `accountingEntriesChanged`, and `ledgerUpdated` — payment edits now trigger the same paths as other accounting mutations.

## 6. Edit permission rules (summary)

| `reference_type` (no `payment_id`) | Journal / Day Book |
|-------------------------------------|-------------------|
| `sale`, `purchase`, `rental` | Block generic Edit → Open source if `reference_id` resolvable (Journal) |
| `sale_adjustment`, `purchase_adjustment` | Block → Open source when mapped |
| `opening_balance_*`, `opening_balance_inventory`, `stock_adjustment` | Block; no source button unless extended later |
| `correction_reversal` | Block |
| Any row with `payment_id` | Allow (settlement) |

## 7. DIN COUTURE illustrative math (operational, after fix)

Example consistent with screenshots: opening **100,000**, one purchase **400,000**, payments total **70,000** (in range).

- **Before (bug):** running balance moved as if payments *increased* payable and purchases *decreased* it (in-window carry used `debit − credit`).
- **After:** closing operational running balance in period ≈ **100,000 + 400,000 − 70,000 = 430,000** (positive = we owe supplier), aligned with “purchases increase payable, payments decrease payable.”

GL and reconciliation totals continue to come from journal/RPC paths documented in prior reports; this fix removes the operational **running column** inversion only.

## 8. Verification performed

- `npm run build` — success (TypeScript / bundle).

## 9. Remaining risks / follow-ups

1. **Live DB:** No VPS/browser re-run against DIN COUTURE in this session; confirm on staging/production that edited payment amounts appear everywhere after one save.
2. **Day Book “Open source”:** Not implemented; blocked rows show “—”. Users can use Journal Entries + **Open source** or navigate from Sales/Purchases.
3. **Reverse** on source-document rows remains available from Journal Entries; if that should be restricted, treat as a separate policy change.
4. **Rental** document rows: **Open source** switches view to Rentals + `sessionStorage` hint (same pattern as `TransactionDetailModal`).
