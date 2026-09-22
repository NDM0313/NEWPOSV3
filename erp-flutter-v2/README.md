# DIN Collection ERP — Flutter v2 (Greenfield)

Native Flutter ERP client built per the **Master Architecture Blueprint**. Same Supabase contract as [`erp-mobile-app/`](../erp-mobile-app/) and web [`src/`](../src/).

**Package ID:** `com.dincouture.erp.flutter_v2` (parallel to Capacitor `com.dincouture.erp` and pilot `erp-flutter-app`).

## Stack

- Flutter 3.11+ · Material Design 3 (dark, data-dense)
- **Riverpod** + **go_router**
- **supabase_flutter** → `https://erp.dincouture.pk` (locked)

## Prerequisites

- Flutter SDK on PATH
- Anon key: root `.env.production`, `.env.local`, or `erp-mobile-app/.env.production` → `VITE_SUPABASE_ANON_KEY`

## Run

```powershell
cd erp-flutter-v2
flutter pub get
flutter run --dart-define=SUPABASE_ANON_KEY='your_anon_key'
```

## Build release APK

```powershell
cd erp-flutter-v2
.\scripts\build-release-apk.ps1
```

APK: `build\app\outputs\flutter-apk\app-release.apk`

## Architecture

```
lib/
  app/          config, router, theme (MD3)
  core/         supabase, permissions, widgets (AppDataTable, MoneyText)
  data/         models, repositories, local offline queue, sync
  features/     auth, home, sales, pos, purchases, expenses, inventory, reports, accounts, …
  device/       barcode, printing
```

## Modules

| Module | Routes | Writes |
|--------|--------|--------|
| Auth / home | `/login`, `/branch`, `/home` + bottom nav | — |
| Sales / POS | `/sales`, `/pos` | Finalize, pay, void, barcode |
| Purchases / expenses | `/purchases`, `/expenses` | Draft, finalize, GL RPCs |
| Inventory | `/inventory` | Stock adjustment movements |
| Accounts / ledger | `/accounts`, `/ledger` | Read (COA balances) |
| Reports | `/reports`, `/reports/sales`, `/reports/expenses` | Read |
| Contacts / products | `/contacts`, `/products` | CRUD |
| Rentals / studio | `/rentals`, `/studio` | Full lifecycle |

## Offline queue

Types: `draftSale`, `posSale`, `expense`, `draftPurchase`, `salePayment`, `purchasePayment`

## QA

Before production distribution:

1. [`docs/flutter-migration/08_TESTING_QA_CHECKLIST.md`](../docs/flutter-migration/08_TESTING_QA_CHECKLIST.md)
2. Log results in [`docs/QA_ERP_FLUTTER_V2.md`](docs/QA_ERP_FLUTTER_V2.md)
3. Compare money flows with Capacitor on **test company only**

## Sale finalize contract (server)

When `status = final`:

1. `ensure_sale_stock_movements(p_sale_id)`
2. `record_sale_with_accounting(p_sale_id)`
3. Optional: `record_payment_with_accounting` if paid > 0

See [`erp-mobile-app/src/api/sales.ts`](../erp-mobile-app/src/api/sales.ts).
