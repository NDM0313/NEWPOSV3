# Flutter Phase 3 — Partial Completion (draft sale + expense read)

**Date:** 2026-06-11  
**Scope:** First approved write slice + additional read-only modules  
**App:** [`erp-flutter-app/`](../../erp-flutter-app/)

## Delivered in this pass

| Area | Status | Notes |
|------|--------|-------|
| **Draft sale create** | Done | `create_sale_document_header` + line items; status `draft` only |
| Expenses list/detail | Done | Read-only `/expenses` |
| Inventory home card | Done | Routes to `/products` (stock view) |
| Reports home card | Done | Routes to `/dashboard` |
| Sales list + button | Done | `+` when `sales.create` permission |

## Added in finalize + payment pass (2026-06-11)

| Feature | Status |
|---------|--------|
| Finalize sale (detail screen) | Done — `ensure_sale_stock_movements` + `record_sale_with_accounting` |
| Receive payment (full due, cash) | Done — `record_payment_with_accounting` |
| Permission gates | `canFinalizeSale`, `canReceiveSalePayment` |

## Added in edit + purchase pass (2026-06-11)

| Feature | Status |
|---------|--------|
| Edit draft sale | `update_sale_with_items` RPC — `/sales/:id/edit` |
| Draft purchase create | `create_purchase_document_header` + items |
| Finalize purchase | status `final` + `record_purchase_with_accounting` |

## Not delivered (still later)

- POS checkout, partial/split payments, bank account picker
- Sale void, return
- Purchase edit lines, supplier payment
- Rental, studio, ledger, accounts write, settings
- Offline sync, printing, barcode
- VPS deploy, migrations, git commit

## Write operations added (intentional, minimal)

| Operation | RPC / table | File |
|-----------|-------------|------|
| Create draft header | `create_sale_document_header` | `sales_write_repository.dart` |
| Insert lines | `sale_items` / `sales_items` `.insert()` | same |
| Rollback on item failure | `sales` `.delete()` by id | same (cleanup only) |
| Finalize status | `sales` `.update({status: final})` | same |
| Stock on finalize | `ensure_sale_stock_movements` | same |
| GL on finalize | `record_sale_with_accounting` | same |
| Receive payment | `record_payment_with_accounting` | same |
| Update sale lines | `update_sale_with_items` | same |
| Create purchase draft | `create_purchase_document_header` | `purchases_write_repository.dart` |
| Purchase items insert | `purchase_items` `.insert()` | same |
| Finalize purchase | `purchases` update + `record_purchase_with_accounting` | same |

**Not called:** `finalize_sale_return`, POS-specific paths, `cancel_purchase_full_void`.

## `flutter analyze`

```bash
cd erp-flutter-app && flutter analyze
# No issues found!
```

## Routes added

| Path | Screen |
|------|--------|
| `/sales/new` | Draft sale create |
| `/expenses` | Expenses list |
| `/expenses/:id` | Expense detail |

## Manual QA (operator)

1. Login as user with `sales.create`
2. Sales → `+` → add products → Save draft
3. Confirm detail shows `draft` status, no stock change on server (verify in web ERP)
4. Expenses list/detail read-only
5. Inventory card opens Products
6. Salesman without create permission: no `+` button

## Verdict

| Gate | Status |
|------|--------|
| Draft create only | **PASS** (code) |
| Full Phase 3 | **IN PROGRESS** |
| Finalize / payment | **NOT STARTED** |
| Production deploy | **NOT STARTED** |
