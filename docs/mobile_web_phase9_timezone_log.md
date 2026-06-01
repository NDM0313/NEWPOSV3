# Phase 9 — Global System-Local Timezone Alignment (Deployment Log)

**Date:** 2026-05-25  
**Scope:** Web (`src/app/`) + Mobile (`erp-mobile-app/`) — **koi DB migration nahi**.

## Masla kya tha

Sales list aur receipts par **"Today, 05:00 am"** jaisa galat time dikhta tha. Wajah:

1. **`toISOString()`** hamesha **UTC (`Z`)** bhejta hai — Pakistan (+05:00) mein UTC midnight **subah 5 bajay** ban jati hai.
2. **`toISOString().slice(0, 10)`** calendar date ke liye **UTC din** deta hai, device ka local din nahi (raat 12 ke qareeb galat date).

## Naye helpers (dono clients par same API)

| Function | Kaam |
|----------|------|
| `toLocalISOString(date?)` | Poora timestamp local offset ke sath, maslan `2026-05-25T18:30:00+05:00` |
| `getCurrentLocalTimestamp()` | Abhi ka local timestamp — `created_at`, `updated_at`, `voided_at` writes |
| `localNowDateString()` | Pehle se tha — `invoice_date`, `payment_date`, `expense_date`, `po_date` |
| `formatRelativeListDateTime()` | Purane UTC-midnight (`...T00:00:00Z`) records par bogus time hide |

**Files:**

- [`erp-mobile-app/src/utils/localDate.ts`](../erp-mobile-app/src/utils/localDate.ts)
- [`src/app/utils/localDate.ts`](../src/app/utils/localDate.ts)

## Replacement rules (write paths)

| Purana | Naya |
|--------|------|
| `new Date().toISOString()` | `getCurrentLocalTimestamp()` |
| `new Date().toISOString().split('T')[0]` | `localNowDateString()` |
| `new Date().toISOString().slice(0, 10)` | `localNowDateString()` |

## Mobile — badli hui files

| Module | Files |
|--------|-------|
| Sales / POS | `SalesHome.tsx`, `SalesModule.tsx`, `offlinePendingList.ts`, `sharePaymentReceipt.ts` |
| Purchases | `CreatePurchaseFlow.tsx`, `PurchaseModule.tsx`, `purchaseEditAccounting.ts` |
| Expenses / Payments | `accounts.ts`, `transactions.ts`, `transactionEdit.ts`, `MobilePaymentSheet.tsx`, `rentals.ts` |

## Web — badli hui files

| Module | Files |
|--------|-------|
| Sales / POS | `saleService.ts`, `saleAccountingService.ts`, `saleReturnService.ts`, `POS.tsx`, `SalesContext.tsx` |
| Purchases | `purchaseService.ts`, `purchaseAccountingService.ts`, `purchaseReturnService.ts`, `PurchaseContext.tsx` |
| Expenses / Payments | `expenseService.ts`, `ExpenseContext.tsx`, `recordPaymentWithAccountingRpc.ts`, `supplierPaymentService.ts`, `paymentAdjustmentService.ts`, `paymentLifecycleService.ts`, `UnifiedPaymentDialog.tsx` |

## Verify (tablet / browser)

1. **POS checkout** → Sales list mein **05:00 am nahi**, sahi local time ya sirf date.
2. **Payment voucher** → `payment_date` aaj ka **local** calendar day.
3. **Expense add/delete** → local `expense_date`; void timestamps offset ke sath.
4. **Purchase entry** → `po_date` local din.

## Build / typecheck

```bash
npm run typecheck:mobile   # PASS
npx tsc -b                 # repo mein pehle se maujood web TS errors (Phase 9 se unrelated)
```

**Mobile result:** PASS  
**Web result:** Phase 9 changed files mein koi naya timezone-related error nahi; root `tsc -b` pehle se failing modules (Accounting demo, POS CartItem types, etc.) ab bhi hain.

## Notes

- Purani DB rows UTC `Z` ke sath reh sakti hain — display helper unhe gracefully handle karta hai.
- Naye writes local offset string bhejte hain; Postgres `timestamptz` accept karta hai.
- Column types / migrations touch **nahi** kiye.

## Display fix (sales / purchase lists)

Sales list pehle `invoice_date || created_at` ek field se format karti thi — is se **"Yesterday, 05:00 am"** aa sakta tha. Ab `formatDocumentListDateTime()` calendar day `invoice_date` / `po_date` se aur clock time `created_at` se alag resolve karta hai, maslan: **Yesterday · 24 May 2026, 2:30 pm**. UTC-midnight legacy rows par bogus time suppress hota hai.
