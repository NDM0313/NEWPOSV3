# Phase 3 completion — Flutter ERP mobile

**Status:** Core write paths + remaining read modules shipped in `erp-flutter-app/`.

## Implemented

| Area | Routes | Notes |
|------|--------|-------|
| Draft sale create/edit/finalize | `/sales/new`, `/sales/:id/edit` | `create_sale_document_header`, `update_sale_with_items`, stock + GL RPCs |
| Sale payment (full due) | `/sales/:id` | `record_payment_with_accounting` received |
| Draft purchase create/finalize | `/purchases/new` | `create_purchase_document_header`, `record_purchase_with_accounting` |
| Supplier payment | `/purchases/:id` | `record_payment_with_accounting` paid |
| POS checkout | `/pos` | POS invoice sequence, final sale, stock, GL, cash payment |
| Expenses read | `/expenses` | Read-only list/detail |
| Rentals read | `/rentals` | `rentals` table |
| Studio read | `/studio` | `sales` where `is_studio=true` |
| Accounts / Ledger read | `/accounts`, `/ledger` | Chart of accounts list |
| Settings | `/settings` | Profile, branch switch, sign out |
| Packing | Home → `/sales` | Sales list for shipment context |

## Still out of scope (future)

- Sale void/return, partial payments, contact/product create
- Studio production pipeline writes, rental booking writes
- Offline sync, printing, barcode
- Full ledger drill-down / journal entry views

## QA

- `flutter analyze` — pass
- Manual admin/salesman device QA on production data — **required before money flows in prod**

## Run

```bash
cd erp-flutter-app
flutter pub get
flutter run --dart-define=SUPABASE_ANON_KEY=your_anon_key
```

Supabase URL is locked to `https://erp.dincouture.pk` (see `MOBILE_APK_LOCKED_PATTERN.md`).
