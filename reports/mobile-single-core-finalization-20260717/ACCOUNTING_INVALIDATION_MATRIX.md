# ACCOUNTING_INVALIDATION_MATRIX.md

| Action | RPC/API | Invalidation |
|--------|---------|--------------|
| Sale create | record_sale_with_accounting | sales + `invalidateAfterAccountingWrite` |
| Sale status finalize | record_sale_with_accounting | `invalidateAfterAccountingWrite` when newly posted |
| Sale on-account receipt | record_payment… | existing accounting dispatch |
| Purchase create | record_purchase_with_accounting | `invalidateAfterAccountingWrite` |
| Supplier payment | record_payment_with_accounting | `invalidateAfterAccountingWrite` |
| Worker payment | record_payment_with_accounting | `invalidateAfterAccountingWrite` |
| Journal / transfer | createJournalEntry | `invalidateAfterAccountingWrite` |
| Expense create | create_expense_document | `invalidateAfterAccountingWrite` |
| Courier payment | record_payment… | existing |
| Sale/purchase edit UI | UI handlers | existing |

`invalidateAfterAccountingWrite` now also emits `dispatchMobileAccountingInvalidated`.
