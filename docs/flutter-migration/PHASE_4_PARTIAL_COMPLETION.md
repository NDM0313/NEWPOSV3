# Phase 4 partial — Flutter ERP mobile

**Status:** Accounting-adjacent writes + ledger reads shipped.

## Added in this pass

| Feature | Route | RPC / table |
|---------|-------|-------------|
| Contact create | `/contacts/new` | `contacts` insert + `ensure_party_subledgers_for_contact` |
| Product create (minimal) | `/products/new` | `products` insert |
| Expense create | `/expenses/new` | `create_expense_document` + `record_expense_with_accounting` |
| Partial sale payment | `/sales/:id` | `record_payment_with_accounting` (custom amount) |
| Partial supplier payment | `/purchases/:id` | `record_payment_with_accounting` paid |
| Sale cancel / void | `/sales/:id` | `cancel_sale_full_void` |
| Party ledger (contact) | `/contacts/:id/ledger` | `get_customer_ar_gl_ledger_for_contact` / supplier AP RPC |
| Journal ledger list | `/ledger` | `journal_entries` read |

## Still future

- Sale return documents, rental booking writes, studio production writes
- Offline sync (Phase 5), printing/barcode (Phase 6)
- Contact/product edit, manual journal entry create

## QA

- `flutter analyze` — required before release
- Test money flows on non-production branch first
