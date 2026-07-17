# ACCOUNTING_INVALIDATION_MATRIX.md

Central helper: `erp-mobile-app/src/api/singleCore/accountingCache.ts` → `invalidateAfterAccountingWrite`.

| Workflow | Frontend | Backend | Invalidation | Residual stale risk |
|----------|----------|---------|--------------|---------------------|
| Sale create/finalize | SalesModule / POS / SalesHome | `createSale` / `updateSaleStatus` / `record_sale_with_accounting` | HAS (`sale-created-accounting`, `sale-status-accounting`) | Low |
| Sale edit | SalesHome | `updateSaleWithItems` + in-place JE sync | HAS (`sale_edited` via helper) | Low; edit JE patch still client-side |
| Sale payment | UnifiedPaymentSheet / MobileReceivePayment | `record_payment_with_accounting` | HAS (`sale-payment`, `customer-payment`) | Low |
| On-account receipt | useRecordOnAccountCustomerPayment | RPC + JE patch | HAS (`mobile-on-account-receipt`) | Low |
| Sale return | SaleReturnModal | `finalize_sale_return` | HAS (`sale-return-finalized`) | Low |
| Sale cancel/void | SalesHome | `cancel_sale_full_void` | HAS (`sale-cancelled`) | Low |
| Purchase create | CreatePurchaseFlow | `createPurchase` | HAS | Low |
| Purchase finalize (status only) | PurchaseModule | `updatePurchaseStatus` | N/A (no GL in path) | Low |
| Purchase edit | PurchaseModule | `update_purchase_with_items` + JE sync | HAS (`purchase_edited`) | Medium if complex tax/freight vs web |
| Supplier payment | MobilePaySupplier | `recordSupplierPayment` | HAS | Low |
| Purchase cancel | PurchaseModule | `cancel_purchase_full_void` | HAS (`purchase-cancelled`) | Low |
| Expense create | ExpenseModule | `createExpense` | HAS | Low |
| Expense update/delete | ExpenseModule | `updateExpense` / `deleteExpense` | HAS | Low |
| Account transfer | AccountTransferFlow | `createJournalEntry` | HAS | Low |
| General JE create | GeneralEntryFlow | `createJournalEntry` | HAS | Low |
| JE edit | EditTransactionSheet | `updateJournalEntryInPlace` | HAS (`journal-entry-updated`) | Low |
| Rental booking | CreateRentalFlow | rental JE helpers → `createJournalEntry` | HAS (per JE) | Low |
| Rental payment | UnifiedPaymentSheet | `record_payment_with_accounting` | HAS (`rental-payment`) | Low |
| Worker payment | WorkerPaymentFlow | `recordWorkerPayment` | HAS | Low |
| Studio finalization | studioInvoiceLine / studio.ts | stage JEs + `record_sale_with_accounting` | HAS (`studio-sale-finalized`) | Medium race if dual callers |
| Company switch | AccountsModule | — | HAS (list cache clear) | Low |
| Branch switch | AccountsModule | — | HAS (list cache clear + epoch) | Low |
| App resume | AccountsModule | — | Epoch bump | Relies on reload |
| Logout | auth.ts | — | Epoch clear | IndexedDB lists not wiped (session-scoped OK) |

Realtime (`App.tsx`) remains a supplementary bus path; write-success invalidation is primary for stale-report prevention.

Submit-lock / idempotency: unchanged; owned by existing RPC fingerprints / UI locks — not rewritten.
