# Phase 10 — Global Default Date/Time Sorting (Deployment Log)

**Date:** 2026-05-25  
**Scope:** Sirf `erp-mobile-app/` — koi web ya DB migration nahi.

## Rule kya hai

Har document/timeline list view **default** par **newest first** (date + time descending):

1. Pehle business date (`invoice_date`, `po_date`, `expense_date`, `payment_date`)
2. Tie-break: `created_at` (asli clock time)
3. User filters (search, status, category) apply honay ke **baad** bhi final list par sort dubara lagta hai

## Naya shared helper

[`erp-mobile-app/src/utils/chronologicalSort.ts`](../erp-mobile-app/src/utils/chronologicalSort.ts)

- `sortByDocumentDateTimeDesc()` — sales, purchases, expenses, offline merge
- `compareTransactionRowDesc()` — payments/receipts timeline

## API updates (Supabase `.order()`)

| File | Change |
|------|--------|
| `api/sales.ts` | `invoice_date desc` + `created_at desc` |
| `api/expenses.ts` | `expense_date desc` + `created_at desc`; select mein `created_at` |
| `api/purchases.ts` | `po_date desc` + `created_at desc`; list item par `created_at` |
| `api/transactions.ts` | Pehle se theek (`payment_date` + `created_at` desc) |

## Client / UI updates

| Module | File |
|--------|------|
| Sales list | `SalesHome.tsx` — `filteredSales` ke end par sort |
| Expenses | `ExpenseModule.tsx` — filtered + grouped lists |
| Purchases | `PurchaseModule.tsx` — `filteredOrders` useMemo |
| Receipts/Payments | `TransactionsTimeline.tsx` — merge ke baad global sort |
| Offline queue | `offlinePendingList.ts` — merge ke baad sort |
| Stock history | `ProductHistoryModal.tsx` — shared sort helper |

## Exception (jaan-boojh kar)

- **Inventory product catalog** — alphabetical (`name`) hi rehta hai (user choice)
- **Stock movement API** — ascending (running balance ke liye); UI history modal newest-first dikhata hai
- **Account ledger / sale line items** — ascending order touch nahi kiya

## Verify

```bash
npm run typecheck:mobile   # PASS
```

**Manual smoke (tablet):**

1. Aaj 2 sales same date → latest `created_at` upar
2. Purchase list search filter ke baad bhi newest upar
3. Expense category filter ke baad bhi newest upar
4. Transactions timeline — payment + journal mix newest upar
5. Offline pending sale/purchase merge ke baad sahi order
