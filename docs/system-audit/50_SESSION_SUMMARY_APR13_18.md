# 50. Session Summary — April 13-18, 2026

**Status:** Major COA/Accounting overhaul complete. In-place edit system deployed.

---

## Completed Work

### Phase 1: Core Accounting Fixes
| Fix | Files | Status |
|-----|-------|--------|
| Sale discount reduces AR (not Revenue) | saleAccountingService.ts | Done |
| Payment JEs use customer sub-ledger (not parent 1100) | saleAccountingService.ts | Done |
| Opening balance JEs use sub-ledger | openingBalanceJournalService.ts | Done |
| COGS uses weighted avg purchase cost | saleAccountingService.ts, SalesContext.tsx | Done |
| Sale return COGS uses purchase cost (not selling price) | saleReturnService.ts | Done |
| Purchase snapshot includes shipping_cost | purchaseAccountingService.ts | Done |
| Contacts page uses GL sub-ledger balance | ContactsPage.tsx | Done |
| Sub-ledger codes shortened (AR-CUS0001 format) | partySubledgerAccountService.ts | Done |
| Commission account 5110 auto-created | commissionReportService.ts, defaultAccountsService.ts | Done |
| Expense GL maps category→account (salary→6110) | AccountingContext.tsx, ExpenseContext.tsx | Done |

### Phase 2: In-Place Edit System
| Transaction Type | In-Place Update | Files |
|-----------------|:-:|-------|
| Sale (qty/price/discount) | ✅ | SalesContext.tsx |
| Purchase (qty/price/discount/freight) | ✅ | PurchaseContext.tsx |
| Sale payment edit | ✅ | saleService.ts |
| Purchase payment edit | ✅ | purchaseService.ts |
| Expense edit | ✅ | ExpenseContext.tsx |
| Manual JE edit (account swap + amount) | ✅ | TransactionDetailModal.tsx |

### Phase 3: UI Enhancements
| Feature | Files |
|---------|-------|
| Journal Entries filter pills (Sale/Purchase/Payment/Return/etc.) | AccountingDashboard.tsx |
| Reference type colored badges | AccountingDashboard.tsx |
| JE detail: Edit Accounts (searchable dropdown) | TransactionDetailModal.tsx |
| JE detail: Void/Cancel button | TransactionDetailModal.tsx |
| Sales list: Ref/Notes column | SalesPage.tsx |
| Developer Lab: GL Audit tab (J) | DeveloperIntegrityLabPage.tsx |
| Developer Lab: Inventory Detail tab (K) | DeveloperIntegrityLabPage.tsx |
| Developer Lab: Contact Reconciliation tab (L) | DeveloperIntegrityLabPage.tsx |
| Developer Lab: OB Sync tab (I) | DeveloperIntegrityLabPage.tsx |

### Other Fixes
| Fix | Status |
|-----|--------|
| Contact code 409 conflict (retry on unique violation) | Done |
| SUP/WRK auto-codes for suppliers/workers | Done |
| Purchase return double JE posting | Done |
| Purchase edit lock removed (was blocking edits with returns) | Done |
| Expense delete (true delete + void JE + void payments) | Done |
| Roznamcha ghost entries from deleted expenses | Done |
| Kong YAML fix (502 errors) | Done |
| Business creation retry for stuck users | Done |

---

## Remaining Tasks

### HIGH Priority
1. **Performance: paymentAdjustmentService loop** — `Skip sync: multiple primary JEs for payment b368080d/88b799e6` runs on EVERY page load. These are legacy test payments with original + reversal JEs. Fix: void the stale ones or add skip cache so it doesn't re-check every load.

2. **Sale payment account change still creates adjustment JE** — When BOTH amount AND account change in one edit, in-place handles amount but `postPaymentAccountAdjustment` still creates a separate account-change JE. Should update account_id on existing JE line instead.

3. **Stock movement delta grouping** — When sale is edited (qty change), new stock movement entries are created alongside old ones. These should be grouped/labeled better in the Stock Ledger View so user can see "Sale SL-0018 (edit)" vs multiple separate entries.

### MEDIUM Priority
4. **Purchase payment in-place: also handle account change** — Currently only amount change is in-place. Account change still creates adjustment JE (same as sale payment issue #2).

5. **Void legacy adjustment JEs** — Old sale_adjustment and payment_adjustment JEs from before in-place system should be voided to clean up statements. Currently they're still active and show in journal entries.

6. **Trial balance sync on every edit** — After in-place edit, stored account balances may drift. Should auto-sync after each edit or add periodic sync.

### LOW Priority
7. **Console noise reduction** — Reduce `AccountingContext.loadEntries` re-runs (currently fires 6-8x per action due to multiple event dispatches).

8. **Expense edit: payee name reverse lookup** — Works for salary users but may not work for other payee types.

9. **Sale/Purchase in-place: also update stock movements** — Currently JE is updated in-place but stock movement deltas still create new entries. Should update existing movements too.

---

## Key Files Modified This Session

```
src/app/services/saleAccountingService.ts
src/app/services/purchaseAccountingService.ts
src/app/services/saleReturnService.ts
src/app/services/openingBalanceJournalService.ts
src/app/services/partySubledgerAccountService.ts
src/app/services/contactService.ts
src/app/services/expenseService.ts
src/app/services/commissionReportService.ts
src/app/services/defaultAccountsService.ts
src/app/services/purchaseService.ts
src/app/services/saleService.ts
src/app/services/liveDataRepairService.ts
src/app/context/SalesContext.tsx
src/app/context/PurchaseContext.tsx
src/app/context/ExpenseContext.tsx
src/app/context/AccountingContext.tsx
src/app/components/accounting/AccountingDashboard.tsx
src/app/components/accounting/TransactionDetailModal.tsx
src/app/components/admin/DeveloperIntegrityLabPage.tsx
src/app/components/contacts/ContactsPage.tsx
src/app/components/sales/SalesPage.tsx
src/app/components/dashboard/AddExpenseDrawer.tsx
src/app/components/purchases/PurchaseReturnForm.tsx
src/app/components/purchases/StandalonePurchaseReturnForm.tsx
src/app/components/purchases/PurchasesPage.tsx
```
